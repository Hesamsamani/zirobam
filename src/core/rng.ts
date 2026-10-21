/** A source of numbers from 0 up to, not including, 1. */
export type Rng = () => number;

/** A small seeded random number generator (mulberry32): the same seed always gives the same numbers. */
export function seededRng(seed: number): Rng {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** One of the items, each as likely as the others. */
export function pickOne<T>(rng: Rng, items: readonly T[]): T {
  if (items.length === 0) throw new Error('Nothing to pick from');
  return items[Math.floor(rng() * items.length)];
}

/** An integer from `low` to `high`, both included. */
export function between(rng: Rng, low: number, high: number): number {
  return low + Math.floor(rng() * (high - low + 1));
}

/** One of the items, with the chance of each in proportion to its weight. A weight of 0 (or less) is never picked. */
export function pickWeighted<T>(rng: Rng, items: readonly T[], weights: readonly number[]): T {
  if (items.length === 0 || items.length !== weights.length) throw new Error('Items and weights do not match');
  const total = weights.reduce((sum, w) => sum + Math.max(0, w), 0);
  if (total <= 0) return items[Math.floor(rng() * items.length)];
  let left = rng() * total;
  for (let i = 0; i < items.length; i++) {
    left -= Math.max(0, weights[i]);
    if (left < 0) return items[i];
  }
  return items[items.length - 1];
}

/** A seed for a new piece: a whole number the student can read, keep and type again. */
export function freshSeed(rng: Rng = Math.random): number {
  return 1 + Math.floor(rng() * 999_999);
}
