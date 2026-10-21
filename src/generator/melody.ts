import { pickWeighted, seededRng, type Rng } from '../core/rng';
import { keyAlter } from '../theory/keySignature';
import { accidentalToken, parsePitch, pianoMidi, type Alter } from '../theory/pitch';
import { ascendFrom, type SpelledScale } from '../theory/spell';
import type { Progression, ProgressionChord } from './progression';
import { METERS, rhythmBar, UNIT_TOKEN, type Density, type MeterId, type RhythmFeel } from './rhythmCells';

export const MAX_MELODY_BARS = 64;

export type Contour = 'arch' | 'rising' | 'falling' | 'wave' | 'flat';
export type MelodyRange = 'narrow' | 'medium' | 'wide';

export interface MelodyOptions {
  scale: SpelledScale;
  bars: number;
  meter: MeterId;
  density: Density;
  feel: RhythmFeel;
  contour: Contour;
  /** An octave from the tonic, an octave and a half, or two octaves. */
  range: MelodyRange;
  /** The octave of the lowest note, the tonic: 4 is the octave of middle C. */
  octave: number;
  seed: number;
  /** Chords to play over, in 4/4 and with as many bars as the melody. Left out: the melody is over the scale. */
  progression?: Progression;
}

export interface MelodyNote {
  /** The note with its octave (`Bb4`, `Ek4`), or null for a rest. */
  pitch: string | null;
  /** Length in sixteenth notes. */
  units: number;
  /** Where it starts in the bar, in sixteenths. */
  start: number;
}

export interface Melody {
  scale: SpelledScale;
  meter: MeterId;
  seed: number;
  bars: MelodyNote[][];
}

/** The chance of a rest in place of a note on a weak beat. */
const REST_CHANCE: Readonly<Record<Density, number>> = { sparse: 0.12, medium: 0.08, dense: 0.05 };
/** How likely a step of 0, 1, 2, 3 and 4 notes of the scale is. */
const STEP_WEIGHT: readonly number[] = [1, 6, 3, 1.2, 0.5];
const MAX_STEP = STEP_WEIGHT.length - 1;

const isQuarter = (pitch: string): boolean => /[ko]-?\d+$/.test(pitch);
const pitchClass = (pitch: string): number => pianoMidi(parsePitch(pitch)!) % 12;

/** The notes of the scale from the tonic up, as far as the range goes. */
function scaleLine(scale: SpelledScale, octave: number, range: MelodyRange): string[] {
  const count = scale.names.length;
  const length = range === 'narrow' ? count + 1 : range === 'medium' ? count + 1 + Math.floor(count / 2) : 2 * count + 1;
  const names = [scale.names, scale.names, scale.names].flat();
  return ascendFrom(names, octave).slice(0, length);
}

/** How high the melody wants to be, from 0 (the bottom of the range) to 1 (the top), a fraction of the way through the piece. */
function contourHeight(contour: Contour, x: number): number {
  switch (contour) {
    case 'arch':
      return Math.max(0, 1 - Math.abs(x - 0.6) / 0.6);
    case 'rising':
      return x;
    case 'falling':
      return 1 - x;
    case 'wave':
      return 0.5 + 0.5 * Math.sin(Math.PI * 4 * x - Math.PI / 2);
    default:
      return 0.4;
  }
}

/**
 * A melody on a scale, bar by bar: a rhythm for each bar, then a walk up and down the notes of the scale that follows
 * the contour. The strong beats take stable notes (the chord that sounds there, or the first, third and fifth of the
 * scale), a quarter tone only ever comes on a weak beat, the step before the end leads into the tonic, and the last
 * bar is the tonic held. The same options always give the same melody.
 */
export function generateMelody(options: MelodyOptions): Melody {
  const { scale, meter: meterId, density, feel, contour, range, octave, seed, progression } = options;
  const meter = METERS[meterId];
  const bars = Math.max(1, Math.min(MAX_MELODY_BARS, Math.floor(options.bars)));
  if (progression) {
    if (meterId !== '4/4') throw new Error('A progression is in 4/4, so a melody over it is too');
    if (progression.bars !== bars) throw new Error('The melody and the progression need the same number of bars');
  }
  const rng = seededRng(seed);
  const line = scaleLine(scale, octave, range);
  const count = scale.names.length;
  const span = line.length;
  const tonics = line.map((_, j) => j).filter((j) => j % count === 0);

  // ----- what a strong beat may take -----
  const chordPcs = new Map<ProgressionChord, Set<number>>();
  const pcsOf = (chord: ProgressionChord): Set<number> => {
    let set = chordPcs.get(chord);
    if (!set) {
      set = new Set(chord.chord.notes.map((name) => pitchClass(`${name}4`)));
      chordPcs.set(chord, set);
    }
    return set;
  };
  const chordAt = (bar: number, start: number): ProgressionChord | undefined => {
    const beat = start / 4;
    return progression?.chords.find((c) => c.bar === bar && c.beat <= beat && beat < c.beat + c.beats);
  };
  const stableDegrees = count >= 5 ? [0, 2, 4] : [0, 2 % count];
  const scaleStable = (j: number): boolean => !isQuarter(line[j]) && stableDegrees.includes(j % count);
  const isStable = (j: number, bar: number, start: number): boolean => {
    if (isQuarter(line[j])) return false;
    const chord = chordAt(bar, start);
    return chord ? pcsOf(chord).has(pitchClass(line[j])) : scaleStable(j);
  };

  const totalUnits = bars * meter.units;
  const target = (bar: number, start: number): number => {
    const height = contourHeight(contour, (bar * meter.units + start) / totalUnits);
    return (0.1 + 0.8 * height) * (span - 1);
  };

  // ----- the walk -----
  const choose = (from: number, bar: number, start: number, mustBeStable: boolean, repeats: number): number => {
    const goal = target(bar, start);
    const reach = Array.from({ length: 2 * MAX_STEP + 1 }, (_, k) => from - MAX_STEP + k).filter((j) => j >= 0 && j < span);
    let pool = mustBeStable ? reach.filter((j) => isStable(j, bar, start)) : reach;
    if (pool.length === 0) pool = line.map((_, j) => j).filter((j) => isStable(j, bar, start)); // nothing stable near: the nearest stable note of the line
    if (pool.length === 0) pool = reach;
    const weights = pool.map((j) => {
      const step = Math.abs(j - from);
      const pull = Math.exp(-Math.abs(j - goal) / (0.2 * span + 1));
      const tired = step === 0 && repeats >= 2 ? 0.1 : 1;
      // when nothing stable was near, the nearer of the far ones wins
      return (STEP_WEIGHT[Math.min(step, MAX_STEP)] ?? 0.2) * pull * tired + (step > MAX_STEP ? Math.exp(-step / 3) : 0);
    });
    return pickWeighted(rng, pool, weights);
  };

  const melody: MelodyNote[][] = [];
  let index = 0;
  let repeats = 0;
  let finalIndex = tonics[0];
  let started = false;

  for (let bar = 0; bar < bars; bar++) {
    if (bar === bars - 1) {
      melody.push([{ pitch: line[bars === 1 ? tonics[0] : finalIndex], units: meter.units, start: 0 }]);
      break;
    }
    const lengths = rhythmBar(meterId, density, feel, rng);
    const notes: MelodyNote[] = [];
    let start = 0;
    let previousWasRest = false;
    lengths.forEach((units, k) => {
      const strong = meter.strong.includes(start);
      const isLast = k === lengths.length - 1;
      if (bar === bars - 2 && isLast) {
        // the step before the end: a note beside the tonic that it will come to, on the side we are on
        const tonic = tonics.reduce((best, t) => (Math.abs(t - index) < Math.abs(best - index) ? t : best), tonics[0]);
        finalIndex = tonic;
        const beside = [tonic - 1, tonic + 1, tonic - 2, tonic + 2].filter((j) => j >= 0 && j < span && j !== tonic);
        const stable = strong ? beside.filter((j) => isStable(j, bar, start)) : beside;
        const pool = stable.length > 0 ? stable : beside.length > 0 ? beside : [tonic];
        const pick = pickWeighted(rng, pool, pool.map((j) => Math.exp(-Math.abs(j - index) / 2) + 0.05));
        notes.push({ pitch: line[pick], units, start });
        index = pick;
        start += units;
        return;
      }
      const restable = started && !strong && !previousWasRest && !isLast;
      if (restable && rng() < REST_CHANCE[density]) {
        notes.push({ pitch: null, units, start });
        previousWasRest = true;
        start += units;
        return;
      }
      let next: number;
      if (!started) {
        // the first note: a stable one near where the contour starts
        const goal = target(bar, start);
        const pool = line.map((_, j) => j).filter((j) => isStable(j, bar, start));
        const candidates = pool.length > 0 ? pool : line.map((_, j) => j);
        next = pickWeighted(rng, candidates, candidates.map((j) => Math.exp(-Math.abs(j - goal) / 2)));
        started = true;
      } else {
        next = choose(index, bar, start, strong, repeats);
      }
      repeats = next === index ? repeats + 1 : 0;
      notes.push({ pitch: line[next], units, start });
      index = next;
      previousWasRest = false;
      start += units;
    });
    melody.push(notes);
  }
  return { scale, meter: meterId, seed, bars: melody };
}

/**
 * The notes of a melody in the notation of the songs, a bar between two bars. A sign of the key signature is not
 * written, a sign outside it is, and a plain note where a sign is still in force (from the key or from the same
 * note earlier in the bar) is written with `n`, because the notation of the songs refuses it otherwise.
 */
export function melodyTokens(melody: Melody): string {
  const fifths = melody.scale.fifths ?? 0;
  return melody.bars
    .map((bar) => {
      const inForce = new Map<string, number>();
      return bar
        .map((note) => {
          const length = UNIT_TOKEN[note.units];
          if (!length) throw new Error(`No note of ${note.units} sixteenths`);
          if (note.pitch === null) return `r${length}`;
          const pitch = parsePitch(note.pitch)!;
          const id = `${pitch.step}${pitch.octave}`;
          const current = inForce.get(id) ?? keyAlter(pitch.step, fifths);
          const sign = pitch.alter === 0 && current !== 0 ? 'n' : accidentalToken(pitch.alter as Alter);
          inForce.set(id, pitch.alter);
          return `${pitch.step}${sign}${pitch.octave}${length}`;
        })
        .join(' ');
    })
    .join(' | ');
}

/** A fresh generator for a melody that is made in steps. */
export function melodyRng(seed: number): Rng {
  return seededRng(seed);
}
