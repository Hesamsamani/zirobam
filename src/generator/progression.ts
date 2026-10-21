import { between, pickOne, seededRng, type Rng } from '../core/rng';
import { chordsOfScale, type ScaleChord } from '../theory/diatonic';
import { parsePitch, pianoMidi } from '../theory/pitch';
import { ascendFrom, type SpelledScale } from '../theory/spell';
import { STYLES, type Bar, type Phrase, type StyleId } from './styles';

export const MAX_BARS = 32;

/** What a Persian mode is played with: the notes of the piano that fit, with no third where it can be left out. */
const OPEN_CHORDS: readonly string[] = ['power', 'sus2', 'sus4', 'quartal', 'quintal', 'minor', 'major', 'dim'];
/** The distances from the root of the degrees of the major scale: what a degree of a style means in a scale of another size. */
const MAJOR_OFFSETS: readonly number[] = [0, 2, 4, 5, 7, 9, 11];

/** The lowest and the highest note of a voicing, as keys of the piano (C3 and E5). */
const VOICING_LOW = 48;
const VOICING_HIGH = 76;
const VOICING_CENTRE = 60;

export interface ProgressionChord {
  /** The bar it starts in, from 0. */
  bar: number;
  /** The beat of the bar it starts on, from 0. */
  beat: number;
  /** How long it sounds, in beats (quarter notes). */
  beats: number;
  chord: ScaleChord;
  /** The notes of the chord with their octaves, from the lowest up, moved the least from the chord before. */
  voicing: string[];
  /** The note for a bass: the root, in the octave from C2 to B2. */
  bass: string;
}

export interface Progression {
  scale: SpelledScale;
  style: StyleId;
  seed: number;
  bars: number;
  /** Beats a minute. */
  bpm: number;
  chords: ProgressionChord[];
}

export interface ProgressionOptions {
  scale: SpelledScale;
  style: StyleId;
  bars: number;
  seed: number;
  /** Left out: a tempo in the range of the style, chosen by the seed. */
  bpm?: number;
}

const midiOf = (pitch: string): number => pianoMidi(parsePitch(pitch)!);

/** The place in a scale of a degree of a style: the degree itself in a scale of seven notes, the nearest note to it in the others. */
function degreeIndex(scale: SpelledScale, degree: number): number {
  const count = scale.offsets.length;
  if (count === 7) return ((degree - 1) % 7) + 1;
  const wanted = MAJOR_OFFSETS[(degree - 1) % 7];
  let best = 0;
  scale.offsets.forEach((offset, i) => {
    if (Math.abs(offset - wanted) < Math.abs(scale.offsets[best] - wanted)) best = i;
  });
  return best + 1;
}

/** The chord for a degree: the first of the style's chords that fits, else any chord on that degree, else one on the nearest degree. */
function chordFor(all: readonly ScaleChord[], count: number, index: number, ids: readonly string[]): ScaleChord | null {
  for (let reach = 0; reach < count; reach++) {
    for (const degree of reach === 0 ? [index] : [index + reach, index - reach]) {
      const wrapped = ((degree - 1 + count) % count) + 1;
      const here = all.filter((chord) => chord.degree === wrapped);
      if (here.length === 0) continue;
      for (const id of ids) {
        const found = here.find((chord) => chord.def.id === id);
        if (found) return found;
      }
      // a degree beside the one asked for must have the style's chord: otherwise the chord on the degree itself, whatever it is
      if (reach === 0) return here[0];
    }
  }
  return all[0] ?? null;
}

/** The bars of the progression as degrees: phrases of the style, and the ending in the last bars. */
function barsOf(style: (typeof STYLES)[StyleId], bars: number, rng: Rng): Bar[] {
  const phraseCount = Math.ceil(bars / 4);
  const out: Bar[] = [];
  let previous: Phrase | null = null;
  for (let i = 0; i < phraseCount; i++) {
    const repeat = previous !== null && rng() < 0.4;
    const choices: readonly Phrase[] = previous === null ? style.phrases : style.phrases.filter((phrase) => phrase !== previous);
    const phrase: Phrase = repeat ? previous! : pickOne(rng, choices);
    out.push(...phrase);
    previous = phrase;
  }
  out.length = bars;
  const ending = pickOne(rng, style.endings);
  const tail = Math.min(4, bars);
  out.splice(bars - tail, tail, ...ending.slice(4 - tail));
  return out;
}

/**
 * The chords in a voicing that moves the least from the one before: every turn of the chord, placed in every octave
 * between C3 and E5, and the one nearest the previous chord (and the middle of the keyboard) wins.
 */
function voice(previous: readonly number[] | null, names: readonly string[]): string[] {
  let best: { pitches: string[]; cost: number } | null = null;
  for (let turn = 0; turn < names.length; turn++) {
    const turned = [...names.slice(turn), ...names.slice(0, turn)];
    for (const octave of [2, 3, 4]) {
      const pitches = ascendFrom(turned, octave);
      const keys = pitches.map(midiOf);
      if (keys[0] < VOICING_LOW || keys[keys.length - 1] > VOICING_HIGH) continue;
      const mean = keys.reduce((sum, k) => sum + k, 0) / keys.length;
      let cost = Math.abs(mean - VOICING_CENTRE) * 0.15 + turn * 0.01;
      if (previous) {
        cost +=
          previous.length === keys.length
            ? keys.reduce((sum, k, i) => sum + Math.abs(k - previous[i]), 0) / keys.length
            : Math.abs(mean - previous.reduce((sum, k) => sum + k, 0) / previous.length);
      }
      if (!best || cost < best.cost) best = { pitches, cost };
    }
  }
  return best ? best.pitches : ascendFrom(names, 3);
}

/**
 * A chord progression on a scale in a style. The same options (the seed above all) always give the same progression.
 * A scale that has no chord at all, because no note of it can be a root, gives a progression with no chords.
 */
export function generateProgression(options: ProgressionOptions): Progression {
  const { scale, style: styleId, seed } = options;
  const style = STYLES[styleId];
  const bars = Math.max(1, Math.min(MAX_BARS, Math.floor(options.bars)));
  const rng = seededRng(seed);
  const degrees = barsOf(style, bars, rng);
  const bpm = options.bpm ?? Math.min(style.tempo[1], Math.max(style.tempo[0], 2 * between(rng, style.tempo[0] / 2, style.tempo[1] / 2)));

  const all = chordsOfScale(scale);
  const count = scale.names.length;
  const ids = scale.hasQuarterTones ? OPEN_CHORDS : style.chords;

  const chords: ProgressionChord[] = [];
  if (all.length > 0 && count > 0) {
    let previous: number[] | null = null;
    degrees.forEach((bar, barIndex) => {
      const beats = 4 / bar.length;
      bar.forEach((degree, slot) => {
        const chord = chordFor(all, count, degreeIndex(scale, degree), ids);
        if (!chord) return;
        const voicing = voice(previous, chord.notes);
        previous = voicing.map(midiOf);
        chords.push({ bar: barIndex, beat: slot * beats, beats, chord, voicing, bass: `${chord.bass ?? chord.root}2` });
      });
    });
  }
  return { scale, style: styleId, seed, bars, bpm, chords };
}
