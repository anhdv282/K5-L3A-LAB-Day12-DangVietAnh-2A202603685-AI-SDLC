#!/usr/bin/env node
// Benchmark (Ticket-04 §1). Usage: node scripts/bench.mjs --seed 42 --duration 30 --out bench.json [--headless]
// Opens the real game (three.js/WebGL) in a 1280x720 Chrome window with vsync/frame-rate limit disabled, loads the
// standard bench scene (?bench), waits 3 s warm-up, measures --duration seconds, writes bench.json and exits 0.
// Needs Google Chrome or Chromium (set CHROME=/path/to/chrome if it is not found automatically).
import { spawn, execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir, type, release, arch, cpus, totalmem } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const PROCESS_START = performance.timeOrigin;   // epoch ms when this process started
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const seed = Number(arg('--seed', 42)), duration = Number(arg('--duration', 30)), out = arg('--out', 'bench.json');
const headless = process.argv.includes('--headless');
const PORT = Number(process.env.BENCH_PORT || 5197), DEBUG_PORT = Number(process.env.BENCH_DEBUG_PORT || 9334);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const contract = JSON.parse(readFileSync(join(ROOT, 'game.contract.json'), 'utf8'));

function findChrome() {
  if (process.env.CHROME) return process.env.CHROME;
  const mac = ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Chromium.app/Contents/MacOS/Chromium'];
  for (const p of mac) if (existsSync(p)) return p;
  for (const name of ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser']) {
    try { return execFileSync('which', [name], { encoding: 'utf8' }).trim(); } catch {}
  }
  throw new Error('Chrome/Chromium not found. Install Google Chrome or set CHROME=/path/to/chrome');
}
// RSS (MB) of the whole Chrome process tree (browser + GPU + renderer processes).
function treeRssMb(rootPid) {
  try {
    const rows = execFileSync('ps', ['-A', '-o', 'pid=,ppid=,rss='], { encoding: 'utf8' }).trim().split('\n').map(l => l.trim().split(/\s+/).map(Number));
    const kids = new Map(); for (const [pid, ppid] of rows) (kids.get(ppid) || kids.set(ppid, []).get(ppid)).push(pid);
    const rss = new Map(rows.map(([pid, , r]) => [pid, r]));
    let sum = 0; const stack = [rootPid];
    while (stack.length) { const p = stack.pop(); sum += rss.get(p) || 0; stack.push(...(kids.get(p) || [])); }
    return sum / 1024;
  } catch { return null; }
}

const fail = (msg) => { console.error(`bench failed: ${msg}`); cleanup(); process.exit(1); };
let server, chrome, profile;
function cleanup() { try { chrome?.kill(); } catch {} try { server?.kill(); } catch {} try { if (profile) rmSync(profile, { recursive: true, force: true }); } catch {} }
process.on('SIGINT', () => { cleanup(); process.exit(130); });

server = spawn(process.execPath, [join(ROOT, 'server.js')], { env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore' });
for (let i = 0; ; i++) { try { await fetch(`http://localhost:${PORT}/`); break; } catch { if (i > 100) fail('server did not start'); await sleep(50); } }

profile = mkdtempSync(join(tmpdir(), 'ddl-bench-'));
const url = `http://localhost:${PORT}/?bench&seed=${seed}&duration=${duration}`;
chrome = spawn(findChrome(), [
  ...(headless ? ['--headless=new'] : [`--app=${url}`]), '--window-size=1280,720', '--window-position=40,40', '--force-device-scale-factor=1',
  '--disable-gpu-vsync', '--disable-frame-rate-limit',   // vsync off
  '--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows',
  '--no-first-run', '--no-default-browser-check', `--user-data-dir=${profile}`, `--remote-debugging-port=${DEBUG_PORT}`,
  ...(headless ? [url] : []),
], { stdio: 'ignore' });

// DevTools connection
let ws, version = {};
for (let i = 0; !ws; i++) {
  await sleep(100);
  try {
    version = await (await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/version`)).json();
    const pg = (await (await fetch(`http://127.0.0.1:${DEBUG_PORT}/json`)).json()).find(t => t.type === 'page' && t.url.includes('bench'));
    if (pg) ws = new WebSocket(pg.webSocketDebuggerUrl);
  } catch {}
  if (i > 200) fail('could not connect to Chrome DevTools');
}
await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); });
let id = 0; const pending = new Map(); const errors = [];
ws.addEventListener('message', (m) => {
  const d = JSON.parse(m.data);
  if (pending.has(d.id)) { pending.get(d.id)(d.result); pending.delete(d.id); }
  if (d.method === 'Runtime.exceptionThrown') errors.push(d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text);
});
const send = (method, params = {}) => new Promise(r => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const evaluate = async (expression) => (await send('Runtime.evaluate', { expression, returnByValue: true })).result?.value;
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });   // exact 1280x720 viewport
await evaluate("dispatchEvent(new Event('resize'))");

// wait for the run to finish, sampling memory while measuring
let peak = null, result = null;
const deadline = Date.now() + (duration + 60) * 1000;
while (!result) {
  if (Date.now() > deadline) fail(`timed out. JS errors: ${errors.join(' | ') || 'none'}`);
  const b = await evaluate('window.__bench || null');
  if (errors.length) fail(`JS error in page: ${errors[0]}`);
  if (b?.phase === 'measure' || b?.phase === 'done') { const m = treeRssMb(chrome.pid); if (m !== null) peak = Math.max(peak ?? 0, m); }
  if (b?.phase === 'done') result = b;
  else await sleep(250);
}

const report = {
  contract_version: contract.contract_version,
  avg_fps: result.avg_fps,
  p1_low_fps: result.p1_low_fps,
  frame_ms_p95: result.frame_ms_p95,
  frames: result.frames,
  load_ms: Math.round(result.first_frame_epoch - PROCESS_START),
  peak_mem_mb: peak === null ? null : Math.round(peak),
  vsync_off: true,
  renderer: `three.js r${result.three} WebGL2 · ${result.gpu} · ${version.Browser || 'Chrome'}${headless ? ' (headless)' : ''}`,
  os: `${type()} ${release()} ${arch()} · ${cpus()[0]?.model || 'cpu'} · ${Math.round(totalmem() / 1073741824)} GB RAM`,
  seed, duration_s: duration, viewport: result.viewport, scene: { shades: result.shades, motes: result.motes },
  notes: 'vsync/frame cap disabled with --disable-gpu-vsync --disable-frame-rate-limit; peak_mem_mb = RSS of the whole Chrome process tree during measurement',
};
writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report));
ws.close(); cleanup();
process.exit(0);
