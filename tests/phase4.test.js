// Ticket-04 (Contract v1.3): leaderboard, bench maths + bench scene, soak, contract commands.
// Written BEFORE the implementation (see docs/proof/phase4/tdd-red.txt).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validateName, addEntry, sortEntries, isoLocal, MAX_ENTRIES } from '../src/core/leaderboard.js';
import { frameStats, createBenchSim, cameraAt, BENCH } from '../src/core/bench.js';
import { soakNight } from '../src/core/soak.js';
import { CONTRACT } from '../src/headless.js';

const T = CONTRACT.tuning;
const tmp = () => mkdtempSync(join(tmpdir(), 'ddl-p4-'));
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ---------- contract v1.3 ----------
test('contract 1.3: bench_cmd, soak_cmd present; run_cmd accepts --export-leaderboard', () => {
  assert.equal(CONTRACT.contract_version, '1.3');
  assert.equal(CONTRACT.bench_cmd, 'node scripts/bench.mjs');
  assert.equal(CONTRACT.soak_cmd, 'node --expose-gc --jitless --max-semi-space-size=1 scripts/soak.mjs');   // flags documented in README (soak memory)
  assert.equal(CONTRACT.run_cmd, 'node server.js');
  for (const k of ['build_cmd', 'headless_cmd', 'tuning']) assert.ok(k in CONTRACT, k);   // v1.0–1.2 keys kept
});

// ---------- leaderboard ----------
test('leaderboard name: 3–12 chars of [A-Za-z0-9_]; Vietnamese letters accepted; others rejected', () => {
  for (const ok of ['abc', 'Player_01', 'A'.repeat(12), 'Mây', 'Đăng_Khoa', 'Nguyễn']) assert.ok(validateName(ok).ok, ok);
  for (const bad of ['ab', 'A'.repeat(13), 'has space', 'semi;colon', '', '😀😀😀', 'abc-def']) assert.ok(!validateName(bad).ok, bad);
  assert.equal(validateName('  Mây  ').name, 'Mây');   // trimmed, NFC
  assert.equal(validateName('Mây').name, 'Mây');  // decomposed input normalised to NFC
});

test('leaderboard: sort by score desc, ties -> earlier achieved_at first; keep top 10', () => {
  let list = [];
  const at = (m) => `2026-11-20T10:${String(m).padStart(2, '0')}:00.000+07:00`;
  for (let i = 0; i < 12; i++) list = addEntry(list, { name: `p${i}xx`, score: 100 * (i % 4), nights_won: i % 4, achieved_at: at(i), seed: i });
  assert.equal(list.length, MAX_ENTRIES);
  for (let i = 1; i < list.length; i++) {
    const a = list[i - 1], b = list[i];
    assert.ok(a.score > b.score || (a.score === b.score && Date.parse(a.achieved_at) <= Date.parse(b.achieved_at)));
  }
  assert.deepEqual(list.slice(0, 3).map(e => e.name), ['p3xx', 'p7xx', 'p11xx']);   // 300 points, earliest first
  assert.ok(!list.some(e => e.score === 0 && e.name === 'p8xx'), 'lowest/latest dropped');
  assert.deepEqual(sortEntries([{ score: 5, achieved_at: at(2) }, { score: 5, achieved_at: at(1) }]).map(e => e.achieved_at), [at(1), at(2)]);
});

test('leaderboard entry fields validated: nights_won 0..3, integer score >= 0, ISO 8601 with timezone', () => {
  const ok = { name: 'Mây', score: 10, nights_won: 3, achieved_at: isoLocal(new Date('2026-11-20T03:04:05Z')), seed: 7 };
  assert.equal(addEntry([], ok).length, 1);
  assert.match(ok.achieved_at, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?([+-]\d{2}:\d{2}|Z)$/);
  assert.throws(() => addEntry([], { ...ok, nights_won: 4 }));
  assert.throws(() => addEntry([], { ...ok, score: -1 }));
  assert.throws(() => addEntry([], { ...ok, name: 'x' }));
});

// ---------- bench maths ----------
test('frameStats: avg_fps = 1000N/sum, p1_low = 1000/mean(k largest), k=max(1,ceil(0.01N)), p95 nearest-rank', () => {
  const dts = [...Array(99).fill(10), 50];   // 100 frames
  const s = frameStats(dts);
  assert.equal(s.frames, 100);
  assert.equal(s.avg_fps, Math.round(1000 * 100 / (99 * 10 + 50) * 10) / 10);   // 96.2
  assert.equal(s.p1_low_fps, 20);            // k = 1, worst frame 50 ms
  assert.equal(s.frame_ms_p95, 10);
  const t = frameStats([...Array(150).fill(16), 40, 30]);   // N=152 -> k=2 -> mean(40,30)=35
  assert.equal(t.p1_low_fps, Math.round(1000 / 35 * 10) / 10);
  assert.equal(frameStats([20]).p1_low_fps, 50);
});

test('camera path: radius 30, Y 15, starts at (30,15,0), CCW seen from above, 15 s per lap', () => {
  const near = (a, b) => a.every((v, i) => Math.abs(v - b[i]) < 1e-9);
  assert.ok(near(cameraAt(0), [30, 15, 0]));
  assert.ok(near(cameraAt(3.75), [0, 15, 30]));   // quarter lap: +Z (CCW in the map convention x=r cos a, z=r sin a)
  assert.ok(near(cameraAt(15), [30, 15, 0]));
});

test('bench scene: 200 wander shades spread over the island, 100 motes, L1–L3 lit with fuel 100; nothing spawns, no damage, no pickup, no fuel decay, no end', () => {
  const sim = createBenchSim(T, 42);
  const s0 = sim.snapshot();
  assert.equal(s0.shades.length, BENCH.shades); assert.equal(BENCH.shades, 200);
  assert.equal(s0.motes.length, BENCH.motes); assert.equal(BENCH.motes, 100);
  assert.ok(s0.shades.every(x => x.state === 'wander'));
  assert.deepEqual(s0.lanterns.map(l => [l.id, l.lit, l.fuel]), [['L1', true, 100], ['L2', true, 100], ['L3', true, 100], ['L4', false, 0], ['L5', false, 0]]);
  assert.deepEqual(s0.player.pos, [0, 0, 0]);
  const quad = [0, 0, 0, 0]; for (const x of s0.shades) quad[(x.pos[0] >= 0 ? 0 : 1) + (x.pos[2] >= 0 ? 0 : 2)]++;
  assert.ok(quad.every(q => q > 30), `spread ${quad}`);
  assert.ok(s0.shades.every(x => Math.hypot(x.pos[0], x.pos[2]) <= 40));
  const before = JSON.stringify(s0.shades.map(x => x.pos));
  const evs = []; for (let i = 0; i < 60 * 60 * 5; i++) { sim.step({}); evs.push(...sim.state.events.map(e => e.type)); }   // 5 minutes > night length
  const s1 = sim.snapshot();
  assert.equal(sim.state.status, 'playing', 'no end condition');
  assert.equal(s1.shades.length, 200); assert.equal(s1.motes.length, 100);
  assert.ok(s1.shades.every(x => x.state === 'wander'), 'shades keep wandering');
  assert.ok(s1.lanterns.slice(0, 3).every(l => l.fuel === 100));
  assert.equal(s1.player.flames, T.flames);
  assert.notEqual(JSON.stringify(s1.shades.map(x => x.pos)), before, 'shades move');
  for (const t of ['player_hit', 'pickup', 'shade_spawn', 'lantern_out', 'game_over', 'drifter_spawn']) assert.ok(!evs.includes(t), t);
  assert.deepEqual(createBenchSim(T, 42).snapshot().shades, s0.shades, 'deterministic layout for seed 42');
});

test('bench flags do not leak into normal play (default sim unchanged)', () => {
  const a = JSON.stringify(execFileSync('node', ['src/headless.js', '--night', '1', '--seed', '3', '--bot', '--snapshot-every', '0'], { encoding: 'utf8' }));
  const b = JSON.stringify(execFileSync('node', ['src/headless.js', '--night', '1', '--seed', '3', '--bot', '--snapshot-every', '0'], { encoding: 'utf8' }));
  assert.equal(a, b);
});

// ---------- soak ----------
test('soakNight: random seeded input (re-aim every 30 ticks, 5% jump, 3% dash, 2% pulse, 10% interact) runs a night to its end', () => {
  const r = soakNight(T, 1, 7);
  assert.ok(['won', 'lost'].includes(r.result)); assert.ok(r.ticks > 0 && r.ticks <= 240 * 60);
  assert.deepEqual(soakNight(T, 1, 7), r, 'deterministic per seed');
  const st = r.inputStats;   // observed press rates over the night
  const rate = (k) => st[k] / st.ticks;
  assert.ok(Math.abs(rate('jump') - 0.05) < 0.01 && Math.abs(rate('dash') - 0.03) < 0.01 && Math.abs(rate('pulse') - 0.02) < 0.01 && Math.abs(rate('interact') - 0.10) < 0.015, JSON.stringify(st));
  assert.equal(st.reaims, Math.ceil(st.ticks / 30));
});

test('soak CLI: 10 nights cycling 1->2->3 with seeds 7..16, output schema, 0 crashes, memory within 1.2x', () => {
  const dir = tmp(), out = join(dir, 'soak.json');
  const [cmd, ...args] = CONTRACT.soak_cmd.split(' ');
  execFileSync(cmd, [...args, '--seed', '7', '--nights', '10', '--out', out], { encoding: 'utf8' });   // exactly the contract command
  const j = JSON.parse(readFileSync(out, 'utf8'));
  assert.deepEqual(Object.keys(j).sort(), ['crashes', 'duration_s', 'mem_end_mb', 'mem_start_mb', 'nights', 'results'].sort());
  assert.equal(j.nights, 10); assert.equal(j.crashes, 0); assert.equal(j.results.length, 10);
  assert.ok(j.results.every(r => r === 'won' || r === 'lost'));
  assert.ok(j.mem_end_mb <= 1.2 * j.mem_start_mb, `${j.mem_end_mb} vs ${j.mem_start_mb}`);
  // same nights/seeds as the pure function
  for (let i = 0; i < 10; i++) assert.equal(j.results[i], soakNight(T, (i % 3) + 1, 7 + i).result, `night index ${i}`);
});

// ---------- leaderboard on disk via server ----------
test('export: node server.js --export-leaderboard out.json writes {"entries":[...]} in order', () => {
  const dir = tmp(), file = join(dir, 'lb.json'), out = join(dir, 'out.json');
  writeFileSync(file, JSON.stringify({ entries: [
    { name: 'bbb', score: 50, nights_won: 1, achieved_at: '2026-11-20T10:00:00.000+07:00', seed: 1 },
    { name: 'aaa', score: 90, nights_won: 2, achieved_at: '2026-11-20T11:00:00.000+07:00', seed: 2 },
  ] }));
  execFileSync('node', ['server.js', '--export-leaderboard', out], { env: { ...process.env, DDL_LEADERBOARD: file }, encoding: 'utf8' });
  const j = JSON.parse(readFileSync(out, 'utf8'));
  assert.deepEqual(j.entries.map(e => e.name), ['aaa', 'bbb']);
});

test('server API: POST saves to disk, invalid names rejected (400), data survives a restart', async () => {
  const dir = tmp(), file = join(dir, 'lb.json'), port = 5300 + Math.floor(Math.random() * 500);
  const start = () => spawn(process.execPath, ['server.js'], { env: { ...process.env, PORT: String(port), DDL_LEADERBOARD: file }, stdio: 'ignore' });
  const waitUp = async () => { for (let i = 0; i < 50; i++) { try { await fetch(`http://localhost:${port}/api/leaderboard`); return; } catch { await sleep(100); } } };
  let srv = start(); await waitUp();
  try {
    const post = (b) => fetch(`http://localhost:${port}/api/leaderboard`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) });
    assert.equal((await post({ name: 'Mây', score: 1200, nights_won: 3, seed: 7 })).status, 200);
    assert.equal((await post({ name: 'x', score: 1, nights_won: 0, seed: 1 })).status, 400);
    assert.ok(existsSync(file));
  } finally { srv.kill(); await sleep(200); }
  srv = start(); await waitUp();
  try {
    const j = await (await fetch(`http://localhost:${port}/api/leaderboard`)).json();
    assert.equal(j.entries.length, 1); assert.equal(j.entries[0].name, 'Mây');
    assert.match(j.entries[0].achieved_at, /([+-]\d{2}:\d{2}|Z)$/);
  } finally { srv.kill(); await sleep(100); }
});

// ---------- accessibility (static checks on the UI source) ----------
test('UI text: no font-size below 18px in the stylesheet (1280x720)', () => {
  const html = readFileSync('src/web/index.html', 'utf8');
  const sizes = [...html.matchAll(/font-size:\s*([\d.]+)px/g)].map(m => +m[1]);
  assert.ok(sizes.length > 0 && sizes.every(px => px >= 18), `too small: ${sizes.filter(px => px < 18)}`);
});
