import { pickOne, type Rng } from '../core/rng';
import { METERS, rhythmBar, UNIT_TOKEN, type Density, type MeterId, type RhythmFeel } from '../generator/rhythmCells';

export interface RhythmLevel {
  id: number;
  meter: MeterId;
  density: Density;
  feel: RhythmFeel;
  /** The chance that a note (not the first) is a rest instead. */
  restChance: number;
  bars: number;
  /** A comfortable tempo for the level, in beats (quarter notes) a minute. */
  bpm: number;
}

export const RHYTHM_LEVELS: readonly RhythmLevel[] = [
  { id: 1, meter: '4/4', density: 'sparse', feel: 'straight', restChance: 0, bars: 2, bpm: 70 },
  { id: 2, meter: '4/4', density: 'sparse', feel: 'straight', restChance: 0.2, bars: 2, bpm: 72 },
  { id: 3, meter: '4/4', density: 'medium', feel: 'straight', restChance: 0, bars: 2, bpm: 76 },
  { id: 4, meter: '4/4', density: 'medium', feel: 'straight', restChance: 0.2, bars: 2, bpm: 80 },
  { id: 5, meter: '4/4', density: 'medium', feel: 'dotted', restChance: 0.1, bars: 2, bpm: 76 },
  { id: 6, meter: '4/4', density: 'medium', feel: 'syncopated', restChance: 0.1, bars: 2, bpm: 76 },
  { id: 7, meter: '4/4', density: 'dense', feel: 'straight', restChance: 0.1, bars: 2, bpm: 64 },
  { id: 8, meter: '3/4', density: 'medium', feel: 'dotted', restChance: 0.1, bars: 3, bpm: 76 },
  { id: 9, meter: '6/8', density: 'medium', feel: 'straight', restChance: 0.1, bars: 2, bpm: 70 },
  { id: 10, meter: '4/4', density: 'dense', feel: 'syncopated', restChance: 0.15, bars: 4, bpm: 64 },
];

export const RHYTHM_LEVEL_COUNT = RHYTHM_LEVELS.length;

export interface RhythmNote {
  /** Where it starts, in sixteenth notes from the start of the exercise. */
  start: number;
  /** How long it is, in sixteenths. */
  units: number;
  rest: boolean;
}

export interface RhythmExercise {
  level: RhythmLevel;
  /** The notes of each bar. */
  bars: RhythmNote[][];
  /** A key for the statistics: the level and the bars written out. */
  key: string;
}

/** A rhythm for a level: bars from the rhythm cells, some notes turned to rests, never the first note of the exercise. */
export function makeRhythm(levelId: number, rng: Rng): RhythmExercise {
  const level = RHYTHM_LEVELS[Math.max(1, Math.min(RHYTHM_LEVEL_COUNT, Math.floor(levelId))) - 1];
  const barUnits = METERS[level.meter].units;
  const bars: RhythmNote[][] = [];
  for (let bar = 0; bar < level.bars; bar++) {
    let start = bar * barUnits;
    bars.push(
      rhythmBar(level.meter, level.density, level.feel, rng).map((units, k) => {
        // a rest is never the first note, and a whole bar is never all rest
        const rest = !(bar === 0 && k === 0) && !(k === 0 && units === barUnits) && rng() < level.restChance;
        const note = { start, units, rest };
        start += units;
        return note;
      }),
    );
  }
  const exercise = { level, bars, key: '' };
  exercise.key = `${level.id}:${tokens(exercise)}`;
  return exercise;
}

/** One pitch for every note: a rhythm is drawn on a single line of the staff, so any pitch will do. */
const PITCH = 'B4';

/** The exercise in the notation of the songs, for drawing: a note is `B4q`, a rest `rq`. */
export function tokens(exercise: RhythmExercise): string {
  return exercise.bars.map((bar) => bar.map((n) => `${n.rest ? 'r' : PITCH}${UNIT_TOKEN[n.units]}`).join(' ')).join(' | ');
}

/** The moments at which a tap is wanted, in beats (quarter notes) from the start: the notes, not the rests. */
export function onsets(exercise: RhythmExercise): number[] {
  return exercise.bars.flat().filter((n) => !n.rest).map((n) => n.start / 4);
}

/** The length of the exercise in beats. */
export function totalBeats(exercise: RhythmExercise): number {
  return (exercise.level.bars * METERS[exercise.level.meter].units) / 4;
}

/** A rhythm of a level that is not the one just asked. */
export function nextRhythm(levelId: number, rng: Rng, previous: RhythmExercise | null): RhythmExercise {
  for (let attempt = 0; attempt < 20; attempt++) {
    const exercise = makeRhythm(levelId, rng);
    if (!previous || exercise.key !== previous.key) return exercise;
  }
  return makeRhythm(levelId, rng);
}

export const pickLevel = (rng: Rng): number => pickOne(rng, RHYTHM_LEVELS).id;
