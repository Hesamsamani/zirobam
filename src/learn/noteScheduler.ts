import type { PitchStat } from './noteStats';

/** 1 for a note always right, 5 for a note always wrong, 3 for a note not seen yet. */
export function pitchWeight(stat: PitchStat | undefined): number {
  const accuracy = stat && stat.seen > 0 ? stat.correct / stat.seen : 0.5;
  return 1 + 4 * (1 - accuracy);
}

export function pickNextPitch(
  pool: readonly string[],
  statFor: (pitch: string) => PitchStat | undefined,
  last: string | null,
  rng: () => number = Math.random
): string {
  if (pool.length === 0) throw new Error('Empty pitch pool');
  const candidates = pool.length > 1 ? pool.filter((p) => p !== last) : [...pool];
  const weights = candidates.map((p) => pitchWeight(statFor(p)));
  const total = weights.reduce((sum, w) => sum + w, 0);
  let roll = rng() * total;
  for (let i = 0; i < candidates.length; i++) {
    roll -= weights[i];
    if (roll < 0) return candidates[i];
  }
  return candidates[candidates.length - 1];
}
