// Ticket-02 new features: one or more headless scenarios per feature.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSim } from '../src/core/sim.js';
import { groundHeight } from '../src/core/maps.js';
import { runScenario, CONTRACT } from '../src/headless.js';

const T = CONTRACT.tuning;
const calm = { spawn_shades: false, spawn_motes: false, random_drifters: false, wind_enabled: false, motes: [] };
const mk = (night, scenario = {}) => createSim(T, { night, seed: 1, scenario: { ...calm, ...scenario } });
const run = (n, f) => { for (let i = 0; i < n; i++) f(); };
const near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;

test('dash: 14 m/s for 12 ticks, cooldown 90 ticks from dash start, direction = facing when idle', () => {
  const s = mk(1); s.step({ dash: true });
  assert.ok(s.state.events.some(e => e.type === 'dash'));
  run(11, () => s.step({}));
  assert.ok(near(s.state.player.pos[2], 14 * 12 / 60), `z=${s.state.player.pos[2]}`);   // facing +Z, 2.8 m
  // cooldown: pressing again before tick 91 does nothing
  const s2 = mk(1); s2.step({ dash: true, move: [1, 0] }); let dashes = 1;
  for (let t = 2; t <= 91; t++) { s2.step({ dash: t % 2 === 0, move: [1, 0] }); dashes += s2.state.events.filter(e => e.type === 'dash').length; }
  assert.equal(dashes, 1);
  s2.step({ dash: false }); s2.step({ dash: true }); assert.ok(s2.state.events.some(e => e.type === 'dash'));
});

test('dash in the air keeps height; dash does not give invulnerability', () => {
  const s = mk(1); s.step({ jump: true }); run(10, () => s.step({}));
  const y0 = s.state.player.pos[1]; s.step({ dash: true }); const y1 = s.state.player.pos[1];
  run(5, () => s.step({})); assert.ok(near(s.state.player.pos[1], y1) && y1 > 0.5, `${y0} ${y1} ${s.state.player.pos[1]}`);
  const h = mk(1, { shades: [{ id: 'S1', pos: [0, 0, 1.5], state: 'chase' }] }); h.step({ dash: true }); run(4, () => h.step({}));
  assert.equal(h.state.player.flames, 2);
});

test('launch pad night 2: lands on the other island after ~1.4 s, movement keys do not override', () => {
  const s = mk(2, { player: { pos: [20, 0, 18] } });
  s.step({ move: [-1, 0] }); assert.ok(s.state.events.some(e => e.type === 'launch'));
  let t = 1; while (!s.state.player.grounded && t < 200) { s.step({ move: [-1, 0] }); t++; }
  const [x, y, z] = s.state.player.pos;
  assert.ok(t >= 80 && t <= 90, `flight ${t} ticks`);
  assert.ok(Math.hypot(x - 70, z) < 28 && y === 0, `landed ${x},${z}`);
});

test('launch pad night 3: from tier 1 (0,3,13) lands on tier 2 (Y=6)', () => {
  const s = mk(3, { player: { pos: [0, 3, 13] } });
  let t = 0; do { s.step({}); t++; } while (!s.state.player.grounded && t < 200);
  assert.equal(s.state.player.pos[1], 6); assert.ok(Math.hypot(s.state.player.pos[0], s.state.player.pos[2]) <= 8);
});

test('fall off island: once, -1 flame, lose all carried, wait 60 ticks, respawn at start with invuln 90', () => {
  const s = mk(1, { player: { pos: [39.5, 0, 0], carried: 4 } });
  let hit = null, t = 0;
  while (!hit && t < 300) { s.step({ move: [1, 0] }); t++; hit = s.state.events.find(e => e.type === 'player_hit'); }
  assert.deepEqual([hit.cause, hit.lost, hit.flames], ['fall', 4, 2]);
  assert.equal(s.state.player.carried, 0);
  run(59, () => s.step({ move: [1, 0] })); assert.ok(s.state.player.respawnWait === 1);
  s.step({}); assert.deepEqual(s.state.player.pos, [0, 0, 0]); assert.equal(s.state.player.invuln, 90);
  const last = mk(1, { player: { pos: [39.5, 0, 0], flames: 1 } }); t = 0;
  while (last.state.status === 'playing' && t < 300) { last.step({ move: [1, 0] }); t++; }
  assert.equal(last.state.reason, 'no_flames');
});

test('night 3 terrain: tiers, cliffs block walking up, ramps at 30°/150°, bell tower is solid', () => {
  assert.equal(groundHeight(3, 0, 5), 6); assert.equal(groundHeight(3, 0, 18), 3); assert.equal(groundHeight(3, 0, -18), 0);
  const a = 30 * Math.PI / 180; assert.ok(near(groundHeight(3, Math.cos(a) * 27, Math.sin(a) * 27), 1.5));
  const s = mk(3, { player: { pos: [0, 0, 30] } }); run(120, () => s.step({ move: [0, -1] }));
  assert.ok(s.state.player.pos[2] > 24 - 1e-6 && s.state.player.pos[1] === 0, 'blocked by tier-1 cliff');
  const r = mk(3, { player: { pos: [Math.cos(a) * 31, 0, Math.sin(a) * 31] } }); run(150, () => r.step({ move: [-Math.cos(a), -Math.sin(a)] }));
  assert.equal(r.state.player.pos[1], 3, 'climbed the ramp');
});

test('pulse: costs 3, needs >= 3, hits shades within 5 m (3D), stun 120, push 4 m over 15 ticks, +5 each, cooldown 3 s', () => {
  const sh = [{ id: 'S1', pos: [3, 0, 0], state: 'chase' }, { id: 'S2', pos: [0, 0, 5.5], state: 'wander' }];
  const s = mk(1, { player: { carried: 9 }, shades: sh }); s.step({ pulse: true });
  assert.deepEqual(s.state.events.find(e => e.type === 'pulse').shades_hit, ['S1']);
  assert.equal(s.state.player.carried, 6); assert.equal(s.score().total, 5);
  run(14, () => s.step({}));
  assert.ok(near(s.state.shades[0].pos[0], 7), `pushed to ${s.state.shades[0].pos[0]}`);
  assert.equal(s.snapshot().shades[0].state, 'stunned');
  s.step({ pulse: false }); s.step({ pulse: true }); assert.equal(s.state.player.carried, 6, 'cooldown');
  const poor = mk(1, { player: { carried: 2 }, shades: sh }); poor.step({ pulse: true });
  assert.equal(poor.state.player.carried, 2); assert.equal(poor.state.shades[0].state, 'chase');
});

test('shade states use contract names: spawning -> wander -> chase -> recoil, and stunned', () => {
  const s = createSim(T, { night: 1, seed: 2, scenario: { ...calm, spawn_shades: true } });
  const seen = new Set();
  run(300, () => s.step({}));
  for (const x of s.snapshot().shades) seen.add(x.state);
  assert.ok(seen.has('spawning'));
  run(61, () => s.step({})); for (const x of s.snapshot().shades) seen.add(x.state);
  assert.ok(seen.has('wander') || seen.has('chase'));
  const h = mk(1, { shades: [{ id: 'S1', pos: [0.5, 0, 0], state: 'chase' }] }); h.step({});
  assert.equal(h.snapshot().shades[0].state, 'recoil');
  for (const st of h.snapshot().shades.map(x => x.state)) assert.ok(['spawning', 'wander', 'chase', 'recoil', 'stunned'].includes(st));
});

test('safe zone: shade inside a newly lit lantern is evicted to the 6 m edge within 30 ticks without dealing damage', () => {
  const s = mk(1, { player: { pos: [0, 0, 23.5], carried: 10 }, shades: [{ id: 'S1', pos: [0, 0, 23.2], state: 'chase' }] });
  s.step({ interact: true }); assert.equal(s.state.lanterns[0].lit, true);
  run(30, () => s.step({}));
  const d = Math.hypot(s.state.shades[0].pos[0], s.state.shades[0].pos[2] - 25);
  assert.ok(d >= 6 - 1e-6, `dist ${d}`); assert.equal(s.state.player.flames, 3);
  run(120, () => s.step({}));   // shade stays outside, player safe
  assert.equal(s.state.player.flames, 3);
});

test('drifter: chases when carried >= 5 within 15 m, steals min(3, carried), flees 240 ticks then removed; no flame loss', () => {
  const s = mk(2, { player: { carried: 6 }, drifters: [{ id: 'D1', pos: [10, 1, 0] }] });
  let steal = null, t = 0;
  while (!steal && t < 200) { s.step({}); t++; steal = s.state.events.find(e => e.type === 'drifter_steal'); }
  assert.deepEqual([steal.drifter_id, steal.amount, steal.carried], ['D1', 3, 3]);
  assert.equal(s.state.player.flames, 3);
  run(240, () => s.step({})); assert.equal(s.snapshot().drifters[0].state, 'removed');
  const idle = mk(2, { player: { carried: 4 }, drifters: [{ id: 'D1', pos: [10, 1, 0] }] }); idle.step({});
  assert.equal(idle.snapshot().drifters[0].state, 'idle');
});

test('drifter + pulse: chase -> flee without stealing; flee with loot -> drops it (drifter_drop) and vanishes after 120 ticks', () => {
  const a = mk(2, { player: { carried: 6 }, drifters: [{ id: 'D1', pos: [3, 1, 0], state: 'chase' }] }); a.step({ pulse: true });
  assert.equal(a.snapshot().drifters[0].state, 'flee'); assert.equal(a.state.player.carried, 3);
  run(300, () => a.step({})); assert.equal(a.state.player.carried, 3, 'never stole');
  const b = mk(2, { player: { carried: 6 }, drifters: [{ id: 'D1', pos: [3, 1, 0], state: 'flee', stolen: 3, state_ticks_left: 200 }] });
  b.step({ pulse: true });
  assert.deepEqual(b.state.events.find(e => e.type === 'drifter_drop'), { tick: 1, type: 'drifter_drop', drifter_id: 'D1', amount: 3 });
  assert.equal(b.snapshot().motes.filter(m => m.kind === 'dropped').length, 3);
  run(119, () => b.step({})); assert.equal(b.snapshot().drifters[0].state, 'flee');
  b.step({}); assert.equal(b.snapshot().drifters[0].state, 'removed');   // gone 120 ticks after the pulse tick
});

test('charm: pick like a mote, 600 ticks, speed 7.2, dash without cooldown (press during dash ignored), respawn 2700', () => {
  const s = mk(2, { player: { pos: [34.2, 0, 0] } }); s.step({});
  assert.deepEqual(s.state.events.find(e => e.type === 'charm_picked'), { tick: 1, type: 'charm_picked', charm_id: 'C1', charm_ticks: 600 });
  run(10, () => s.step({ move: [0, 1] })); assert.ok(near(s.state.player.vel[2], 7.2));
  let dashes = 0; const press = (on) => { s.step({ dash: on, move: [0, 1] }); dashes += s.state.events.filter(e => e.type === 'dash').length; };
  press(true); press(false); press(true);                  // 2nd press during dash: ignored
  for (let i = 0; i < 12; i++) press(false); press(true);  // after dash ends: dash again, no cooldown
  assert.equal(dashes, 2);
  const c = s.snapshot().charms[0]; assert.equal(c.available, false); assert.ok(c.respawn_s > 44 && c.respawn_s <= 45);
});

test('wind (night 3): warning 2 s before, every 30 s for 5 s, pushes 2 m/s; disabled by wind_enabled=false', () => {
  const s = mk(3, { wind_enabled: true, player: { pos: [0, 0, -30], flames: 3 } });
  const evs = []; run(1800 + 300, () => { s.step({}); evs.push(...s.state.events); });
  const w = evs.find(e => e.type === 'wind_warning'), st = evs.find(e => e.type === 'wind_start'), en = evs.find(e => e.type === 'wind_end');
  assert.deepEqual([w.tick, st.tick, en.tick], [1680, 1800, 2100]);
  assert.ok(near(Math.hypot(s.state.player.pos[0], s.state.player.pos[2] + 30), 10, 0.2), 'pushed ~10 m');
  const off = mk(3, { wind_enabled: false }); const e2 = []; run(2000, () => { off.step({}); e2.push(...off.state.events); });
  assert.ok(!e2.some(e => e.type.startsWith('wind')));
});

test('pause: tick advances but sim_tick/time/cooldowns freeze; snapshot state "paused"; edge-triggered', () => {
  const r = runScenario({ ...calm, night: 1, ticks: 100, snapshot_every: 10, player: { pulse_cd_ticks: 50 },
    inputs: [{ tick: 1 }, { tick: 20, pause: true }, { tick: 25 }, { tick: 50, pause: true }, { tick: 51 }] });
  assert.deepEqual(r.events.filter(e => ['paused', 'resumed'].includes(e.type)).map(e => [e.type, e.tick]), [['paused', 20], ['resumed', 50]]);
  assert.equal(r.ticks, 100); assert.equal(r.sim_ticks, 70);
  assert.equal(r.snapshots.find(x => x.tick === 30).state, 'paused');
  assert.ok(near(r.final.time_left_s, 300 - 70 / 60, 1e-3));
  assert.equal(r.final.player.pulse_cd_s, 0);
});

test('win/lose order: all lanterns lit on the exact tick time runs out => win', () => {
  const lanterns = ['L2', 'L3', 'L4', 'L5'].map(id => ({ id, charge: 10 })).concat([{ id: 'L1', charge: 9 }]);
  const s = mk(1, { lanterns, time_left_s: 1 / 60, player: { pos: [0, 0, 23.5], carried: 1 } });
  s.step({ interact: true });
  assert.equal(s.state.status, 'won');
  assert.equal(s.score().total, 10 + 100 + 0 * 2 + 3 * 50);
});

test('night chain data: nights 2 and 3 load their maps (6 and 7 lanterns, charms, durations)', () => {
  const n2 = createSim(T, { night: 2 }).snapshot(), n3 = createSim(T, { night: 3 }).snapshot();
  assert.equal(n2.lanterns.length, 6); assert.equal(n3.lanterns.length, 7);
  assert.deepEqual(n2.charms.map(c => c.id), ['C1']); assert.deepEqual(n3.charms.map(c => c.id), ['C1', 'C2']);
  assert.equal(n2.time_left_s, 330); assert.equal(n3.time_left_s, 360);
  assert.equal(runScenario({ night: 2, ticks: 1 }).events[0].type, 'night_start');
});

test('performance: a full night (21,600 ticks) runs headless in <= 30 s', () => {
  const t0 = Date.now();
  const r = runScenario({ night: 3, seed: 1, ticks: 21600, snapshot_every: 60, player: { flames: 1e9 } });
  const ms = Date.now() - t0;
  assert.equal(r.ticks, 21600); assert.ok(ms <= 30000, `${ms} ms`);
});
