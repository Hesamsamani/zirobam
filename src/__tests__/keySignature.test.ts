import { describe, it, expect } from 'vitest';
import { fifthsOfNames, keyAlter } from '../theory/keySignature';

describe('keyAlter', () => {
  it('is the sign a key signature puts on a letter', () => {
    expect(keyAlter('F', 1)).toBe(1);
    expect(keyAlter('C', 1)).toBe(0);
    expect(keyAlter('C', 2)).toBe(1);
    expect(keyAlter('B', -1)).toBe(-1);
    expect(keyAlter('E', -1)).toBe(0);
    expect(keyAlter('E', -2)).toBe(-1);
    expect(keyAlter('F', 7)).toBe(1);
    expect(keyAlter('F', -7)).toBe(-1);
    expect(keyAlter('G', 0)).toBe(0);
  });
});

describe('fifthsOfNames', () => {
  it('finds the key signature that gives seven notes their signs', () => {
    expect(fifthsOfNames(['C', 'D', 'E', 'F', 'G', 'A', 'B'])).toBe(0);
    expect(fifthsOfNames(['D', 'E', 'F#', 'G', 'A', 'B', 'C#'])).toBe(2);
    expect(fifthsOfNames(['Db', 'Eb', 'F', 'Gb', 'Ab', 'Bb', 'C'])).toBe(-5);
    expect(fifthsOfNames(['C#', 'D#', 'E#', 'F#', 'G#', 'A#', 'B#'])).toBe(7);
    expect(fifthsOfNames(['Cb', 'Db', 'Eb', 'Fb', 'Gb', 'Ab', 'Bb'])).toBe(-7);
  });

  it('is null when the signs do not make a key signature', () => {
    expect(fifthsOfNames(['A', 'B', 'C', 'D', 'E', 'F', 'G#'])).toBeNull(); // harmonic minor
    expect(fifthsOfNames(['C', 'Dk', 'E', 'F', 'G', 'Ak', 'B'])).toBeNull(); // quarter tones
    expect(fifthsOfNames(['C', 'D', 'E', 'F#', 'G', 'A', 'Bb'])).toBeNull(); // sharps and flats mixed
    expect(fifthsOfNames(['C', 'D', 'E', 'F', 'G', 'A', 'B##'])).toBeNull();
  });

  it('is null unless every letter is there once', () => {
    expect(fifthsOfNames(['C', 'D', 'E', 'G', 'A'])).toBeNull(); // a pentatonic scale
    expect(fifthsOfNames(['C', 'D', 'E', 'F', 'G', 'A', 'A'])).toBeNull();
    expect(fifthsOfNames([])).toBeNull();
    expect(fifthsOfNames(['C', 'D', 'E', 'F', 'G', 'A', 'x'])).toBeNull();
  });
});
