// Phase 1 regression, re-expressed with Ticket-02 standard numbers.
// Replaced Phase-1 rules (see docs/notes/phase2.md "Test cũ bị thay"): island radius, lantern cost 10, pulse 3/5m/3s,
// score per mote DEPOSITED (not picked), +5 per pulse hit, fall enabled, lose reasons no_flames/dawn, jump no longer dodges.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createSim } from '../src/core/sim.js';
import { runScenario, CONTRACT } from '../src/headless.js';

const T = CONTRACT.tuning;
const calm = { spawn_shades: false, spawn_motes: false, random_drifters: false, wind_enabled: false };
const sim1 = (scenario = {}) => createSim(T, { night: 1, seed: 1, scenario: { ...calm, ...scenario } });
const run = (n, f) => { for (let i = 0; i < n; i++) f(); };

test('contract 1.1: standard tuning values', () => {
  assert.equal(CONTRACT.contract_version, '1.1');
  const want = { player_speed: 6, carry_capacity: 10, lantern_cost: 10, lantern_count_night1: 5, pickup_radius: 1, interact_radius: 2,
    pulse_cost: 3, pulse_radius: 5, night1_duration_s: 300, night2_duration_s: 330, night3_duration_s: 360, flames: 3, invuln_s: 1.5,
    hit_drop_ratio: 0.5, pulse_stun_s: 2, pulse_push_m: 4, pulse_cooldown_s: 3, safe_radius: 6, shade_speed: 4, shade_hit_radius: 1,
    fall_enabled: true, dash_speed: 14, dash_duration_s: 0.2, dash_cooldown_s: 1.5 };
  for (const [k, v] of Object.entries(want)) assert.equal(T[k], v, k);
  assert.deepEqual(T.score, { per_mote: 10, per_lantern: 100, per_stun: 5, per_second_left: 2, per_flame_left: 50 });
});

test('night 1 map: 5 lanterns at standard positions, start (0,0,0) facing +Z, 20 motes on spawn points', () => {
  const s = createSim(T, { night: 1 }); const snap = s.snapshot();
  assert.deepEqual(snap.lanterns.map(l => l.pos), [[0, 0, 25], [23.8, 0, 7.7], [14.7, 0, -20.2], [-14.7, 0, -20.2], [-23.8, 0, 7.7]]);
  assert.deepEqual(snap.player.pos, [0, 0, 0]); assert.equal(snap.player.facing_deg, 90);
  assert.equal(snap.motes.length, 20); assert.equal(new Set(snap.motes.map(m => m.pos.join())).size, 20);
});

test('run: reaches 6 m/s within 6 ticks (0.1 s) and stops within 6 ticks', () => {
  const s = sim1(); run(6, () => s.step({ move: [1, 0] }));
  assert.equal(s.state.player.vel[0], 6);
  run(6, () => s.step({})); assert.equal(s.state.player.vel[0], 0);
});

test('jump: 7 m/s, gravity 20, only when grounded (no double jump)', () => {
  const s = sim1(); s.step({ jump: true }); s.step({}); s.step({ jump: true });
  let maxY = 0; run(120, () => { s.step({}); maxY = Math.max(maxY, s.state.player.pos[1]); });
  assert.ok(Math.abs(maxY - 7 * 7 / 40) < 0.15, `apex ${maxY}`);   // v^2 / 2g = 1.225 m
  assert.equal(s.state.player.pos[1], 0); assert.equal(s.state.player.grounded, true);
  assert.equal(s.state.events.length, 0);
});

test('pickup: XZ <= 1.0 and height diff <= 1.5, capped at 10', () => {
  const motes = [...Array(12)].map((_, i) => ({ pos: [0.3, 0, 0.05 * i] })).concat([{ pos: [1.2, 0, 0] }]);
  const s = sim1({ motes }); s.step({});
  assert.equal(s.state.player.carried, 10);
  assert.equal(s.state.motes.length, 3);
});

test('interact: radius 2.0, feeds min(carried, missing), lantern remembers progress, lights at 10', () => {
  const s = sim1({ player: { pos: [0, 0, 23.1], carried: 6 } });
  s.step({ interact: true }); assert.equal(s.state.lanterns[0].charge, 6);
  s.step({}); s.state.player.carried = 7; s.step({ interact: true });
  assert.equal(s.state.lanterns[0].lit, true); assert.equal(s.state.player.carried, 3);
  assert.equal(s.score().total, 10 * 10 + 100);   // +10 per mote deposited, +100 per lantern
  const far = sim1({ player: { pos: [0, 0, 22.9], carried: 5 } }); far.step({ interact: true });
  assert.equal(far.state.player.carried, 5);
});

test('shade touch: -1 flame, drop floor(carried/2) as dropped motes (ring 1.5–2.5 m, ttl 480), invuln 90 ticks', () => {
  const s = sim1({ player: { carried: 7 }, shades: [{ id: 'S1', pos: [0.5, 0, 0], state: 'chase' }] });
  s.step({});
  const p = s.state.player, ev = s.state.events.find(e => e.type === 'player_hit');
  assert.deepEqual([p.flames, p.carried, p.invuln, ev.dropped], [2, 4, 90, 3]);
  const dropped = s.snapshot().motes.filter(m => m.kind === 'dropped');
  assert.equal(dropped.length, 3);
  for (const m of dropped) { const r = Math.hypot(m.pos[0], m.pos[2]); assert.ok(r >= 1.5 - 1e-6 && r <= 2.5 + 1e-6); assert.equal(m.ttl_s, 8); }
});

test('lose no_flames; lose dawn when time runs out', () => {
  const s = sim1({ player: { flames: 1 }, shades: [{ id: 'S1', pos: [0.2, 0, 0], state: 'chase' }] }); s.step({});
  assert.deepEqual([s.state.status, s.state.reason], ['lost', 'no_flames']);
  const r = runScenario({ ...calm, night: 1, ticks: 20000 });
  assert.deepEqual([r.result, r.reason, r.sim_ticks], ['lose', 'dawn', 18000]);
});

test('determinism: same scenario twice => identical output (all 3 nights)', () => {
  for (const night of [1, 2, 3]) assert.deepEqual(runScenario({ night, seed: 5, bot: true, ticks: 4000 }), runScenario({ night, seed: 5, bot: true, ticks: 4000 }));
});

test('autopilot can win night 1 (game completable)', () => {
  assert.equal(runScenario({ night: 1, seed: 1, bot: true, snapshot_every: 0 }).result, 'win');
});

test('CLI: scenario files run, output JSON with contract fields, identical across runs', () => {
  for (const f of ['p2_dash', 'p2_drifter', 'p2_pause']) {
    const go = () => execFileSync('node', ['src/headless.js', '--scenario', `scenarios/${f}.json`], { encoding: 'utf8' });
    const a = go(); assert.equal(a, go());
    const j = JSON.parse(a);
    assert.equal(j.contract_version, '1.1');
    for (const k of ['night', 'wind', 'player', 'motes', 'drifters', 'charms', 'shades', 'lanterns']) assert.ok(k in j.final, k);
    for (const k of ['vel', 'grounded', 'invuln', 'dash_cd_s', 'pulse_cd_s', 'charm_s']) assert.ok(k in j.final.player, k);
  }
});

// ---- game.contract.json is the Test Contract: every tuning key must drive the game ----
test('contract sync: every tuning key is read by the logic', async () => {
  const { readFileSync } = await import('node:fs');
  const src = readFileSync('src/core/sim.js', 'utf8');
  for (const k of Object.keys(T)) {
    const used = src.includes(`T.${k}`) || (/^night\d_duration_s$/.test(k) && src.includes('T[`night${night}_duration_s`]'));
    assert.ok(used, `tuning.${k} is not used by src/core/sim.js`);
  }
});

test('contract sync: changing tuning values changes behaviour (invuln_s, fall_enabled, lantern_count_night1, flames)', () => {
  const mk = (over, scn) => createSim({ ...T, ...over }, { night: 1, seed: 1, scenario: { ...calm, ...scn } });
  const a = mk({ invuln_s: 0.5 }, { shades: [{ id: 'S1', pos: [0.3, 0, 0], state: 'chase' }] }); a.step({});
  assert.equal(a.state.player.invuln, 30);
  const noFall = mk({ fall_enabled: false }, { player: { pos: [39.5, 0, 0] } });
  for (let i = 0; i < 120; i++) noFall.step({ move: [1, 0] });
  assert.equal(noFall.state.player.flames, 3); assert.ok(noFall.state.player.pos[1] === 0);
  assert.throws(() => mk({ lantern_count_night1: 4 }), /lantern_count_night1/);
  assert.equal(mk({ flames: 5 }).state.player.flames, 5);
});

test('contract sync: commands in game.contract.json are runnable', async () => {
  const { readFileSync } = await import('node:fs');
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
  assert.equal(CONTRACT.build_cmd, 'npm install');
  assert.equal(CONTRACT.run_cmd, 'npm start'); assert.ok(pkg.scripts.start);
  const [cmd, ...args] = CONTRACT.headless_cmd.split(' ');
  const out = JSON.parse(execFileSync(cmd, [...args, '--night', '1', '--ticks', '10'], { encoding: 'utf8' }));
  assert.equal(out.contract_version, CONTRACT.contract_version); assert.equal(out.team, CONTRACT.team);
});
