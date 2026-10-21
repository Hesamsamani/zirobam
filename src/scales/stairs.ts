import type { SpelledScale } from '../theory/spell';

/** One note of a scale as a step of the interval stairs: as wide as the gap to the next note. */
export interface Step {
  /** Place in the scale, from 0. */
  index: number;
  /** 1 for the root. */
  degree: number;
  /** The note as written, without octave: `Ek`. */
  name: string;
  /** Semitones above the root. */
  offset: number;
  /** Semitones to the next note; the last note's step runs back to the root an octave up. */
  gap: number;
  /** The gap in tones (a tone is two semitones). */
  tones: number;
  /** The note is a quarter tone (koron or sori). */
  quarter: boolean;
  tonic: boolean;
}

/** The steps of a scale; their gaps add up to one octave. */
export function stepsOf(scale: SpelledScale): Step[] {
  return scale.names.map((name, index) => {
    const offset = scale.offsets[index];
    const gap = (scale.offsets[index + 1] ?? 12) - offset;
    return { index, degree: index + 1, name, offset, gap, tones: gap / 2, quarter: /[ko]$/.test(name), tonic: index === 0 };
  });
}

const FRACTIONS: Readonly<Record<number, string>> = { 0.25: '¼', 0.5: '½', 0.75: '¾' };

/** A step in tones as it is written on the stairs: `1`, `½`, `1½`, `¾`; any other size as the number. */
export function toneLabel(tones: number): string {
  const whole = Math.floor(tones);
  const fraction = FRACTIONS[tones - whole];
  if (tones - whole === 0) return String(whole);
  return fraction ? `${whole > 0 ? whole : ''}${fraction}` : String(tones);
}
