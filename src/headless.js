#!/usr/bin/env node
// Headless runner (no window, no three.js). Prints one JSON object to stdout.
//
// Usage:
//   node src/headless.js [--scenario <file.json | ->] [--seed N] [--bot] [--max-seconds S] [--events] [--out file]
//
// Scenario JSON (all fields optional):
//   { "seed": 1, "bot": false, "max_seconds": 300,
//     "steps": [ { "move": [x, z], "for": 2.0 },          // hold a world-space direction for N seconds
//                { "moveTo": [x, z], "timeout": 10 },     // walk straight to a point
//                { "action": "jump" | "pulse" | "interact" },
//                { "wait": 1.5 } ] }
// After the steps run out, the sim keeps running with no input (or the bot) until it ends or max_seconds.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createSim, botInput, DT } from './core/sim.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const CONTRACT = JSON.parse(readFileSync(join(ROOT, 'game.contract.json'), 'utf8'));

export function runScenario(scn = {}, tuning = CONTRACT.tuning) {
  const seed = scn.seed ?? 1;
  const sim = createSim(tuning, { seed });
  const s = sim.state;
  const maxTicks = Math.round((scn.max_seconds ?? tuning.night1_duration_s + 1) / DT);
  const log = [];
  const tick = (inp) => {
    sim.step(inp);
    if (scn.events) for (const e of s.events) log.push({ t: +s.t.toFixed(3), ...e });
    return s.status === 'playing' && s.tick < maxTicks;
  };
  run: for (const st of scn.steps ?? []) {
    if (st.move) { for (let i = Math.round(st.for / DT); i > 0; i--) if (!tick({ mx: st.move[0], mz: st.move[1] })) break run; }
    else if (st.moveTo) {
      for (let i = Math.round((st.timeout ?? 30) / DT); i > 0; i--) {
        const dx = st.moveTo[0] - s.player.x, dz = st.moveTo[1] - s.player.z;
        if (Math.hypot(dx, dz) < 0.1) break;
        if (!tick({ mx: dx, mz: dz })) break run;
      }
    }
    else if (st.action) { if (!tick({ [st.action]: true })) break run; }
    else if (st.wait) { for (let i = Math.round(st.wait / DT); i > 0; i--) if (!tick({})) break run; }
  }
  while (s.status === 'playing' && s.tick < maxTicks) tick(scn.bot ? botInput(sim, tuning) : {});

  const sc = sim.score();
  const out = {
    contract_version: CONTRACT.contract_version,
    team: CONTRACT.team,
    seed,
    result: s.status === 'won' ? 'win' : s.status === 'lost' ? 'lose' : 'running',
    lose_reason: s.loseReason,
    time_s: +s.t.toFixed(3),
    time_left_s: +s.timeLeft.toFixed(3),
    ticks: s.tick,
    score: sc.total,
    score_breakdown: sc,
    lanterns_lit: s.stats.lanternsLit,
    lantern_count: s.lanterns.length,
    lantern_charge: s.lanterns.map(l => l.charge),
    flames: s.player.flames,
    carried: s.player.carried,
    motes_collected: s.stats.motesCollected,
    stuns: s.stats.stuns,
    hits: s.stats.hits,
    pulses: s.stats.pulses,
    player: { x: +s.player.x.toFixed(3), z: +s.player.z.toFixed(3) },
  };
  if (scn.events) out.events = log;
  return out;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const a = process.argv.slice(2), scn = {};
  let outFile = null;
  for (let i = 0; i < a.length; i++) {
    const k = a[i];
    if (k === '--scenario') { const f = a[++i]; Object.assign(scn, JSON.parse(readFileSync(f === '-' ? 0 : f, 'utf8'))); }
    else if (k === '--seed') scn.seed = Number(a[++i]);
    else if (k === '--bot') scn.bot = true;
    else if (k === '--max-seconds') scn.max_seconds = Number(a[++i]);
    else if (k === '--events') scn.events = true;
    else if (k === '--out') outFile = a[++i];
    else if (k === '--help') { console.log(readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 14).join('\n')); process.exit(0); }
    else { console.error(`unknown arg: ${k}`); process.exit(2); }
  }
  const json = JSON.stringify(runScenario(scn));
  if (outFile) writeFileSync(outFile, json + '\n');
  console.log(json);
}
