import { pickOne, type Rng } from '../core/rng';

export const QUARTER_STAGES = 4;

export type QuarterKind = 'order' | 'koronOrFlat' | 'soriOrSharp' | 'motif';
export type QuarterAnswer = 'first' | 'second' | 'koron' | 'flat' | 'sori' | 'sharp';

/** A note to sound: its name in the grammar of the app (`Ek4`), and when, in seconds from the start. */
export interface PlannedSound {
  note: string;
  at: number;
  seconds: number;
}

export interface QuarterQuestion {
  stage: number;
  kind: QuarterKind;
  plan: PlannedSound[];
  /** What the student can answer, in the order of the buttons. */
  choices: QuarterAnswer[];
  answer: QuarterAnswer;
  /** A key for the statistics. */
  key: string;
}

/** The notes of the piano that have a note a semitone below them on a white key, so that koron, flat and sharp all differ. */
const ROOTS = ['D4', 'E4', 'G4', 'A4', 'B4'];
const SOUND = 0.9;
const STEP = 1.1;

const withSign = (note: string, sign: string): string => `${note[0]}${sign}${note.slice(1)}`;
const sharpOf = (note: string): string => withSign(note, '#');
const flatOf = (note: string): string => withSign(note, 'b');

/** The first four notes of Shur on D and the same with the second note natural: one has the koron. */
const MOTIF_WITH = ['D4', 'Ek4', 'F4', 'G4'];
const MOTIF_WITHOUT = ['D4', 'E4', 'F4', 'G4'];

const pair = (first: string, second: string): PlannedSound[] => [
  { note: first, at: 0, seconds: SOUND },
  { note: second, at: STEP, seconds: SOUND },
];

const motif = (notes: readonly string[], start: number): PlannedSound[] => notes.map((note, i) => ({ note, at: start + i * 0.7, seconds: 0.65 }));

/** A question of a stage (1 to 4): which of two notes is lower, koron or flat, sori or sharp, and which motif has the koron. */
export function makeQuarterQuestion(stage: number, rng: Rng, previous: QuarterQuestion | null = null): QuarterQuestion {
  const level = Math.max(1, Math.min(QUARTER_STAGES, Math.floor(stage)));
  for (let attempt = 0; ; attempt++) {
    let question: QuarterQuestion;
    const root = pickOne(rng, ROOTS);
    const coin = rng() < 0.5;
    if (level === 1) {
      // the koron is lower than the note: the lower one is first when the koron comes first
      const koron = withSign(root, 'k');
      question = { stage, kind: 'order', plan: coin ? pair(koron, root) : pair(root, koron), choices: ['first', 'second'], answer: coin ? 'first' : 'second', key: `order:${root}:${coin}` };
    } else if (level === 2) {
      question = {
        stage,
        kind: 'koronOrFlat',
        plan: pair(root, coin ? withSign(root, 'k') : flatOf(root)),
        choices: ['koron', 'flat'],
        answer: coin ? 'koron' : 'flat',
        key: `koronOrFlat:${root}:${coin}`,
      };
    } else if (level === 3) {
      question = {
        stage,
        kind: 'soriOrSharp',
        plan: pair(root, coin ? withSign(root, 'o') : sharpOf(root)),
        choices: ['sori', 'sharp'],
        answer: coin ? 'sori' : 'sharp',
        key: `soriOrSharp:${root}:${coin}`,
      };
    } else {
      const first = coin ? MOTIF_WITH : MOTIF_WITHOUT;
      const second = coin ? MOTIF_WITHOUT : MOTIF_WITH;
      question = { stage, kind: 'motif', plan: [...motif(first, 0), ...motif(second, 4)], choices: ['first', 'second'], answer: coin ? 'first' : 'second', key: `motif:${coin}` };
    }
    if (!previous || previous.key !== question.key || attempt > 20) return question;
  }
}
