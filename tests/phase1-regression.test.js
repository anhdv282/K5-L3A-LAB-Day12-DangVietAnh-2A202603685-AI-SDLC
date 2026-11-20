// Regression: Phase 1 headless scenarios (copied verbatim from tag phase-1) must still run on the current code,
// with Phase 1 CLI flags, Phase 1 scenario format ("steps") and Phase 1 output fields — evaluated with standard numbers.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';

const run = (...args) => JSON.parse(execFileSync('node', ['src/headless.js', ...args], { encoding: 'utf8' }));
const P1_FIELDS = { contract_version: 'string', team: 'string', seed: 'number', result: 'string', time_s: 'number', time_left_s: 'number',
  ticks: 'number', score: 'number', score_breakdown: 'object', lanterns_lit: 'number', lantern_count: 'number', lantern_charge: 'object',
  flames: 'number', carried: 'number', motes_collected: 'number', stuns: 'number', hits: 'number', pulses: 'number', player: 'object' };

test('phase 1 fixtures: every scenario runs, has all Phase 1 output fields, deterministic', () => {
  const files = readdirSync('tests/fixtures/phase1');
  assert.equal(files.length, 3);
  for (const f of files) {
    const a = run('--scenario', `tests/fixtures/phase1/${f}`), b = run('--scenario', `tests/fixtures/phase1/${f}`);
    assert.deepEqual(a, b, `${f} not deterministic`);
    for (const [k, t] of Object.entries(P1_FIELDS)) assert.equal(typeof a[k], t, `${f}: field ${k}`);
    assert.ok('lose_reason' in a, `${f}: lose_reason`);
    assert.ok(['win', 'lose', 'running'].includes(a.result));
    assert.equal(typeof a.player.x, 'number'); assert.equal(typeof a.player.z, 'number');
  }
});

// [Ticket-03] "win = all 5 lit" was replaced by "alive at dawn with >= 3/5 lit"; lose_reason is null on a win, reason dawn_survived.
test('phase 1 win_bot: autopilot still wins Night 1 (seed 1) under the current rules', () => {
  const r = run('--scenario', 'tests/fixtures/phase1/win_bot.json');
  assert.equal(r.result, 'win'); assert.ok(r.lanterns_lit >= 3); assert.equal(r.reason, 'dawn_survived'); assert.equal(r.lose_reason, null);
});

// [Ticket-03] wandering shades now head for lanterns instead of roaming (Ticket-03 §2), so an idle Mây in the centre is
// no longer always caught. The Phase 1 intent "doing nothing loses" still holds: 0 lanterns lit at dawn => lose (dawn).
test('phase 1 idle_lose: doing nothing still loses (no_flames or, since Ticket-03, dawn with 0 lanterns lit)', () => {
  const r = run('--scenario', 'tests/fixtures/phase1/idle_lose.json');
  assert.equal(r.result, 'lose'); assert.ok(['no_flames', 'dawn'].includes(r.lose_reason)); assert.equal(r.lanterns_lit, 0);
});

test('phase 1 walk_jump_pulse: "steps" are executed (move, jump, pulse with no light, moveTo), events listed', () => {
  const r = run('--scenario', 'tests/fixtures/phase1/walk_jump_pulse.json');
  const types = r.events.map(e => e.type);
  assert.ok(types.includes('jump'), 'jump step executed');
  assert.ok(types.includes('pulse_fail'), 'pulse with 0 light reports pulse_fail');
  assert.ok(r.time_s <= 6.001, 'max_seconds respected');
  assert.ok(Math.abs(r.player.x) < 0.5 && r.player.z > 8, `moveTo [0,18] executed (at ${r.player.x},${r.player.z})`);
});

test('phase 1 CLI flags still work: --seed --bot --max-seconds --events --out', () => {
  const r = run('--seed', '2', '--bot', '--max-seconds', '3', '--events');
  assert.equal(r.seed, 2); assert.ok(r.time_s <= 3.001); assert.ok(Array.isArray(r.events));
});

test('phase 1 event names kept where Ticket-02 does not rename them: pickup, deposit, lantern_lit, pulse, shade_spawn, win, lose', () => {
  const r = run('--seed', '1', '--bot', '--events');
  const types = new Set(r.events.map(e => e.type));
  for (const t of ['pickup', 'deposit', 'lantern_lit', 'shade_spawn', 'win']) assert.ok(types.has(t), t);
});
