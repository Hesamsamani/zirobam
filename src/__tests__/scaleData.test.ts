import { describe, it, expect } from 'vitest';
import { CHORD_TYPES, ROOT_PITCH_CLASSES, SCALE_TYPES, chordOf, fingering, scaleOf, type ChordType, type ScaleType } from '../scales/scaleData';

const midi = (note: string): number => {
  const m = /^([A-G])(#|b)?(\d)$/.exec(note)!;
  return (Number(m[3]) + 1) * 12 + { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1] as 'C'] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
};

describe('scaleOf', () => {
  it('writes the C major scale up one octave, with no key signature', () => {
    expect(scaleOf(0, 'major')).toMatchObject({ root: 'C', fifths: 0, notes: ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5'] });
  });

  it('spells a scale with the fewest signs: D flat major, not C sharp major', () => {
    const scale = scaleOf(1, 'major');
    expect(scale.root).toBe('Db');
    expect(scale.fifths).toBe(-5);
    expect(scale.notes).toEqual(['Db4', 'Eb4', 'F4', 'Gb4', 'Ab4', 'Bb4', 'C5', 'Db5']);
  });

  it('knows the key signature of the major and the natural minor scales', () => {
    expect(scaleOf(7, 'major').fifths).toBe(1); // G
    expect(scaleOf(9, 'minor').fifths).toBe(0); // A minor
    expect(scaleOf(4, 'minor').fifths).toBe(1); // E minor
    expect(scaleOf(2, 'minor').fifths).toBe(-1); // D minor
    expect(scaleOf(11, 'major').fifths).toBe(5); // B
  });

  it('has no key signature for the other scales: their signs are written at the notes', () => {
    for (const type of ['harmonic', 'melodic', 'pentaMajor', 'pentaMinor'] as ScaleType[]) expect(scaleOf(0, type).fifths).toBeNull();
  });

  it('raises the seventh in the harmonic minor, and the sixth and seventh in the melodic minor going up', () => {
    expect(scaleOf(9, 'harmonic').notes).toEqual(['A4', 'B4', 'C5', 'D5', 'E5', 'F5', 'G#5', 'A5']);
    expect(scaleOf(9, 'melodic').notes).toEqual(['A4', 'B4', 'C5', 'D5', 'E5', 'F#5', 'G#5', 'A5']);
  });

  it('has the five notes of the pentatonic scales, then the octave', () => {
    expect(scaleOf(0, 'pentaMajor').notes).toEqual(['C4', 'D4', 'E4', 'G4', 'A4', 'C5']);
    expect(scaleOf(9, 'pentaMinor').notes).toEqual(['A4', 'C5', 'D5', 'E5', 'G5', 'A5']);
  });

  it('never needs a double sharp or a double flat, in any key', () => {
    for (const pc of ROOT_PITCH_CLASSES) {
      for (const type of SCALE_TYPES) {
        for (const note of scaleOf(pc, type).notes) expect(note, `${pc} ${type}`).toMatch(/^[A-G][#b]?\d$/);
      }
    }
  });

  it('goes up note by note and ends an octave above the start', () => {
    for (const pc of ROOT_PITCH_CLASSES) {
      for (const type of SCALE_TYPES) {
        const notes = scaleOf(pc, type).notes;
        for (let i = 1; i < notes.length; i++) expect(midi(notes[i]), `${pc} ${type}`).toBeGreaterThan(midi(notes[i - 1]));
        expect(midi(notes.at(-1)!) - midi(notes[0]), `${pc} ${type}`).toBe(12);
        expect(midi(notes.at(-1)!)).toBeLessThanOrEqual(midi('C6'));
      }
    }
  });
});

describe('chordOf', () => {
  const notes = (pc: number, type: ChordType) => chordOf(pc, type).notes;

  it('writes the notes of each kind of chord from the root up', () => {
    expect(notes(0, 'major')).toEqual(['C4', 'E4', 'G4']);
    expect(notes(0, 'minor')).toEqual(['C4', 'Eb4', 'G4']);
    expect(notes(0, 'dim')).toEqual(['C4', 'Eb4', 'Gb4']);
    expect(notes(0, 'aug')).toEqual(['C4', 'E4', 'G#4']);
    expect(notes(0, 'maj7')).toEqual(['C4', 'E4', 'G4', 'B4']);
    expect(notes(0, 'm7')).toEqual(['C4', 'Eb4', 'G4', 'Bb4']);
    expect(notes(0, 'dom7')).toEqual(['C4', 'E4', 'G4', 'Bb4']);
  });

  it('goes over the octave when it has to', () => {
    expect(notes(11, 'major')).toEqual(['B4', 'D#5', 'F#5']);
  });

  it('spells the root with the fewest signs for a major chord too', () => {
    expect(chordOf(1, 'major').root).toBe('Db');
    expect(chordOf(6, 'major').root).toBe('F#');
  });

  it('has no key signature, and no double signs, in any key', () => {
    for (const pc of ROOT_PITCH_CLASSES) {
      for (const type of CHORD_TYPES) {
        const chord = chordOf(pc, type);
        expect(chord.fifths).toBeNull();
        for (const note of chord.notes) expect(note, `${pc} ${type}`).toMatch(/^[A-G][#b]?\d$/);
        for (let i = 1; i < chord.notes.length; i++) expect(midi(chord.notes[i])).toBeGreaterThan(midi(chord.notes[i - 1]));
      }
    }
  });
});

describe('fingering', () => {
  it('has the usual fingering of the major scales in the keys that use only white-key names', () => {
    expect(fingering(scaleOf(0, 'major'), 'right')).toEqual([1, 2, 3, 1, 2, 3, 4, 5]);
    expect(fingering(scaleOf(0, 'major'), 'left')).toEqual([5, 4, 3, 2, 1, 3, 2, 1]);
    expect(fingering(scaleOf(5, 'major'), 'right')).toEqual([1, 2, 3, 4, 1, 2, 3, 4]); // F
    expect(fingering(scaleOf(11, 'major'), 'left')).toEqual([4, 3, 2, 1, 4, 3, 2, 1]); // B
    expect(fingering(scaleOf(7, 'major'), 'right')).toEqual([1, 2, 3, 1, 2, 3, 4, 5]); // G
  });

  it('has fingering for A, E and D minor', () => {
    for (const pc of [9, 4, 2]) {
      expect(fingering(scaleOf(pc, 'minor'), 'right')).toEqual([1, 2, 3, 1, 2, 3, 4, 5]);
      expect(fingering(scaleOf(pc, 'harmonic'), 'left')).toEqual([5, 4, 3, 2, 1, 3, 2, 1]);
    }
  });

  it('says nothing for what teachers do not agree on, or what it does not know', () => {
    expect(fingering(scaleOf(1, 'major'), 'right')).toBeNull(); // D flat
    expect(fingering(scaleOf(6, 'major'), 'right')).toBeNull(); // F sharp
    expect(fingering(scaleOf(0, 'pentaMajor'), 'right')).toBeNull();
    expect(fingering(scaleOf(10, 'minor'), 'left')).toBeNull();
    expect(fingering(chordOf(0, 'major'), 'right')).toBeNull();
  });

  it('has one finger per note', () => {
    for (const pc of ROOT_PITCH_CLASSES) {
      for (const type of SCALE_TYPES) {
        for (const hand of ['right', 'left'] as const) {
          const scale = scaleOf(pc, type);
          const fingers = fingering(scale, hand);
          if (fingers) expect(fingers).toHaveLength(scale.notes.length);
        }
      }
    }
  });
});
