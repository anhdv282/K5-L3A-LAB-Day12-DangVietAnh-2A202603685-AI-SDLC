// Soak night (Ticket-04 §2): seeded random input, run one night to its end. Pure logic; memory is measured by scripts/soak.mjs.
import { createSim, mulberry32, TPS } from './sim.js';

export const SOAK = { reaimEvery: 30, pJump: 0.05, pDash: 0.03, pPulse: 0.02, pInteract: 0.10 };

export function soakNight(tuning, night, seed, onLoaded) {
  const sim = createSim(tuning, { night, seed });
  if (onLoaded) onLoaded(sim);   // lets the soak script sample memory right after the night is loaded
  const rng = mulberry32((seed ^ 0x5eed5eed) >>> 0);   // input RNG, separate from the game RNG
  const maxTicks = Math.round(tuning[`night${night}_duration_s`] * TPS);
  const st = { ticks: 0, reaims: 0, jump: 0, dash: 0, pulse: 0, interact: 0 };
  let move = [0, 0];
  while (sim.state.status === 'playing' && st.ticks < maxTicks) {
    if (st.ticks % SOAK.reaimEvery === 0) { const a = rng() * Math.PI * 2; move = [Math.cos(a), Math.sin(a)]; st.reaims++; }
    const inp = { move, jump: rng() < SOAK.pJump, dash: rng() < SOAK.pDash, pulse: rng() < SOAK.pPulse, interact: rng() < SOAK.pInteract };
    for (const k of ['jump', 'dash', 'pulse', 'interact']) if (inp[k]) st[k]++;
    sim.step(inp); st.ticks++;
  }
  return { night, seed, result: sim.state.status === 'won' ? 'won' : 'lost', reason: sim.state.reason, ticks: st.ticks, inputStats: st };
}
