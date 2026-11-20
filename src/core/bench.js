// Benchmark scene + frame statistics (Ticket-04 §1). Pure logic; the browser page (src/web, ?bench) renders it.
import { createSim, mulberry32 } from './sim.js';

export const BENCH = { night: 1, shades: 200, motes: 100, lit: ['L1', 'L2', 'L3'], warmup_s: 3, cam: { r: 30, y: 15, lap_s: 15 }, islandR: 40 };

// Camera orbit: centre (0,0,0), radius 30, Y 15, start at angle 0 = (30,15,0), CCW seen from above (map convention x=r cos a, z=r sin a).
export function cameraAt(t) {
  const a = 2 * Math.PI * t / BENCH.cam.lap_s;
  return [BENCH.cam.r * Math.cos(a), BENCH.cam.y, BENCH.cam.r * Math.sin(a)];
}

// Uniform over the island disk (area-uniform), a little inside the edge.
function scatter(rng, n, rMax) {
  return Array.from({ length: n }, () => { const a = rng() * Math.PI * 2, r = rMax * Math.sqrt(rng()); return [Math.cos(a) * r, 0, Math.sin(a) * r]; });
}

export function createBenchSim(tuning, seed = 42) {
  const rng = mulberry32(seed);
  const shades = scatter(rng, BENCH.shades, BENCH.islandR - 1).map((pos, i) => ({ id: `S${i + 1}`, pos, state: 'wander' }));
  const motes = scatter(rng, BENCH.motes, BENCH.islandR - 2).map(pos => ({ pos, kind: 'random' }));
  return createSim(tuning, { night: BENCH.night, seed, scenario: {
    bench: true, shades, motes, lanterns: BENCH.lit.map(id => ({ id, lit: true, fuel: tuning.fuel_max })),
    player: { pos: [0, 0, 0] },
  } });
}

const r1 = (v) => Math.round(v * 10) / 10;
// dts: frame durations in ms over the measured window.
export function frameStats(dts) {
  const N = dts.length, sum = dts.reduce((a, b) => a + b, 0);
  const sorted = [...dts].sort((a, b) => a - b);
  const k = Math.max(1, Math.ceil(0.01 * N));
  const worst = sorted.slice(N - k), worstMean = worst.reduce((a, b) => a + b, 0) / k;
  const p95 = sorted[Math.max(0, Math.ceil(0.95 * N) - 1)];   // nearest-rank percentile
  return { frames: N, avg_fps: r1(1000 * N / sum), p1_low_fps: r1(1000 / worstMean), frame_ms_p95: r1(p95) };
}
