/** Ear training questions: pure and seeded, so they can be tested and so a seed gives the same questions. */

import { seededRng, type Rng } from '../core/rng';

// the generator moved to core/rng.ts; the ear exercises and their tests still take it from here
export { seededRng, type Rng };

export const EAR_STAGES = 5;

export type IntervalId = 'm2' | 'M2' | 'm3' | 'M3' | 'P4' | 'TT' | 'P5' | 'm6' | 'M6' | 'm7' | 'M7' | 'P8';
export type ChordQuality = 'major' | 'minor';

/** The size of each interval in semitones. */
export const INTERVALS: Readonly<Record<IntervalId, number>> = {
  m2: 1, M2: 2, m3: 3, M3: 4, P4: 5, TT: 6, P5: 7, m6: 8, M6: 9, m7: 10, M7: 11, P8: 12,
};
const ALL_INTERVALS = Object.keys(INTERVALS) as IntervalId[];
/** The intervals of stage 2: easy to tell apart. */
const EASY_INTERVALS: readonly IntervalId[] = ['M2', 'M3', 'P4', 'P5', 'P8'];

export function intervalName(semitones: number): IntervalId {
  const found = ALL_INTERVALS.find((id) => INTERVALS[id] === semitones);
  if (!found) throw new Error(`No interval of ${semitones} semitones`);
  return found;
}

const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;
const SEMITONE: Readonly<Record<string, number>> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

export function noteToMidi(note: string): number {
  const match = /^([A-G])(#?)(-?\d)$/.exec(note);
  if (!match) throw new Error(`Cannot read the note "${note}"`);
  return (Number(match[3]) + 1) * 12 + SEMITONE[match[1]] + (match[2] ? 1 : 0);
}

export function midiToNote(midi: number): string {
  return `${NAMES[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`;
}

/** Notes that sound together, `at` seconds after the start, for `length` seconds. */
export interface PlayStep {
  notes: string[];
  at: number;
  length: number;
}

interface Base {
  /** What the statistics are kept under: the kind of question and what is asked. */
  key: string;
  notes: string[];
  plan: PlayStep[];
}
export type EarQuestion =
  | (Base & { stage: 1; kind: 'higher'; answer: 'first' | 'second'; choices: ['first', 'second'] })
  | (Base & { stage: 2 | 3; kind: 'interval'; together: boolean; answer: IntervalId; choices: IntervalId[] })
  | (Base & { stage: 4; kind: 'chord'; answer: ChordQuality; choices: ChordQuality[] })
  | (Base & { stage: 5; kind: 'playNote' | 'playMelody' });

const pick = <T>(items: readonly T[], rng: Rng): T => items[Math.floor(rng() * items.length)];
const between = (low: number, high: number, rng: Rng): number => low + Math.floor(rng() * (high - low + 1));

/** The highest note a question uses: C6. The lowest is C3 (chords start no lower than F3). */
const HIGH = 84;

function twoNotes(first: number, second: number): PlayStep[] {
  return [
    { notes: [midiToNote(first)], at: 0, length: 0.85 },
    { notes: [midiToNote(second)], at: 0.95, length: 1.1 },
  ];
}

function generate(stage: number, rng: Rng): EarQuestion {
  if (stage <= 1) {
    const low = between(60, HIGH - 12, rng);
    const high = low + between(2, 12, rng);
    const upFirst = rng() < 0.5;
    const [a, b] = upFirst ? [high, low] : [low, high];
    return {
      stage: 1, kind: 'higher', key: 'higher', notes: [midiToNote(a), midiToNote(b)], plan: twoNotes(a, b),
      answer: upFirst ? 'first' : 'second', choices: ['first', 'second'],
    };
  }

  if (stage <= 3) {
    const pool = stage === 2 ? EASY_INTERVALS : ALL_INTERVALS;
    const answer = pick(pool, rng);
    const low = between(55, 72, rng);
    const high = low + INTERVALS[answer];
    const together = stage === 3 && rng() < 0.35;
    const plan: PlayStep[] = together
      ? [{ notes: [midiToNote(low), midiToNote(high)], at: 0, length: 1.8 }]
      : twoNotes(low, high);
    return {
      stage: stage === 2 ? 2 : 3, kind: 'interval', key: `interval:${answer}`, notes: [midiToNote(low), midiToNote(high)], plan, together,
      answer, choices: [...pool],
    };
  }

  if (stage === 4) {
    const answer: ChordQuality = rng() < 0.5 ? 'major' : 'minor';
    const root = between(53, 67, rng);
    const notes = [root, root + (answer === 'major' ? 4 : 3), root + 7].map(midiToNote);
    return { stage: 4, kind: 'chord', key: `chord:${answer}`, notes, plan: [{ notes, at: 0, length: 1.9 }], answer, choices: ['major', 'minor'] };
  }

  // stage 5: play it back. White keys from C4 to C5.
  const WHITE = [60, 62, 64, 65, 67, 69, 71, 72];
  if (rng() < 0.5) {
    const note = midiToNote(pick(WHITE, rng));
    return { stage: 5, kind: 'playNote', key: 'play:note', notes: [note], plan: [{ notes: [note], at: 0, length: 1.4 }] };
  }
  const melody: number[] = [pick(WHITE, rng)];
  while (melody.length < 3) {
    const next = pick(WHITE, rng);
    if (next !== melody[melody.length - 1]) melody.push(next);
  }
  const notes = melody.map(midiToNote);
  return {
    stage: 5, kind: 'playMelody', key: 'play:melody', notes,
    plan: notes.map((note, i) => ({ notes: [note], at: i * 0.75, length: 0.7 })),
  };
}

const sameAs = (a: EarQuestion, b: EarQuestion | null | undefined): boolean => Boolean(b) && a.kind === b!.kind && a.notes.join() === b!.notes.join();

/** The next question of a stage, never the same as the one before. */
export function makeQuestion(stage: number, rng: Rng, previous: EarQuestion | null = null): EarQuestion {
  const clamped = Math.min(EAR_STAGES, Math.max(1, Math.round(stage)));
  let question = generate(clamped, rng);
  for (let tries = 0; tries < 8 && sameAs(question, previous); tries++) question = generate(clamped, rng);
  return question;
}
