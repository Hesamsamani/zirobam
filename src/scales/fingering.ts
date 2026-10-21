import type { SpelledScale } from '../theory/spell';

type Fingers = readonly number[];
const RH_STANDARD: Fingers = [1, 2, 3, 1, 2, 3, 4, 5];
const LH_STANDARD: Fingers = [5, 4, 3, 2, 1, 3, 2, 1];

/** The agreed fingering of the common scales, one octave up, by root and scale. Only the roots with no signs. */
const FINGERING: Record<string, { right: Fingers; left: Fingers }> = {
  'C:major': { right: RH_STANDARD, left: LH_STANDARD },
  'D:major': { right: RH_STANDARD, left: LH_STANDARD },
  'E:major': { right: RH_STANDARD, left: LH_STANDARD },
  'G:major': { right: RH_STANDARD, left: LH_STANDARD },
  'A:major': { right: RH_STANDARD, left: LH_STANDARD },
  'F:major': { right: [1, 2, 3, 4, 1, 2, 3, 4], left: LH_STANDARD },
  'B:major': { right: RH_STANDARD, left: [4, 3, 2, 1, 4, 3, 2, 1] },
};
for (const root of ['A', 'E', 'D']) {
  for (const id of ['natural-minor', 'harmonic-minor', 'melodic-minor']) FINGERING[`${root}:${id}`] = { right: RH_STANDARD, left: LH_STANDARD };
}

/** The finger numbers under the notes of a scale, or null when this scale has no agreed fingering. */
export function fingeringFor(scale: SpelledScale, hand: 'right' | 'left'): number[] | null {
  const entry = FINGERING[`${scale.root}:${scale.id}`];
  return entry ? [...entry[hand]] : null;
}
