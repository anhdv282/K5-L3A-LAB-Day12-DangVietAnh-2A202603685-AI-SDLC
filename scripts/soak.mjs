#!/usr/bin/env node
// Soak test (Ticket-04 §2). Usage: node --expose-gc scripts/soak.mjs --seed 7 --nights 10 --out soak.json
// Night i (0-based) plays Night (i % 3) + 1 with seed (seed + i), in this one process, with seeded random input.
import { readFileSync, writeFileSync } from 'node:fs';
import { soakNight } from '../src/core/soak.js';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const seed = Number(arg('--seed', 7)), nights = Number(arg('--nights', 10)), out = arg('--out', 'soak.json');
const T = JSON.parse(readFileSync(new URL('../game.contract.json', import.meta.url), 'utf8')).tuning;
const gc = () => { if (global.gc) { global.gc(); global.gc(); } };
const rssMb = () => Math.round(process.memoryUsage().rss / 1048576 * 10) / 10;

const t0 = process.hrtime.bigint();
const results = []; let crashes = 0, memStart = null;
for (let i = 0; i < nights; i++) {
  try {
    // mem_start: RSS after the first night has been loaded (sim created, before playing)
    const r = soakNight(T, (i % 3) + 1, seed + i, i === 0 ? () => { gc(); memStart = rssMb(); } : undefined);
    results.push(r.result);
  } catch (e) {
    crashes++; results.push('crashed');
    console.error(`night ${i}: ${e.stack}`);
  }
}
gc();   // reset after the last night: no sim is referenced any more
const memEnd = rssMb();
const report = { nights, crashes, results, mem_start_mb: memStart, mem_end_mb: memEnd, duration_s: Math.round(Number(process.hrtime.bigint() - t0) / 1e8) / 10 };
writeFileSync(out, JSON.stringify(report) + '\n');
console.log(JSON.stringify(report));
if (!global.gc) console.error('note: run with --expose-gc (soak_cmd does) for stable memory numbers');
