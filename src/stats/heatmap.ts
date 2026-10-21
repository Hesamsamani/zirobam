import { keyName } from '../theory/pitch';
import type { Aggregate, Counts, RhythmCounts, TrendWeek } from './mistakeLog';

/** How many times a note must have been asked before its misses mean anything. */
export const MIN_ASKED = 3;

/** From 0 (no trouble, or too little to say) to 5 (nearly always missed). */
export type HeatLevel = 0 | 1 | 2 | 3 | 4 | 5;

const THRESHOLDS: ReadonlyArray<readonly [number, HeatLevel]> = [
  [0.8, 5],
  [0.6, 4],
  [0.4, 3],
  [0.25, 2],
  [0.1, 1],
];

/** How hot a note is: the share of the times it was asked that it was missed, in five steps. */
export function heatOf(counts: Counts, minAsked: number = MIN_ASKED): HeatLevel {
  if (counts.asked < minAsked) return 0;
  const rate = counts.missed / counts.asked;
  for (const [threshold, level] of THRESHOLDS) if (rate >= threshold) return level;
  return 0;
}

/** The heat of every key of the piano that was asked, by its sharp name with octave (`A#3`): a B flat and an A sharp are the one key. */
export function noteHeat(notes: Record<string, Counts>, minAsked: number = MIN_ASKED): Record<string, HeatLevel> {
  const merged: Record<string, Counts> = {};
  for (const [name, counts] of Object.entries(notes)) {
    const key = keyName(name);
    const into = (merged[key] ??= { asked: 0, missed: 0 });
    into.asked += counts.asked;
    into.missed += counts.missed;
  }
  const heat: Record<string, HeatLevel> = {};
  for (const [key, counts] of Object.entries(merged)) {
    const level = heatOf(counts, minAsked);
    if (level > 0) heat[key] = level;
  }
  return heat;
}

export interface Slip {
  name: string;
  asked: number;
  missed: number;
  /** 0 to 1. */
  rate: number;
}

/** The notes (or chords) missed most, worst first: by the share missed, then by how many times. */
export function worstItems(counts: Record<string, Counts>, count = 5, minAsked: number = MIN_ASKED): Slip[] {
  return Object.entries(counts)
    .filter(([, c]) => c.asked >= minAsked && c.missed > 0)
    .map(([name, c]) => ({ name, asked: c.asked, missed: c.missed, rate: c.missed / c.asked }))
    .sort((a, z) => z.rate - a.rate || z.missed - a.missed || a.name.localeCompare(z.name))
    .slice(0, count);
}

export interface RhythmSummary {
  total: number;
  hits: number;
  early: number;
  late: number;
  missed: number;
  /** The way the taps lean when they are off: early, late, or neither. */
  lean: 'early' | 'late' | 'none';
}

/** The rhythm taps added up, and which way the student tends to miss: early or late, when one is clearly more than the other. */
export function rhythmSummary(r: RhythmCounts): RhythmSummary {
  const off = r.early + r.late;
  const lean = off >= 5 && r.early >= 2 * r.late ? 'early' : off >= 5 && r.late >= 2 * r.early ? 'late' : 'none';
  return { total: r.hits + r.early + r.late + r.missed, hits: r.hits, early: r.early, late: r.late, missed: r.missed, lean };
}

/** The share of notes and chords answered right in each week, 0 to 1, or null for a week with too few answers to say. */
export function trendPoints(weeks: readonly TrendWeek[], minAsked = 5): Array<number | null> {
  return weeks.map((w) => (w.asked < minAsked ? null : 1 - w.missed / w.asked));
}

/** True when nothing at all was asked in the period. */
export function isEmpty(aggregate: Aggregate): boolean {
  const asked = (counts: Record<string, Counts>) => Object.values(counts).reduce((sum, c) => sum + c.asked, 0);
  return asked(aggregate.notes) + asked(aggregate.chords) + rhythmSummary(aggregate.rhythm).total === 0;
}
