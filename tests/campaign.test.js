// Night chain + total score (Ticket-02 Part 3): lives in src/core so headless can verify it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCampaign } from '../src/core/campaign.js';
import { CONTRACT } from '../src/headless.js';
const T = CONTRACT.tuning;

test('campaign: starts at night 1; win -> next night; total = sum of won nights; lose -> retry same night', () => {
  const c = createCampaign(T, { seed: 1 });
  assert.equal(c.night, 1); assert.equal(c.total(), 0);
  assert.deepEqual(c.finishNight({ status: 'won', score: 900 }), { next: 'night', night: 2 });
  assert.equal(c.total(), 900);
  assert.deepEqual(c.finishNight({ status: 'lost', score: 300 }), { next: 'retry', night: 2 });
  assert.equal(c.total(), 900, 'lost night adds nothing');
  assert.deepEqual(c.finishNight({ status: 'won', score: 1000 }), { next: 'night', night: 3 });
  assert.deepEqual(c.finishNight({ status: 'won', score: 1100 }), { next: 'dawn', night: 3 });
  assert.equal(c.total(), 3000); assert.deepEqual(c.wonScores(), { 1: 900, 2: 1000, 3: 1100 });
});

test('campaign: newSim() builds the current night with full flames (refilled each night)', () => {
  const c = createCampaign(T, { seed: 3 });
  c.finishNight({ status: 'won', score: 1 });
  const sim = c.newSim();
  assert.equal(sim.state.night, 2); assert.equal(sim.state.player.flames, T.flames); assert.equal(sim.state.lanterns.length, 6);
});
