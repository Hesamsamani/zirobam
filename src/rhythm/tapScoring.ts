export type Verdict = 'perfect' | 'good' | 'early' | 'late' | 'missed';

export interface TapWindows {
  /** Within this many milliseconds of the beat: perfect (35). */
  perfect: number;
  /** Within this many: good (80). */
  good: number;
  /** Further than this a tap belongs to no beat (160). */
  max: number;
}

export const DEFAULT_WINDOWS: TapWindows = { perfect: 35, good: 80, max: 160 };

export interface TapResult {
  expectedMs: number;
  /** The tap (corrected for the delay of the device), or null for a note that was not played. */
  tapMs: number | null;
  /** The tap minus the beat: negative is early. */
  deltaMs: number | null;
  verdict: Verdict;
}

export interface ScoreSummary {
  results: TapResult[];
  /** Taps that were close to no beat. */
  extraTaps: number;
  perfect: number;
  good: number;
  early: number;
  late: number;
  missed: number;
  /** The part of the notes that were perfect or good, 0 to 1. */
  accuracy: number;
}

/**
 * Matches each tap to the nearest beat that is still free within the window, and judges how far it is from it. `offsetMs`
 * is the delay of the device (the time from a tap to the moment the app sees it, or from a click to the moment it is
 * heard) and is taken off every tap before it is judged.
 */
export function scoreTaps(expectedMs: readonly number[], taps: readonly number[], offsetMs = 0, windows: TapWindows = DEFAULT_WINDOWS): ScoreSummary {
  const corrected = taps.map((tap) => tap - offsetMs).sort((a, z) => a - z);
  const taken = new Array<number | null>(expectedMs.length).fill(null);
  let extraTaps = 0;

  for (const tap of corrected) {
    let best = -1;
    let bestDistance = Infinity;
    expectedMs.forEach((beat, i) => {
      if (taken[i] !== null) return;
      const distance = Math.abs(tap - beat);
      if (distance < bestDistance) {
        best = i;
        bestDistance = distance;
      }
    });
    if (best >= 0 && bestDistance <= windows.max) taken[best] = tap;
    else extraTaps++;
  }

  const results: TapResult[] = expectedMs.map((beat, i) => {
    const tap = taken[i];
    if (tap === null) return { expectedMs: beat, tapMs: null, deltaMs: null, verdict: 'missed' };
    const delta = tap - beat;
    const distance = Math.abs(delta);
    const verdict: Verdict = distance <= windows.perfect ? 'perfect' : distance <= windows.good ? 'good' : delta < 0 ? 'early' : 'late';
    return { expectedMs: beat, tapMs: tap, deltaMs: delta, verdict };
  });
  const count = (verdict: Verdict): number => results.filter((r) => r.verdict === verdict).length;
  const perfect = count('perfect');
  const good = count('good');
  return {
    results,
    extraTaps,
    perfect,
    good,
    early: count('early'),
    late: count('late'),
    missed: count('missed'),
    accuracy: results.length === 0 ? 0 : (perfect + good) / results.length,
  };
}

/** A piece passes when most notes are on time and there are not many stray taps. */
export function didPassRhythm(summary: ScoreSummary): boolean {
  return summary.results.length > 0 && summary.accuracy >= 0.8 && summary.extraTaps <= Math.max(1, Math.floor(summary.results.length / 8));
}

/**
 * The delay of a device from taps along with clicks: the middle of the differences, after leaving out the ones that
 * are far off (a missed click, a stray tap). Zero when there is nothing to go by.
 */
export function medianOffset(deltas: readonly number[]): number {
  const near = deltas.filter((d) => Math.abs(d) <= 250);
  if (near.length === 0) return 0;
  const middle = (values: number[]): number => {
    const sorted = [...values].sort((a, z) => a - z);
    const half = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 1 ? sorted[half] : (sorted[half - 1] + sorted[half]) / 2;
  };
  const first = middle(near);
  if (near.length < 5) return Math.round(first);
  const spread = middle(near.map((d) => Math.abs(d - first)));
  const kept = spread === 0 ? near : near.filter((d) => Math.abs(d - first) <= 2.5 * spread);
  return Math.round(middle(kept.length > 0 ? kept : near));
}
