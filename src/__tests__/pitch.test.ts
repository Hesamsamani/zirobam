import { describe, it, expect } from 'vitest';
import {
  MUSICXML_ACCIDENTAL,
  accidentalToken,
  formatPitch,
  frequencyOf,
  isQuarterTone,
  keyName,
  noteString,
  parseNoteName,
  parsePitch,
  pianoMidi,
  pitchMidi,
  soundOf,
  type Alter,
  type Pitch,
} from '../theory/pitch';

const p = (text: string): Pitch => {
  const pitch = parsePitch(text);
  if (!pitch) throw new Error(`not a pitch: ${text}`);
  return pitch;
};

describe('parsePitch', () => {
  it('reads the letter names the app has always used', () => {
    expect(parsePitch('C4')).toEqual({ step: 'C', alter: 0, octave: 4 });
    expect(parsePitch('C#4')).toEqual({ step: 'C', alter: 1, octave: 4 });
    expect(parsePitch('Bb3')).toEqual({ step: 'B', alter: -1, octave: 3 });
    expect(parsePitch('A0')).toEqual({ step: 'A', alter: 0, octave: 0 });
    expect(parsePitch('C-1')).toEqual({ step: 'C', alter: 0, octave: -1 });
  });

  it('reads double signs and quarter tones: k is koron, o is sori', () => {
    expect(parsePitch('F##5')).toEqual({ step: 'F', alter: 2, octave: 5 });
    expect(parsePitch('Dbb4')).toEqual({ step: 'D', alter: -2, octave: 4 });
    expect(parsePitch('Ek4')).toEqual({ step: 'E', alter: -0.5, octave: 4 });
    expect(parsePitch('Co4')).toEqual({ step: 'C', alter: 0.5, octave: 4 });
  });

  it('keeps B-flat apart from B-double-flat', () => {
    expect(p('Bb3').alter).toBe(-1);
    expect(p('Bbb3').alter).toBe(-2);
    expect(p('Bbb3').step).toBe('B');
  });

  it('accepts the written signs as input', () => {
    expect(parsePitch('C♯4')).toEqual(p('C#4'));
    expect(parsePitch('B♭3')).toEqual(p('Bb3'));
    expect(parsePitch('Cx4')).toEqual(p('C##4'));
    expect(parsePitch('C𝄪4')).toEqual(p('C##4'));
    expect(parsePitch('D𝄫4')).toEqual(p('Dbb4'));
    expect(parsePitch('C♮4')).toEqual(p('C4'));
  });

  it('rejects anything else', () => {
    for (const bad of ['', 'H4', 'c4', 'C', 'C#', 'C4 ', ' C4', 'Cbbb4', 'C###4', 'Ckk4', 'C#b4', '4C', 'C4.5', 'Ez4']) {
      expect(parsePitch(bad), bad).toBeNull();
    }
  });
});

describe('parseNoteName', () => {
  it('reads a name with or without an octave: the roots of scales and chords have none', () => {
    expect(parseNoteName('Bb')).toEqual({ step: 'B', alter: -1, octave: null });
    expect(parseNoteName('C')).toEqual({ step: 'C', alter: 0, octave: null });
    expect(parseNoteName('Ek')).toEqual({ step: 'E', alter: -0.5, octave: null });
    expect(parseNoteName('F##')).toEqual({ step: 'F', alter: 2, octave: null });
    expect(parseNoteName('Bb3')).toEqual({ step: 'B', alter: -1, octave: 3 });
  });

  it('rejects what is not a note name', () => {
    for (const bad of ['', 'H', 'c', 'Cbbb', '4', 'C 4', 'Cm']) expect(parseNoteName(bad), bad).toBeNull();
  });
});

describe('formatPitch', () => {
  it('writes the canonical grammar and round-trips every sign', () => {
    const alters: Alter[] = [-2, -1, -0.5, 0, 0.5, 1, 2];
    for (const alter of alters) {
      const pitch: Pitch = { step: 'G', alter, octave: 3 };
      expect(parsePitch(formatPitch(pitch))).toEqual(pitch);
    }
    expect(formatPitch({ step: 'E', alter: -0.5, octave: 4 })).toBe('Ek4');
    expect(formatPitch({ step: 'C', alter: 0.5, octave: 4 })).toBe('Co4');
    expect(formatPitch({ step: 'B', alter: -1, octave: 3 })).toBe('Bb3');
    expect(formatPitch({ step: 'F', alter: 2, octave: 5 })).toBe('F##5');
  });

  it('turns a written sign into the canonical one', () => {
    expect(formatPitch(p('C♯4'))).toBe('C#4');
  });
});

describe('noteString', () => {
  it('writes the note from the loose parts a parsed score keeps', () => {
    expect(noteString('C', 0, 4)).toBe('C4');
    expect(noteString('F', 1, 5)).toBe('F#5');
    expect(noteString('B', -1, 3)).toBe('Bb3');
    expect(noteString('D', 2, 4)).toBe('D##4');
    expect(noteString('E', -0.5, 4)).toBe('Ek4');
    expect(noteString('C', 0.5, 4)).toBe('Co4');
  });

  it('writes a sign it does not know as no sign', () => {
    expect(noteString('C', 0.25, 4)).toBe('C4');
    expect(noteString('C', 3, 4)).toBe('C4');
  });
});

describe('accidentalToken', () => {
  it('has a token for each sign', () => {
    expect([-2, -1, -0.5, 0, 0.5, 1, 2].map((a) => accidentalToken(a as Alter))).toEqual(['bb', 'b', 'k', '', 'o', '#', '##']);
  });
});

describe('pitchMidi', () => {
  it('numbers the notes like MIDI, with quarter tones between', () => {
    expect(pitchMidi(p('C4'))).toBe(60);
    expect(pitchMidi(p('A4'))).toBe(69);
    expect(pitchMidi(p('C#4'))).toBe(61);
    expect(pitchMidi(p('Bb3'))).toBe(58);
    expect(pitchMidi(p('C-1'))).toBe(0);
    expect(pitchMidi(p('C##4'))).toBe(62);
    expect(pitchMidi(p('Ek4'))).toBe(63.5);
    expect(pitchMidi(p('Co4'))).toBe(60.5);
  });

  it('counts the octave from the letter, so Cb5 is below C5 and B#3 is above B3', () => {
    expect(pitchMidi(p('Cb5'))).toBe(71);
    expect(pitchMidi(p('B#3'))).toBe(60);
    expect(pitchMidi(p('Dbb4'))).toBe(60);
  });
});

describe('pianoMidi', () => {
  it('is the key that is struck, a whole number', () => {
    expect(pianoMidi(p('C4'))).toBe(60);
    expect(pianoMidi(p('C#4'))).toBe(61);
    expect(pianoMidi(p('Cb5'))).toBe(71);
    expect(pianoMidi(p('E#4'))).toBe(65);
    expect(pianoMidi(p('Dbb4'))).toBe(60);
    expect(pianoMidi(p('B#3'))).toBe(60);
  });

  it('puts a quarter tone on the key of its own letter', () => {
    expect(pianoMidi(p('Ek4'))).toBe(64);
    expect(pianoMidi(p('Co4'))).toBe(60);
    expect(pianoMidi(p('Fk4'))).toBe(65);
    expect(pianoMidi(p('Bk3'))).toBe(59);
    expect(pianoMidi(p('Ao3'))).toBe(57);
  });
});

describe('keyName', () => {
  it('names the key with a sharp, in the right octave', () => {
    expect(keyName('C4')).toBe('C4');
    expect(keyName('C#4')).toBe('C#4');
    expect(keyName('Eb4')).toBe('D#4');
    expect(keyName('Bb3')).toBe('A#3');
    expect(keyName('Cb5')).toBe('B4');
    expect(keyName('B#3')).toBe('C4');
    expect(keyName('E#4')).toBe('F4');
    expect(keyName('Fb4')).toBe('E4');
    expect(keyName('Dbb4')).toBe('C4');
    expect(keyName('Bbb3')).toBe('A3');
    expect(keyName('C##4')).toBe('D4');
    expect(keyName('Ek4')).toBe('E4');
    expect(keyName('Co4')).toBe('C4');
  });

  it('names the key class of a name without an octave, as the old normalizer did', () => {
    expect(keyName('Db')).toBe('C#');
    expect(keyName('Cb')).toBe('B');
    expect(keyName('E#')).toBe('F');
    expect(keyName('Ek')).toBe('E');
    expect(keyName('G')).toBe('G');
  });

  it('hands back what it cannot read', () => {
    expect(keyName('nonsense')).toBe('nonsense');
    expect(keyName('')).toBe('');
  });
});

describe('frequencyOf', () => {
  it('is 440 Hz for A4 and follows the A4 setting', () => {
    expect(frequencyOf(p('A4'))).toBeCloseTo(440, 6);
    expect(frequencyOf(p('A4'), 432)).toBeCloseTo(432, 6);
    expect(frequencyOf(p('A5'))).toBeCloseTo(880, 6);
    expect(frequencyOf(p('C4'))).toBeCloseTo(261.6256, 3);
  });

  it('puts a quarter tone half way between the two neighbours', () => {
    expect(frequencyOf(p('Ek4'))).toBeCloseTo(440 * 2 ** ((63.5 - 69) / 12), 6);
    expect(frequencyOf(p('Ek4'))).toBeCloseTo(320.24, 1);
    // between D sharp (311.13) and E (329.63)
    expect(frequencyOf(p('Ek4'))).toBeGreaterThan(frequencyOf(p('D#4')));
    expect(frequencyOf(p('Ek4'))).toBeLessThan(frequencyOf(p('E4')));
  });
});

describe('soundOf', () => {
  it('is a sharp key name for the notes the sampler knows', () => {
    expect(soundOf('C4')).toBe('C4');
    expect(soundOf('Eb4')).toBe('D#4');
    expect(soundOf('Cb5')).toBe('B4');
    expect(soundOf('Dbb4')).toBe('C4');
  });

  it('is a frequency in Hz for a quarter tone', () => {
    const hz = soundOf('Ek4');
    expect(typeof hz).toBe('number');
    expect(hz as number).toBeCloseTo(320.24, 1);
    expect(soundOf('Co4') as number).toBeCloseTo(261.6256 * 2 ** (0.5 / 12), 3);
  });

  it('hands back what it cannot read', () => {
    expect(soundOf('nonsense')).toBe('nonsense');
  });
});

describe('isQuarterTone', () => {
  it('is true for koron and sori only', () => {
    expect(isQuarterTone(p('Ek4'))).toBe(true);
    expect(isQuarterTone(p('Co4'))).toBe(true);
    expect(isQuarterTone(p('Eb4'))).toBe(false);
    expect(isQuarterTone(p('C##4'))).toBe(false);
    expect(isQuarterTone(p('C4'))).toBe(false);
  });
});

describe('MUSICXML_ACCIDENTAL', () => {
  it('names each sign the way MusicXML does, and Verovio draws koron and sori', () => {
    expect(MUSICXML_ACCIDENTAL[-2]).toBe('flat-flat');
    expect(MUSICXML_ACCIDENTAL[-1]).toBe('flat');
    expect(MUSICXML_ACCIDENTAL[-0.5]).toBe('koron');
    expect(MUSICXML_ACCIDENTAL[0]).toBe('natural');
    expect(MUSICXML_ACCIDENTAL[0.5]).toBe('sori');
    expect(MUSICXML_ACCIDENTAL[1]).toBe('sharp');
    expect(MUSICXML_ACCIDENTAL[2]).toBe('double-sharp');
  });
});
