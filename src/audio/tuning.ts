export const A4_DEFAULT = 440;
export const A4_MIN = 415;
export const A4_MAX = 466;

/** A reference pitch for A4 between 415 and 466 Hz (a baroque pitch to a high orchestra), to a tenth of a hertz. */
export function clampA4(hz: number): number {
  if (!Number.isFinite(hz)) return A4_DEFAULT;
  return Math.round(Math.max(A4_MIN, Math.min(A4_MAX, hz)) * 10) / 10;
}

export type TuningMode = 'et' | 'quarter';

export interface NoteReading {
  /** The note in the grammar of the app, with its octave: `A4`, `C#3`, `Ek4`. */
  name: string;
  /** The note as a MIDI number; a quarter tone is x.5. */
  midi: number;
  /** How far the sound is from that note, from -50 (flat) to +50 (sharp) in 12 notes, -25 to +25 in quarter tones. */
  cents: number;
  frequency: number;
}

const SHARP_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const NATURAL = new Set([0, 2, 4, 5, 7, 9, 11]);

const noteName = (midi: number): string => `${SHARP_NAMES[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`;

/**
 * A note between two keys written as a Persian quarter tone: a koron on the key above when that key has no sign (E koron
 * is between D sharp and E), otherwise a sori on the key below (D sori is between D and D sharp).
 */
function quarterName(half: number): string {
  const lower = Math.floor(half);
  const upper = lower + 1;
  if (NATURAL.has(((upper % 12) + 12) % 12)) return noteName(upper).replace(/^([A-G])(\d+)$/, '$1k$2');
  return noteName(lower).replace(/^([A-G])(\d+)$/, '$1o$2');
}

/** The note a sound is nearest to, and how many cents it is off: in the twelve notes, or in quarter tones too. */
export function readFrequency(frequency: number, a4: number = A4_DEFAULT, mode: TuningMode = 'et'): NoteReading {
  const exact = 69 + 12 * Math.log2(frequency / a4);
  const step = mode === 'quarter' ? 0.5 : 1;
  const midi = Math.round(exact / step) * step;
  const name = Number.isInteger(midi) ? noteName(midi) : quarterName(midi);
  return { name, midi, cents: (exact - midi) * 100, frequency };
}
