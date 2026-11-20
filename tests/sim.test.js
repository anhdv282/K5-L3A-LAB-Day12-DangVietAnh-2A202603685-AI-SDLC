import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createSim, botInput, DT, ISLAND_RADIUS } from '../src/core/sim.js';
import { runScenario, CONTRACT } from '../src/headless.js';
import { execFileSync } from 'node:child_process';

const T = CONTRACT.tuning;
const ticks = (s) => Math.round(s / DT);
// Sim with no shades, so mechanics can be tested in isolation.
const calm = (seed = 1, tuning = T) => { const sim = createSim(tuning, { seed }); sim.state.shades.length = 0; sim.state.shadeTimer = -1e9; return sim; };

test('contract: required tuning keys present, 5 lanterns', () => {
  for (const k of ['player_speed','carry_capacity','lantern_cost','pickup_radius','interact_radius','pulse_cost','pulse_radius',
    'night1_duration_s','flames','invuln_s','hit_drop_ratio','pulse_stun_s','pulse_push_m','pulse_cooldown_s','safe_radius',
    'shade_speed','shade_hit_radius','fall_enabled']) assert.ok(k in T, k);
  assert.equal(T.lantern_count_night1, 5);
  assert.equal(createSim(T).state.lanterns.length, 5);
});

test('movement uses player_speed and stays on island when fall disabled', () => {
  const sim = calm();
  for (let i = 0; i < ticks(1); i++) sim.step({ mx: 1, mz: 0 });
  assert.ok(Math.abs(sim.state.player.x - T.player_speed) < 1e-6);
  for (let i = 0; i < ticks(20); i++) sim.step({ mx: 1, mz: 0 });
  assert.ok(Math.hypot(sim.state.player.x, sim.state.player.z) <= ISLAND_RADIUS);
});

test('jump goes up then lands', () => {
  const sim = calm(); sim.step({ jump: true });
  let maxY = 0; for (let i = 0; i < ticks(2); i++) { sim.step({}); maxY = Math.max(maxY, sim.state.player.y); }
  assert.ok(maxY > 1); assert.equal(sim.state.player.y, 0);
});

test('pickup within pickup_radius, capped by carry_capacity', () => {
  const sim = calm(); const s = sim.state;
  s.motes = Array.from({ length: 15 }, (_, i) => ({ id: 1000 + i, x: 0.1 * (i % 3), z: 0 }));
  sim.step({});
  assert.equal(s.player.carried, T.carry_capacity);
  assert.equal(s.stats.motesCollected, T.carry_capacity);
});

test('interact feeds light; lantern lights at lantern_cost; partial deposit kept', () => {
  const sim = calm(); const s = sim.state, l = s.lanterns[0];
  s.player.x = l.x; s.player.z = l.z + T.interact_radius - 0.1; s.player.carried = 3;
  sim.step({ interact: true });
  assert.equal(l.charge, 3); assert.equal(l.lit, false);
  s.player.carried = 4; sim.step({ interact: true });
  assert.equal(l.lit, true); assert.equal(s.player.carried, 4 - (T.lantern_cost - 3));
});

test('interact out of range does nothing', () => {
  const sim = calm(); const s = sim.state;
  s.player.carried = 5; sim.step({ interact: true });     // player at centre, lanterns 18 m away
  assert.equal(s.player.carried, 5); assert.ok(s.lanterns.every(l => l.charge === 0));
});

test('pulse costs light, stuns + pushes shades in radius, respects cooldown', () => {
  const sim = calm(); const s = sim.state;
  s.player.carried = 10;
  s.shades.push({ id: 1, x: 3, z: 0, stun: 0 }, { id: 2, x: 20, z: 0, stun: 0 });
  sim.step({ pulse: true });
  assert.equal(s.player.carried, 10 - T.pulse_cost);
  assert.ok(s.shades[0].stun > 0 && Math.abs(s.shades[0].x - (3 + T.pulse_push_m)) < 1e-6);
  assert.equal(s.shades[1].stun, 0);
  assert.equal(s.stats.stuns, 1);
  sim.step({ pulse: true });                                  // still on cooldown
  assert.equal(s.player.carried, 10 - T.pulse_cost);
});

test('pulse with not enough light fails', () => {
  const sim = calm(); sim.state.player.carried = T.pulse_cost - 1;
  sim.step({ pulse: true });
  assert.equal(sim.state.stats.pulses, 0);
});

test('shade touch: lose 1 flame, drop hit_drop_ratio of light, invulnerable for invuln_s', () => {
  const sim = calm(); const s = sim.state;
  s.player.carried = 8; s.shades.push({ id: 1, x: 0.2, z: 0, stun: 0 });
  sim.step({});
  assert.equal(s.player.flames, T.flames - 1);
  assert.equal(s.player.carried, 8 - Math.floor(8 * T.hit_drop_ratio));
  for (let i = 0; i < ticks(T.invuln_s) - 2; i++) sim.step({});
  assert.equal(s.player.flames, T.flames - 1);
});

test('shades cannot enter safe_radius of a lit lantern', () => {
  const sim = calm(); const s = sim.state, l = s.lanterns[0];
  l.lit = true; l.charge = T.lantern_cost;
  s.player.x = l.x; s.player.z = l.z;
  s.shades.push({ id: 1, x: l.x + 10, z: l.z, stun: 0 });
  for (let i = 0; i < ticks(10); i++) sim.step({});
  assert.ok(Math.hypot(s.shades[0].x - l.x, s.shades[0].z - l.z) >= T.safe_radius - 1e-6);
  assert.equal(s.player.flames, T.flames);
});

test('lose when flames reach 0; lose when time runs out', () => {
  assert.equal(runScenario({ seed: 1 }).lose_reason, 'flames');
  const sim = calm(); for (let i = 0; i < ticks(T.night1_duration_s) + 2; i++) sim.step({});
  assert.equal(sim.state.status, 'lost'); assert.equal(sim.state.loseReason, 'time');
});

test('win when all 5 lanterns lit; score formula', () => {
  const r = runScenario({ seed: 1, bot: true });
  assert.equal(r.result, 'win'); assert.equal(r.lanterns_lit, 5);
  const sc = T.score;
  const expected = r.motes_collected * sc.per_mote + 5 * sc.per_lantern + r.stuns * sc.per_stun
    + Math.floor(r.time_left_s) * sc.per_second_left + r.flames * sc.per_flame_left;
  assert.equal(r.score, expected);
});

test('determinism: same seed + inputs => identical output; different seed differs', () => {
  for (const seed of [1, 2, 42]) assert.deepEqual(runScenario({ seed, bot: true, events: true }), runScenario({ seed, bot: true, events: true }));
  assert.notDeepEqual(runScenario({ seed: 1, bot: true }), runScenario({ seed: 2, bot: true }));
});

test('bot wins across several seeds (game is completable)', () => {
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) assert.equal(runScenario({ seed, bot: true }).result, 'win', `seed ${seed}`);
});

test('CLI: scenario files produce valid JSON, identical across two runs', () => {
  for (const f of ['win_bot', 'idle_lose', 'walk_jump_pulse']) {
    const run = () => execFileSync('node', ['src/headless.js', '--scenario', `scenarios/${f}.json`], { encoding: 'utf8' });
    const a = run(); assert.equal(a, run());
    const j = JSON.parse(a); assert.ok(['win', 'lose', 'running'].includes(j.result));
  }
});
