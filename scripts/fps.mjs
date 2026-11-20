// Measure average FPS of the real game at 1280x720 in Chrome (hardware GPU), via the DevTools protocol.
// Usage: node scripts/fps.mjs [night=3] [seconds=20]   (needs Google Chrome; starts its own server on :5198)
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const night = Number(process.argv[2] || 3), secs = Number(process.argv[3] || 20);
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const server = spawn(process.execPath, ['server.js'], { env: { ...process.env, PORT: '5198' }, stdio: 'ignore' });
const profile = mkdtempSync(join(tmpdir(), 'ddl-fps-'));
const chrome = spawn(CHROME, ['--headless=new', '--remote-debugging-port=9333', `--user-data-dir=${profile}`, '--window-size=1280,720',
  '--enable-gpu', '--ignore-gpu-blocklist', '--no-first-run', `http://localhost:5198/?night=${night}&autostart&bot&seed=1&fps`], { stdio: 'ignore' });
try {
  let ws;
  for (let i = 0; i < 50 && !ws; i++) {
    await sleep(200);
    try { const list = await (await fetch('http://127.0.0.1:9333/json')).json(); const pg = list.find(t => t.type === 'page'); if (pg) ws = new WebSocket(pg.webSocketDebuggerUrl); } catch {}
  }
  await new Promise(r => ws.addEventListener('open', r));
  let id = 0; const pending = new Map();
  ws.addEventListener('message', (m) => { const d = JSON.parse(m.data); if (pending.has(d.id)) { pending.get(d.id)(d.result); pending.delete(d.id); } });
  const send = (method, params) => new Promise(r => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const evaluate = (expression) => send('Runtime.evaluate', { expression, returnByValue: true });
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });   // exact 1280x720 viewport
  await evaluate("dispatchEvent(new Event('resize'))");
  await sleep(3000);   // warm-up (shader compile, first frames)
  await evaluate('window.__fpsStart = performance.now(); window.__f0 = 0; (function c(){ window.__f0++; requestAnimationFrame(c); })()');
  await sleep(secs * 1000);
  const r = (await evaluate(`(() => { const t = (performance.now() - window.__fpsStart) / 1000;
    const gl = document.querySelector('canvas').getContext('webgl2'); const ext = gl.getExtension('WEBGL_debug_renderer_info');
    return { avg_fps: +(window.__f0 / t).toFixed(1), seconds: +t.toFixed(1), frames: window.__f0, size: innerWidth + 'x' + innerHeight,
      renderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'unknown'}; })()`)).result.value;
  const out = { night, ...r, measured_at: new Date().toISOString(), pass_30fps: r.avg_fps >= 30 };
  console.log(JSON.stringify(out));
  ws.close();
} finally { chrome.kill(); server.kill(); await sleep(300); try { rmSync(profile, { recursive: true, force: true }); } catch {} }
