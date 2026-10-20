/**
 * Notes as the app writes them: a letter, a sign and an octave ("C4", "Bb3", "F##5", "Ek4").
 * Signs: # sharp, b flat, ## and bb double, k koron (a quarter tone down), o sori (a quarter tone up).
 * Everything else is derived from this one reading, so a note means the same on the staff, on the keys and in the sound.
 */

export type Step = 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B';
/** Semitones above (+) or below (-) the letter. Half a semitone is a quarter tone. */
export type Alter = -2 | -1 | -0.5 | 0 | 0.5 | 1 | 2;

export interface Pitch {
  step: Step;
  alter: Alter;
  octave: number;
}

const STEP_SEMITONES: Readonly<Record<Step, number>> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const SHARP_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

const SIGN_ALTER: Readonly<Record<string, Alter>> = {
  '': 0,
  '#': 1,
  b: -1,
  '##': 2,
  bb: -2,
  k: -0.5,
  o: 0.5,
  // written signs, accepted as input only
  '♯': 1,
  '♭': -1,
  '♮': 0,
  x: 2,
  '𝄪': 2,
  '𝄫': -2,
};

const TOKEN: Readonly<Record<Alter, string>> = { [-2]: 'bb', [-1]: 'b', [-0.5]: 'k', [0]: '', [0.5]: 'o', [1]: '#', [2]: '##' };

/** The names MusicXML gives these signs. Verovio draws koron and sori. */
export const MUSICXML_ACCIDENTAL: Readonly<Record<Alter, string>> = {
  [-2]: 'flat-flat',
  [-1]: 'flat',
  [-0.5]: 'koron',
  [0]: 'natural',
  [0.5]: 'sori',
  [1]: 'sharp',
  [2]: 'double-sharp',
};

/** A note name whose octave may be missing: "Bb", "Ek", "C#4". */
export interface NoteName {
  step: Step;
  alter: Alter;
  octave: number | null;
}

// "bb" comes before "b" so that B-double-flat is not read as B-flat followed by a stray b
const NAME = /^([A-G])(##|bb|[#bko♯♭♮x𝄪𝄫])?(-?\d+)?$/u;

/** Reads a note name with or without its octave ("Bb", "Ek4"); null when it is not one. */
export function parseNoteName(text: string): NoteName | null {
  const match = NAME.exec(text);
  if (!match) return null;
  return { step: match[1] as Step, alter: SIGN_ALTER[match[2] ?? ''], octave: match[3] === undefined ? null : Number.parseInt(match[3], 10) };
}

/** Reads a note such as "Bb3" or "Ek4"; null when it is not one or has no octave. */
export function parsePitch(text: string): Pitch | null {
  const name = parseNoteName(text);
  return name && name.octave !== null ? { step: name.step, alter: name.alter, octave: name.octave } : null;
}

/** The sign as it is written in a note name: "#", "bb", "k", "o" and so on; empty for no sign. */
export function accidentalToken(alter: Alter): string {
  return TOKEN[alter];
}

/** The note text from the loose parts a parsed score keeps (letter, alteration, octave). A sign that is not one of ours is left out. */
export function noteString(step: string, alter: number, octave: number): string {
  return `${step}${TOKEN[alter as Alter] ?? ''}${octave}`;
}

/** The note as text, always in the one canonical form. */
export function formatPitch(pitch: Pitch): string {
  return `${pitch.step}${TOKEN[pitch.alter]}${pitch.octave}`;
}

export function isQuarterTone(pitch: Pitch): boolean {
  return pitch.alter === 0.5 || pitch.alter === -0.5;
}

/** The pitch as a MIDI number, with the quarter tones between the whole numbers (Ek4 is 63.5). */
export function pitchMidi(pitch: Pitch): number {
  return STEP_SEMITONES[pitch.step] + pitch.alter + 12 * (pitch.octave + 1);
}

/** The piano key that is struck for the note. A quarter tone is struck on the key of its own letter (Ek4 on E4). */
export function pianoMidi(pitch: Pitch): number {
  const midi = pitchMidi(pitch);
  return isQuarterTone(pitch) ? midi - pitch.alter : midi;
}

/**
 * The name of the piano key for a note, written with a sharp: Eb4 is D#4, Cb5 is B4, E#4 is F4.
 * A name without an octave gives the key class (Db is C#). Text that is not a note comes back as it was.
 */
export function keyName(note: string): string {
  const name = parseNoteName(note);
  if (!name) return note;
  if (name.octave === null) {
    const semitone = STEP_SEMITONES[name.step] + (name.alter === 0.5 || name.alter === -0.5 ? 0 : name.alter);
    return SHARP_NAMES[((semitone % 12) + 12) % 12];
  }
  const key = pianoMidi({ step: name.step, alter: name.alter, octave: name.octave });
  return `${SHARP_NAMES[((key % 12) + 12) % 12]}${Math.floor(key / 12) - 1}`;
}

/** The pitch in Hz; A4 is 440 unless told otherwise. */
export function frequencyOf(pitch: Pitch, a4 = 440): number {
  return a4 * 2 ** ((pitchMidi(pitch) - 69) / 12);
}

/** What to give the sampler: the key name for the notes of the piano, a frequency in Hz for a quarter tone. Text that is not a note comes back as it was. */
export function soundOf(note: string): string | number {
  const pitch = parsePitch(note);
  if (!pitch) return note;
  return isQuarterTone(pitch) ? frequencyOf(pitch) : keyName(note);
}
