// Ticket-03 "Đèn cạn dầu" (Contract v1.2). Written BEFORE the implementation (see docs/proof/phase3/tdd-red.txt).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSim } from '../src/core/sim.js';
import { runScenario, CONTRACT } from '../src/headless.js';

const T = CONTRACT.tuning;
const calm = { spawn_shades: false, spawn_motes: false, random_drifters: false, wind_enabled: false, motes: [] };
const mk = (night, scenario = {}) => createSim(T, { night, seed: 1, scenario: { ...calm, ...scenario } });
const run = (n, f) => { for (let i = 0; i < n; i++) f(); };
const near = (a, b, e = 1e-6) => Math.abs(a - b) <= e;
const L1 = [0, 0, 25];
const at = (dz = -1.5) => [L1[0], 0, L1[2] + dz];   // standing next to L1
const fuelOf = (sim, i = 0) => sim.snapshot().lanterns[i].fuel;

test('contract 1.2: new tuning keys and durations', () => {
  assert.equal(CONTRACT.contract_version, '1.2');
  const want = { fuel_max: 100, fuel_decay_per_s: 1, fuel_per_mote: 10, relight_cost: 5, win_ratio: 0.6, drain_per_s: 5,
    low_fuel_threshold: 30, capacity_max: 20, night1_duration_s: 240, night2_duration_s: 270, night3_duration_s: 300 };
  for (const [k, v] of Object.entries(want)) assert.equal(T[k], v, k);
});

test('fuel: lit lantern starts at 100 and decays 1/s; snapshot fuel has 1 decimal', () => {
  const s = mk(1, { lanterns: [{ id: 'L1', lit: true }] });
  assert.equal(fuelOf(s), 100);
  run(600, () => s.step({})); assert.equal(fuelOf(s), 90);
  run(30, () => s.step({})); assert.equal(fuelOf(s), 89.5);
});

test('refuel: used = min(carried, ceil((100-fuel)/10)), +10 fuel each, +5 points each, event refuel', () => {
  const s = mk(1, { lanterns: [{ id: 'L1', lit: true, fuel: 55 }], player: { pos: at(), carried: 10 } });
  s.step({ interact: true });
  const e = s.state.events.find(x => x.type === 'refuel');
  assert.deepEqual([e.lantern_id, e.amount, s.state.player.carried], ['L1', 5, 5]);
  assert.ok(near(e.fuel, 100)); assert.equal(s.score().total, 25);
  const t = mk(1, { lanterns: [{ id: 'L1', lit: true, fuel: 55 }], player: { pos: at(), carried: 2 } });
  t.step({ interact: true }); assert.ok(near(fuelOf(t), 75, 0.05));
});

test('full lantern is not selectable: no event, no points, nothing spent (decay disabled to hold exactly 100)', () => {
  const g = createSim({ ...T, fuel_decay_per_s: 0 }, { night: 1, seed: 1, scenario: { ...calm, lanterns: [{ id: 'L1', lit: true, fuel: 100 }], player: { pos: at(), carried: 3 } } });
  g.step({ interact: true });
  assert.equal(g.state.player.carried, 3); assert.equal(g.state.events.filter(e => e.type !== 'night_start').length, 0); assert.equal(g.score().total, 0);
  // with normal decay, step 2 lowers 100 -> 99.98 before interact (step 5), so the lantern takes 1 mote
  const s = mk(1, { lanterns: [{ id: 'L1', lit: true, fuel: 100 }], player: { pos: at(), carried: 3 } });
  s.step({ interact: true }); assert.equal(s.state.player.carried, 2);
});

test('fuel runs out -> lantern_out, unlit, deposited 0, ever_lit true, fuel 0', () => {
  const s = mk(1, { lanterns: [{ id: 'L1', lit: true, fuel: 0.5 }] });
  let out = null; for (let i = 0; i < 40 && !out; i++) { s.step({}); out = s.state.events.find(e => e.type === 'lantern_out'); }
  assert.equal(out.lantern_id, 'L1'); assert.equal(out.tick, 30);
  const l = s.snapshot().lanterns[0];
  assert.deepEqual([l.lit, l.deposited, l.ever_lit, l.fuel], [false, 0, true, 0]);
});

test('first light: 10 motes, +100, relight=false, capacity 10 -> 12; relight: 5 motes, +40, relight=true, relit_count 1', () => {
  const s = mk(1, { player: { pos: at(), carried: 10 } });
  s.step({ interact: true });
  let e = s.state.events.find(x => x.type === 'lantern_lit');
  assert.equal(e.relight, false); assert.equal(s.snapshot().player.capacity, 12); assert.equal(s.score().total, 10 * 5 + 100);
  const r = mk(1, { lanterns: [{ id: 'L1', lit: false, ever_lit: true }], player: { pos: at(), carried: 7 } });
  r.step({ interact: true });
  e = r.state.events.find(x => x.type === 'lantern_lit');
  assert.equal(e.relight, true); assert.equal(r.state.player.carried, 2);
  const l = r.snapshot().lanterns[0]; assert.equal(l.relit_count, 1); assert.ok(l.fuel > 99.9);
  assert.equal(r.score().total, 5 * 5 + 40); assert.equal(r.snapshot().player.capacity, 12);
});

test('capacity = 10 + 2 x successful_lights, max 20; preset lanterns do not count', () => {
  const s = mk(1, { player: { successful_lights: 7 }, lanterns: [{ id: 'L2', lit: true }], motes: [...Array(25)].map(() => ({ pos: [0.2, 0, 0] })) });
  assert.equal(s.snapshot().player.capacity, 20);
  s.step({}); assert.equal(s.state.player.carried, 20);
  assert.equal(mk(1, { lanterns: [{ id: 'L1', lit: true }] }).snapshot().player.capacity, 10);
});

test('safe zone only while fuel >= 30 (exactly 30 still safe)', () => {
  const chaseTo = (fuel) => {
    const s = createSim({ ...T, fuel_decay_per_s: 0 }, { night: 1, seed: 1, scenario: { ...calm, lanterns: [{ id: 'L1', lit: true, fuel }], player: { pos: [0, 0, 25] }, shades: [{ id: 'S1', pos: [0, 0, 33], state: 'chase' }] } });
    run(120, () => s.step({})); return s;
  };
  const safe = chaseTo(30); assert.equal(safe.state.player.flames, 3);
  assert.ok(Math.hypot(safe.state.shades[0].pos[0], safe.state.shades[0].pos[2] - 25) >= 6 - 1e-6);
  const weak = chaseTo(29.9); assert.equal(weak.state.player.flames, 2, 'shade reached Mây inside a weak lantern');
});

test('wander shade targets the weak lantern, drains 5/s (stacking), lantern still decays 1/s, fuel_drain every 60 ticks', () => {
  const s = mk(1, { lanterns: [{ id: 'L1', lit: true, fuel: 25 }], player: { pos: [0, 0, -30] },
    shades: [{ id: 'S1', pos: [1.5, 0, 25], state: 'wander' }, { id: 'S2', pos: [-1.5, 0, 25], state: 'wander' }] });
  s.step({});
  assert.deepEqual(s.snapshot().shades.map(x => [x.state, x.target_lantern_id]), [['drain', 'L1'], ['drain', 'L1']]);
  const evs = []; run(60, () => { s.step({}); evs.push(...s.state.events); });
  assert.ok(near(fuelOf(s), 25 - 61 / 60 - 60 * 10 / 60, 0.06), `fuel ${fuelOf(s)}`);
  const d = evs.filter(e => e.type === 'fuel_drain');
  assert.deepEqual(d.map(e => e.shade_id).sort(), ['S1', 'S2']); assert.equal(d[0].lantern_id, 'L1');
});

test('wander shade walks toward a weak lantern from afar', () => {
  const s = mk(1, { lanterns: [{ id: 'L1', lit: true, fuel: 25 }], player: { pos: [0, 0, -30] }, shades: [{ id: 'S1', pos: [0, 0, 15], state: 'wander' }] });
  run(300, () => s.step({}));
  assert.equal(s.snapshot().shades[0].state, 'drain');
});

test('drain exits: Mây within 6 m -> chase; lantern out -> wander; refuel to >= 30 -> evicted to 6 m edge, wander, no damage', () => {
  const base = (extra) => mk(1, { lanterns: [{ id: 'L1', lit: true, fuel: 20 }], shades: [{ id: 'S1', pos: [1.5, 0, 25], state: 'drain', target_lantern_id: 'L1' }], ...extra });
  const a = base({ player: { pos: [0, 0, 20.5] } }); a.step({}); assert.equal(a.snapshot().shades[0].state, 'chase');
  const b = base({ player: { pos: [0, 0, -30] }, lanterns: [{ id: 'L1', lit: true, fuel: 0.05 }] }); run(5, () => b.step({}));
  assert.equal(b.snapshot().shades[0].state, 'wander');
  const c = base({ player: { pos: [-1.5, 0, 25], carried: 5 } });
  c.step({ interact: true }); assert.ok(fuelOf(c) >= 30);
  run(30, () => c.step({}));
  const sh = c.state.shades[0];
  assert.ok(Math.hypot(sh.pos[0], sh.pos[2] - 25) >= 6 - 1e-6); assert.equal(c.state.player.flames, 3);
  assert.notEqual(c.snapshot().shades[0].state, 'drain');
});

test('pulse: +15 total for a shade that was draining, +5 otherwise', () => {
  const s = mk(1, { lanterns: [{ id: 'L1', lit: true, fuel: 20 }], player: { pos: [0, 0, 21.5], carried: 6 },
    shades: [{ id: 'S1', pos: [1.5, 0, 25], state: 'drain', target_lantern_id: 'L1' }, { id: 'S2', pos: [-2, 0, 21.5], state: 'stunned', state_ticks_left: 100 }] });
  s.step({ pulse: true });
  assert.equal(s.score().total, 15 + 5);
  assert.equal(s.snapshot().shades[0].state, 'stunned');
});

test('no early win: all lanterns lit does not end the night', () => {
  const s = mk(1, { lanterns: ['L1', 'L2', 'L3', 'L4', 'L5'].map(id => ({ id, lit: true })) });
  run(10, () => s.step({})); assert.equal(s.state.status, 'playing');
});

test('dawn: win dawn_survived with >= ceil(0.6 n) lit (3/5, 4/6, 5/7); else lose dawn; dawn bonus', () => {
  const lit = (ids) => ids.map(id => ({ id, lit: true }));
  const s = mk(1, { lanterns: lit(['L1', 'L2', 'L3']), time_left_s: 1 / 60 }); s.step({});
  assert.deepEqual([s.state.status, s.state.reason], ['won', 'dawn_survived']);
  assert.equal(s.score().total, 3 * (50 + 99) + 3 * 50);   // fuel 99.98 -> floor 99
  const f = mk(1, { lanterns: lit(['L1', 'L2']), time_left_s: 1 / 60 }); f.step({});
  assert.deepEqual([f.state.status, f.state.reason], ['lost', 'dawn']); assert.equal(f.score().total, 0);
  for (const [night, need, ids] of [[2, 4, ['L1', 'L2', 'L3', 'L4', 'L5', 'L6']], [3, 5, ['L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7']]]) {
    const ok = mk(night, { lanterns: lit(ids.slice(0, need)), time_left_s: 1 / 60 }); ok.step({}); assert.equal(ok.state.status, 'won', `night ${night}`);
    const no = mk(night, { lanterns: lit(ids.slice(0, need - 1)), time_left_s: 1 / 60 }); no.step({}); assert.equal(no.state.reason, 'dawn', `night ${night}`);
  }
});

test('last tick: running out of flames beats dawn_survived', () => {
  const s = mk(1, { lanterns: ['L2', 'L3', 'L4'].map(id => ({ id, lit: true })), time_left_s: 1 / 60, player: { flames: 1 }, shades: [{ id: 'S1', pos: [0.3, 0, 0], state: 'chase' }] });
  s.step({}); assert.equal(s.state.reason, 'no_flames');
});

test('game_over event carries the reason; durations 240/270/300 s', () => {
  const r = runScenario({ ...calm, night: 1, ticks: 20000, snapshot_every: 0 });
  const go = r.events.find(e => e.type === 'game_over');
  assert.equal(go.reason, 'dawn'); assert.equal(r.sim_ticks, 240 * 60);
  assert.equal(createSim(T, { night: 2 }).snapshot().time_left_s, 270);
  assert.equal(createSim(T, { night: 3 }).snapshot().time_left_s, 300);
});

test('scenario/snapshot v1.2: lit without fuel => 100; ever_lit, relit_count, capacity, target_lantern_id present', () => {
  const r = runScenario({ ...calm, night: 1, ticks: 1, lanterns: [{ id: 'L2', lit: true }],
    shades: [{ id: 'S1', pos: [20, 0, 0], state: 'wander', target_lantern_id: 'L2' }], player: { successful_lights: 1 } });
  const l = r.final.lanterns.find(x => x.id === 'L2');
  assert.ok(l.fuel > 99.9 && l.ever_lit === true && l.relit_count === 0);
  assert.equal(r.final.player.capacity, 12);
  assert.ok('target_lantern_id' in r.final.shades[0]);
});

test('drain exit: shade pushed > 2 m from its lantern goes back to wander', () => {
  const s = mk(1, { lanterns: [{ id: 'L1', lit: true, fuel: 20 }], player: { pos: [0, 0, -30] }, shades: [{ id: 'S1', pos: [1.5, 0, 25], state: 'drain', target_lantern_id: 'L1' }] });
  s.state.shades[0].pos[0] = 3;   // displaced (e.g. by a push) to 3 m
  s.step({});
  assert.equal(s.snapshot().shades[0].state, 'wander');
});

test('chase shade keeps chasing (does not retarget a weak lantern next to it)', () => {
  const s = mk(1, { lanterns: [{ id: 'L1', lit: true, fuel: 20 }], player: { pos: [0, 0, 15] }, shades: [{ id: 'S1', pos: [1.5, 0, 25], state: 'chase' }] });
  run(10, () => s.step({}));
  assert.equal(s.snapshot().shades[0].state, 'chase');
});

test('relight with a preset deposit above the relight cost never takes motes back', () => {
  const s = mk(1, { lanterns: [{ id: 'L1', lit: false, ever_lit: true, deposited: 8 }], player: { pos: at(), carried: 2 } });
  s.step({ interact: true });
  assert.ok(s.state.player.carried <= 2); assert.equal(s.state.lanterns[0].lit, true);
});
