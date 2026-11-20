#!/usr/bin/env node
// Browser end-to-end checks for Ticket-04 UI requirements (accessibility + leaderboard). Needs Chrome/Chromium.
// Usage: node scripts/e2e.mjs [--out docs/proof/phase4/e2e.txt]
// Drives the real page through the DevTools protocol; exits 1 if any check fails.
import { spawn, execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const outArg = process.argv.indexOf('--out'), OUT = outArg > 0 ? process.argv[outArg + 1] : null;
const PORT = 5196, DBG = 9335, sleep = (ms) => new Promise(r => setTimeout(r, ms));
const tmp = mkdtempSync(join(tmpdir(), 'ddl-e2e-')), LB = join(tmp, 'lb.json');
const findChrome = () => {
  if (process.env.CHROME) return process.env.CHROME;
  for (const p of ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Chromium.app/Contents/MacOS/Chromium']) if (existsSync(p)) return p;
  for (const n of ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser']) { try { return execFileSync('which', [n], { encoding: 'utf8' }).trim(); } catch {} }
  throw new Error('Chrome not found (set CHROME=...)');
};
const server = spawn(process.execPath, [join(ROOT, 'server.js')], { env: { ...process.env, PORT: String(PORT), DDL_LEADERBOARD: LB }, stdio: 'ignore' });
for (let i = 0; ; i++) { try { await fetch(`http://localhost:${PORT}/`); break; } catch { if (i > 100) throw new Error('server'); await sleep(50); } }
const chrome = spawn(findChrome(), ['--headless=new', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=1280,720',
  `--remote-debugging-port=${DBG}`, `--user-data-dir=${join(tmp, 'profile')}`, '--no-first-run', 'about:blank'], { stdio: 'ignore' });

let ws; for (let i = 0; !ws; i++) { await sleep(100); try { const pg = (await (await fetch(`http://127.0.0.1:${DBG}/json`)).json()).find(t => t.type === 'page'); if (pg) ws = new WebSocket(pg.webSocketDebuggerUrl); } catch {} if (i > 100) throw new Error('devtools'); }
await new Promise(r => ws.addEventListener('open', r));
let id = 0; const pending = new Map(), jsErrors = [];
ws.addEventListener('message', (m) => { const d = JSON.parse(m.data); if (pending.has(d.id)) { pending.get(d.id)(d.result); pending.delete(d.id); }
  if (d.method === 'Runtime.exceptionThrown') jsErrors.push(d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text); });
const send = (method, params = {}) => new Promise(r => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expr) => { const r = await send('Runtime.evaluate', { expression: `(async () => { ${expr} })()`, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'eval error'); return r.result.value; };
const key = async (k, code) => { for (const type of ['keyDown', 'keyUp']) await send('Input.dispatchKeyEvent', { type, key: k, code: code || k, windowsVirtualKeyCode: k.length === 1 ? k.toUpperCase().charCodeAt(0) : 0 }); };
const go = async (q) => { await send('Page.navigate', { url: `http://localhost:${PORT}/${q}` }); for (let i = 0; i < 100; i++) { await sleep(100); if (await ev(`return document.readyState === 'complete' && !!document.querySelector('canvas')`).catch(() => false)) break; } await sleep(300); };
await send('Page.enable'); await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });

const waitFor = async (expr, ms = 8000) => { for (let t = 0; t < ms; t += 200) { if (await ev(expr).catch(() => false)) return true; await sleep(200); } return false; };
const results = []; let failed = 0;
const check = (name, ok, detail = '') => { results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`); if (!ok) failed++; };

try {
  // ---------- key rebinding ----------
  await go('');
  await ev(`localStorage.clear(); location.reload(); return 1`); await sleep(1500);
  await ev(`document.getElementById('btnMenuSettings').click(); return 1`);
  await ev(`document.querySelector('#keys button[data-act="jump"]').click(); return 1`);
  check('rebind: clicking an action waits for a key', await ev(`return document.querySelector('#keys button[data-act="jump"]').textContent`) === 'Nhấn phím…');
  await key('w', 'KeyW');
  const conflict = await ev(`return { err: document.getElementById('keyErr').textContent, cls: document.querySelector('#keys button[data-act="jump"]').className }`);
  check('rebind: duplicate key is detected and reported', /Trùng phím W/.test(conflict.err) && conflict.cls === 'conflict', conflict.err);
  await ev(`document.getElementById('btnKeysReset').click(); return 1`);
  const reset = await ev(`return { err: document.getElementById('keyErr').textContent, jump: document.querySelector('#keys button[data-act="jump"]').textContent }`);
  check('rebind: "Khôi phục mặc định" restores defaults', reset.err === '' && reset.jump === 'Space', JSON.stringify(reset));
  await ev(`document.querySelector('#keys button[data-act="pulse"]').click(); return 1`); await key('g', 'KeyG');
  await ev(`document.querySelector('#keys button[data-act="up"]').click(); return 1`); await key('i', 'KeyI');
  await ev(`document.getElementById('setRm').click(); document.getElementById('setBig').click(); return 1`);
  await ev(`location.reload(); return 1`); await sleep(1500);
  const persisted = await ev(`const s = JSON.parse(localStorage.getItem('ddl-settings')); return { pulse: s.keys.pulse, up: s.keys.up, hint: document.getElementById('kPulse').textContent, rm: document.body.classList.contains('rm'), big: document.body.classList.contains('big') }`);
  check('rebind + reduced motion + large text are saved across reloads', persisted.pulse === 'g' && persisted.up === 'i' && persisted.hint === 'G' && persisted.rm && persisted.big, JSON.stringify(persisted));
  await ev(`document.getElementById('btnMenuSettings').click(); return 1`);
  check('all 9 actions are rebindable', await ev(`return document.querySelectorAll('#keys button').length`) === 9);

  // rebound keys really drive the game (I = forward, G = pulse)
  await go('?night=1&autostart&seed=1&e2e');
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'i', code: 'KeyI' }); await sleep(800);
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'i', code: 'KeyI' });
  const moved = await ev(`const p = __ddl.sim.state.player.pos; return Math.hypot(p[0], p[2])`);
  check('rebound movement key moves Mây', moved > 1, `moved ${moved.toFixed(2)} m`);

  // ---------- reduced motion: no flash / shake ----------
  const rmFlash = await ev(`__ddl.handleEvents([{ type: 'player_hit', cause: 'shade' }]); return document.getElementById('flash').style.opacity || '0'`);
  check('reduced motion ON: hit causes no screen flash', Number(rmFlash) === 0, `opacity ${rmFlash}`);
  await ev(`__ddl.settings.reducedMotion = false; return 1`);
  const flashOn = await ev(`__ddl.handleEvents([{ type: 'player_hit', cause: 'shade' }]); return document.getElementById('flash').style.opacity`);
  check('reduced motion OFF: hit flashes the screen', Number(flashOn) > 0, `opacity ${flashOn}`);

  // ---------- font sizes >= 18 px (normal size) ----------
  await ev(`__ddl.settings.bigText = false; document.body.classList.remove('big'); return 1`); await sleep(300);
  const small = await ev(`const bad = []; for (const el of document.querySelectorAll('body *')) { if (!el.childNodes.length || ![...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) continue; const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden') continue; if (parseFloat(cs.fontSize) < 18) bad.push(el.id || el.tagName + ':' + el.textContent.trim().slice(0, 20)); } return bad`);
  check('every text element renders at >= 18 px (1280x720)', small.length === 0, small.join(', '));
  await ev(`document.body.classList.add('big'); return 1`);
  check('large text option scales the HUD by 1.25', await ev(`return getComputedStyle(document.getElementById('timer')).zoom`) === '1.25');

  // ---------- captions / visual cues ----------
  await ev(`__ddl.advance(310); return 1`); await sleep(400);
  const cap1 = await ev(`return { text: document.getElementById('captions').textContent, arrows: document.querySelectorAll('#shadeArrows .arrow').length }`);
  check('caption + edge arrow when a Bóng Mực appears', /Bóng Mực xuất hiện/.test(cap1.text) && cap1.arrows >= 1, JSON.stringify(cap1));
  await ev(`const l = __ddl.sim.state.lanterns[0]; l.lit = true; l.everLit = true; l.fuel = 29 * 60; return 1`); await sleep(600);
  check('caption when a lantern drops below 30 fuel', /sắp cạn dầu/.test(await ev(`return document.getElementById('captions').textContent`)));
  await ev(`__ddl.sim.state.timeLeft = 11 * 60; return 1`); await sleep(1800);
  check('caption for the last 10 seconds', /Còn 10 giây/.test(await ev(`return document.getElementById('captions').textContent`)));
  await go('?night=3&autostart&seed=1&e2e');
  await ev(`const s = __ddl.sim.state; s.simTick = 1678; s.player.flames = 99; __ddl.advance(3); return 1`); await sleep(300);
  check('caption when wind is about to blow (Night 3)', /Gió lớn sắp thổi/.test(await ev(`return document.getElementById('captions').textContent`)));

  // ---------- leaderboard: lose -> enter name -> saved on disk -> board ----------
  await go('?night=1&autostart&seed=5&e2e');
  await ev(`__ddl.sim.state.player.flames = 1; __ddl.sim.state.shades.push({ id: 'S99', pos: [0.2, 0, 0], state: 'chase', left: 0, dir: 0, push: 0, pushDir: [1, 0], evict: 0, recoilDir: [1, 0], target: null, drainTicks: 0 }); __ddl.advance(1); return 1`);
  await waitFor(`return document.getElementById('ovResult').classList.contains('show')`);
  const res = await ev(`return { shown: document.getElementById('ovResult').classList.contains('show'), save: getComputedStyle(document.getElementById('resSave')).display }`);
  check('after losing a night the name entry is offered', res.shown && res.save !== 'none', JSON.stringify(res));
  await ev(`document.getElementById('resName').value = 'x'; document.getElementById('btnResSave').click(); return 1`); await sleep(300);
  check('invalid name is rejected in the UI', /3–12/.test(await ev(`return document.getElementById('resErr').textContent`)));
  await ev(`document.getElementById('resName').value = 'Mây_01'; document.getElementById('btnResSave').click(); return 1`); await sleep(600);
  const saved = JSON.parse(readFileSync(LB, 'utf8'));
  check('score saved to the leaderboard file on disk', saved.entries.length === 1 && saved.entries[0].name === 'Mây_01' && saved.entries[0].nights_won === 0 && /([+-]\d{2}:\d{2}|Z)$/.test(saved.entries[0].achieved_at), JSON.stringify(saved.entries[0]));
  await go('');
  await ev(`document.getElementById('btnMenuBoard').click(); return 1`); await sleep(500);
  check('leaderboard screen from the main menu lists the entry', /Mây_01/.test(await ev(`return document.getElementById('boardTable').textContent`)));
  check('no JavaScript errors during the run', jsErrors.length === 0, jsErrors.join(' | '));
} catch (e) { check('e2e script ran to completion', false, e.message); }

const report = `E2E (Chrome headless, 1280x720) — ${new Date().toISOString()}\n` + results.join('\n') + `\n${results.length - failed}/${results.length} passed\n`;
console.log(report); if (OUT) writeFileSync(OUT, report);
ws.close(); chrome.kill(); server.kill(); await sleep(200); try { rmSync(tmp, { recursive: true, force: true }); } catch {}
process.exit(failed ? 1 : 0);
