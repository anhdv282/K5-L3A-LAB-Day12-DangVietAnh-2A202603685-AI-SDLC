#!/usr/bin/env node
// Headless runner — Test Contract v1.1 (format INFERRED from Ticket-02; see docs/notes/phase2.md "Giả định").
// Prints one JSON object to stdout.
//
// Usage:
//   node src/headless.js [--night 1|2|3] [--scenario <file.json | ->] [--seed N] [--ticks N]
//                        [--snapshot-every K] [--bot] [--out file]
//
// Scenario JSON (all optional):
//   { "night": 1, "seed": 1, "ticks": 21600, "snapshot_every": 60, "bot": false,
//     "player":  { "pos":[x,y,z], "carried":n, "flames":n, "facing_deg":d,
//                  "invuln_ticks":n, "dash_cd_ticks":n, "pulse_cd_ticks":n, "charm_ticks":n },
//     "shades":  [ { "id":"S1", "pos":[x,y,z], "state":"wander", "state_ticks_left":0 } ],
//     "drifters":[ { "id":"D1", "pos":[x,y,z], "state":"idle", "stolen":0 } ],     // replaces default list
//     "charms":  [ { "id":"C1", "pos":[x,y,z], "available":true } ],               // replaces default list
//     "motes":   [ { "pos":[x,y,z], "kind":"random" } ],                           // replaces initial motes
//     "lanterns":[ { "id":"L1", "charge":5 } ],
//     "random_drifters": true, "wind_enabled": true, "spawn_shades": true, "spawn_motes": true,
//     "inputs":  [ { "tick":1, "move":[x,z], "jump":false, "interact":false, "pulse":false, "dash":false, "pause":false } ] }
// Each inputs entry holds from its tick until the next entry. Buttons fire on false -> true.
//
// Phase 1 compatibility (regression): "max_seconds"/--max-seconds, "events"/--events, and the Phase 1 "steps" list
//   [ {"move":[x,z],"for":s} | {"moveTo":[x,z],"timeout":s} | {"action":"jump|pulse|interact|dash"} | {"wait":s} ]
// are still accepted, and the output keeps the Phase 1 top-level fields (lose_reason, time_s, flames, player{x,z}, ...).
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createSim, botInput } from './core/sim.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const CONTRACT = JSON.parse(readFileSync(join(ROOT, 'game.contract.json'), 'utf8'));
export const MAX_TICKS = 21600;

export function runScenario(scn = {}, tuning = CONTRACT.tuning) {
  const night = scn.night ?? 1, seed = scn.seed ?? 1;
  const sim = createSim(tuning, { night, seed, scenario: scn });
  const s = sim.state;
  const maxTicks = Math.min(scn.ticks ?? (scn.max_seconds != null ? Math.round(scn.max_seconds * 60) : MAX_TICKS), MAX_TICKS * 2);
  const every = scn.snapshot_every ?? 60;
  const inputs = [...(scn.inputs ?? [])].sort((a, b) => a.tick - b.tick);
  const events = [], snapshots = [];
  let cur = {}, k = 0;
  const tick = (inp) => {
    sim.step(inp);
    events.push(...s.events);
    if (every > 0 && s.tick % every === 0) snapshots.push(sim.snapshot());
    return s.status === 'playing' && s.tick < maxTicks;
  };
  // Phase 1 "steps" (closed-loop: moveTo needs the current position each tick)
  run: for (const st of scn.steps ?? []) {
    if (st.move) { for (let i = Math.round(st.for * 60); i > 0; i--) if (!tick({ move: st.move })) break run; }
    else if (st.moveTo) {
      for (let i = Math.round((st.timeout ?? 30) * 60); i > 0; i--) {
        const dx = st.moveTo[0] - s.player.pos[0], dz = st.moveTo[1] - s.player.pos[2];
        if (Math.hypot(dx, dz) < 0.1) break;
        if (!tick({ move: [dx, dz] })) break run;
      }
    }
    else if (st.action) { if (!tick({ [st.action]: true })) break run; if (!tick({})) break run; }   // press + release
    else if (st.wait) { for (let i = Math.round(st.wait * 60); i > 0; i--) if (!tick({})) break run; }
  }
  while (s.status === 'playing' && s.tick < maxTicks) {
    const t = s.tick + 1;
    while (k < inputs.length && inputs[k].tick <= t) cur = inputs[k++];
    if (!tick(scn.bot ? botInput(sim, tuning) : cur)) break;
  }
  const final = sim.snapshot();
  const sc = sim.score();
  return {
    contract_version: CONTRACT.contract_version, team: CONTRACT.team, night, seed,
    result: s.status === 'won' ? 'win' : s.status === 'lost' ? 'lose' : 'running',
    reason: s.reason, score: sc.total, score_breakdown: sc,
    ticks: s.tick, sim_ticks: s.simTick,
    lanterns_lit: s.lanterns.filter(l => l.lit).length, lantern_count: s.lanterns.length,
    // Phase 1 fields (kept for regression)
    lose_reason: s.status === 'lost' ? s.reason : null, /* null on a win; `reason` carries dawn_survived */ time_s: +(s.simTick / 60).toFixed(3), time_left_s: final.time_left_s,
    lantern_charge: s.lanterns.map(l => l.charge), flames: s.player.flames, carried: s.player.carried,
    motes_collected: s.stats.picked, stuns: s.stats.pulseHits, hits: s.stats.hits, pulses: events.filter(e => e.type === 'pulse').length,
    player: { x: final.player.pos[0], z: final.player.pos[2] },
    events, snapshots, final,
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const a = process.argv.slice(2), scn = {}, cli = {};
  let outFile = null;
  for (let i = 0; i < a.length; i++) {
    const k = a[i];
    if (k === '--scenario') { const f = a[++i]; Object.assign(scn, JSON.parse(readFileSync(f === '-' ? 0 : f, 'utf8'))); }
    else if (k === '--night') cli.night = Number(a[++i]);
    else if (k === '--seed') cli.seed = Number(a[++i]);
    else if (k === '--ticks') cli.ticks = Number(a[++i]);
    else if (k === '--snapshot-every') cli.snapshot_every = Number(a[++i]);
    else if (k === '--bot') cli.bot = true;
    else if (k === '--max-seconds') cli.max_seconds = Number(a[++i]);
    else if (k === '--events') cli.events = true;   // Phase 1 flag; events are always included now
    else if (k === '--out') outFile = a[++i];
    else if (k === '--help') { console.log(readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 22).join('\n')); process.exit(0); }
    else { console.error(`unknown arg: ${k}`); process.exit(2); }
  }
  Object.assign(scn, cli);   // CLI flags override the scenario file
  if (![1, 2, 3].includes(scn.night ?? 1)) { console.error('--night must be 1, 2 or 3'); process.exit(2); }
  const json = JSON.stringify(runScenario(scn));
  if (outFile) writeFileSync(outFile, json + '\n');
  console.log(json);
}
