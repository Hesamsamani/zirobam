import { describe, it, expect } from 'vitest';
import { getChord } from '../theory/chordCatalog';
import { romanNumeral } from '../theory/roman';

const roman = (scaleRoot: string, chordRoot: string, id: string) => romanNumeral(scaleRoot, chordRoot, getChord(id));

describe('romanNumeral', () => {
  it('numbers the triads of C major: capitals for major, small letters for minor, a circle for diminished', () => {
    expect([roman('C', 'C', 'major'), roman('C', 'D', 'minor'), roman('C', 'E', 'minor'), roman('C', 'F', 'major'), roman('C', 'G', 'major'), roman('C', 'A', 'minor'), roman('C', 'B', 'dim')]).toEqual([
      'I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°',
    ]);
  });

  it('adds what the chord adds: sevenths, half diminished, sixths', () => {
    expect([roman('C', 'C', 'maj7'), roman('C', 'D', 'm7'), roman('C', 'G', 'dom7'), roman('C', 'B', 'm7b5'), roman('C', 'B', 'dim7'), roman('C', 'C', 'six'), roman('C', 'D', 'm6')]).toEqual([
      'Imaj7', 'ii7', 'V7', 'viiø7', 'vii°7', 'I6', 'ii6',
    ]);
  });

  it('writes the chords that are neither major nor minor in capitals', () => {
    expect([roman('C', 'G', 'sus4'), roman('C', 'C', 'sus2'), roman('C', 'C', 'power'), roman('C', 'C', 'aug'), roman('C', 'D', 'quartal')]).toEqual(['Vsus4', 'Isus2', 'I5', 'I+', 'II']);
    expect([roman('C', 'C', 'add9'), roman('C', 'D', 'madd9'), roman('C', 'G', 'dom13'), roman('C', 'G', 'dom7b9')]).toEqual(['Iadd9', 'iiadd9', 'V13', 'V7♭9']);
  });

  it('puts a flat or a sharp before the numeral when the root is not on the major scale', () => {
    expect(roman('C', 'Db', 'major')).toBe('♭II');
    expect(roman('C', 'Bb', 'major')).toBe('♭VII');
    expect(roman('C', 'Eb', 'major')).toBe('♭III');
    expect(roman('C', 'F#', 'dim')).toBe('♯iv°');
    expect(roman('C', 'Ebb', 'major')).toBe('♭♭III');
    expect(roman('C', 'Cb', 'major')).toBe('♭I');
  });

  it('counts from the root of the scale, whatever it is', () => {
    expect(roman('G', 'D', 'dom7')).toBe('V7');
    expect(roman('Bb', 'Eb', 'major')).toBe('IV');
    expect(roman('F#', 'C#', 'minor')).toBe('v');
    expect(roman('Db', 'Gb', 'maj7')).toBe('IVmaj7');
  });

  it('numbers a minor scale against the major scale on the same root, the way jazz does', () => {
    expect([
      roman('A', 'A', 'minor'), roman('A', 'B', 'dim'), roman('A', 'C', 'major'), roman('A', 'D', 'minor'), roman('A', 'E', 'minor'), roman('A', 'F', 'major'), roman('A', 'G', 'major'),
    ]).toEqual(['i', 'ii°', '♭III', 'iv', 'v', '♭VI', '♭VII']);
    // harmonic minor
    expect(roman('A', 'E', 'major')).toBe('V');
    expect(roman('A', 'G#', 'dim')).toBe('vii°');
    expect(roman('A', 'C', 'aug')).toBe('♭III+');
  });

  it('marks a root a quarter tone off the major scale with k or o', () => {
    expect(roman('Ek', 'F', 'major')).toBe('kII');
    expect(roman('Ek', 'G', 'minor')).toBe('kiii');
  });

  it('refuses a name that is not a note name', () => {
    expect(() => roman('C4', 'D', 'minor')).toThrow();
    expect(() => roman('C', 'x', 'minor')).toThrow();
  });
});
