// 3-night chain + total score (Ticket-02 Part 3). Pure logic: the UI only asks it what to show next.
import { createSim } from './sim.js';

export const NIGHTS = 3;

export function createCampaign(tuning, { seed = 1, startNight = 1 } = {}) {
  let night = startNight;
  const won = {};   // night -> score of the won run
  return {
    get night() { return night; },
    newSim(opts = {}) { return createSim(tuning, { night, seed, ...opts }); },   // flames refill: each night is a fresh sim
    // result: { status: 'won' | 'lost', score }. Returns what the UI should do next.
    finishNight({ status, score }) {
      if (status !== 'won') return { next: 'retry', night };
      won[night] = score;
      if (night >= NIGHTS) return { next: 'dawn', night };
      night += 1;
      return { next: 'night', night };
    },
    retry() { return night; },
    total() { return Object.values(won).reduce((a, b) => a + b, 0); },
    wonScores() { return { ...won }; },
  };
}
