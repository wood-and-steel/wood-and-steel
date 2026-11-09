/**
 * Seeded random numbers for bots (docs/BOT_PLAN.md, Ports). Each bot stores its generator's
 * state in bot_states, so its choices are reproducible in tests and resume correctly.
 * Mulberry32: small, fast, and good enough for game choices.
 */

export interface Rng {
  /** A number in [0, 1). */
  next(): number;
  /** Current state; pass it to createRng to continue the same sequence. */
  state(): number;
}

export function createRng(state: number): Rng {
  let s = state >>> 0;
  return {
    next() {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    state() {
      return s;
    },
  };
}

/** A fresh 32-bit seed. */
export function randomSeed(): number {
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    return crypto.getRandomValues(new Uint32Array(1))[0];
  }
  return Math.floor(Math.random() * 4294967296) >>> 0;
}
