import type { RhythmSummary } from '../stats/heatmap';

export type BlockKind = 'notes' | 'ear' | 'chords' | 'rhythm' | 'scales' | 'levels';

export type ReasonKey = 'due' | 'leanEarly' | 'leanLate' | 'offBeat' | 'core' | 'rotation';

export interface PlanBlock {
  /** Stable for the day: `notes`, `rhythm`, ... */
  id: string;
  kind: BlockKind;
  /** About how long it takes. */
  minutes: number;
  /** Why it is in the plan, in a word the screen turns into a sentence; `count` is how many things are due. */
  reason: { key: ReasonKey; count?: number };
}

export interface PlanInput {
  /** The keys of the practice memory that are due again today: `note:Bb4`, `ear:interval:m3`, `chord:Cm7`. */
  dueKeys: readonly string[];
  /** How the rhythm taps of the last weeks went. */
  rhythm: RhythmSummary;
  /** A whole number that changes every day, so that the extra block changes with it. */
  dayIndex: number;
  /** The minutes the plan fits in (10). */
  budgetMinutes?: number;
}

export const DEFAULT_BUDGET = 10;
export const MAX_BLOCKS = 5;

/** The extra block of a day, in turn. */
const ROTATION: readonly BlockKind[] = ['scales', 'ear', 'chords'];

const countDue = (keys: readonly string[], prefix: string): number => keys.filter((key) => key.startsWith(prefix)).length;

/**
 * A plan for today that fits the minutes the student has. What the practice memory says is due again comes first (notes,
 * then ear, then chords); then the rhythm if the taps are off the beat; then reading and playing, the core of practice;
 * then a block that changes day by day. Blocks are added while they fit; at most five. Each has a plain reason.
 */
export function buildTodayPlan(input: PlanInput): PlanBlock[] {
  const budget = input.budgetMinutes ?? DEFAULT_BUDGET;
  const candidates: PlanBlock[] = [];

  const notes = countDue(input.dueKeys, 'note:');
  if (notes > 0) candidates.push({ id: 'notes', kind: 'notes', minutes: Math.min(4, 1 + Math.ceil(notes / 6)), reason: { key: 'due', count: notes } });
  const ear = countDue(input.dueKeys, 'ear:');
  if (ear > 0) candidates.push({ id: 'ear', kind: 'ear', minutes: 2, reason: { key: 'due', count: ear } });
  const chords = countDue(input.dueKeys, 'chord:');
  if (chords > 0) candidates.push({ id: 'chords', kind: 'chords', minutes: 2, reason: { key: 'due', count: chords } });

  const r = input.rhythm;
  if (r.total >= 10) {
    if (r.lean === 'early') candidates.push({ id: 'rhythm', kind: 'rhythm', minutes: 2, reason: { key: 'leanEarly' } });
    else if (r.lean === 'late') candidates.push({ id: 'rhythm', kind: 'rhythm', minutes: 2, reason: { key: 'leanLate' } });
    else if ((r.early + r.late + r.missed) / r.total >= 0.3) candidates.push({ id: 'rhythm', kind: 'rhythm', minutes: 2, reason: { key: 'offBeat' } });
  }

  candidates.push({ id: 'levels', kind: 'levels', minutes: 3, reason: { key: 'core' } });

  const rotating = ROTATION[((input.dayIndex % ROTATION.length) + ROTATION.length) % ROTATION.length];
  if (!candidates.some((c) => c.kind === rotating)) candidates.push({ id: rotating, kind: rotating, minutes: 2, reason: { key: 'rotation' } });

  // reading and playing is the core and always has its place, so its minutes are kept back; the others take what is left
  const core = candidates.find((c) => c.kind === 'levels')!;
  let used = core.minutes;
  const chosen = new Set<PlanBlock>([core]);
  for (const block of candidates) {
    if (block === core) continue;
    if (chosen.size >= MAX_BLOCKS || used + block.minutes > budget) continue;
    chosen.add(block);
    used += block.minutes;
  }
  const plan = candidates.filter((block) => chosen.has(block));
  return plan;
}

export function totalMinutes(plan: readonly PlanBlock[]): number {
  return plan.reduce((sum, block) => sum + block.minutes, 0);
}
