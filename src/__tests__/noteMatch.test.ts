import { describe, expect, it } from 'vitest';
import { noteheadMatchesKey } from '../practice/noteMatch';

describe('noteheadMatchesKey', () => {
  it('matches a notehead on the letter and octave of an expected note whose key was pressed', () => {
    expect(noteheadMatchesKey(['G4'], 'G', '4', 'G4')).toBe(true);
    expect(noteheadMatchesKey(['G#4'], 'G', '4', 'G#4')).toBe(true);
  });

  it('matches a flat by its key: B flat is drawn on B and played on the key that is called A sharp', () => {
    expect(noteheadMatchesKey(['Bb3'], 'B', '3', 'A#3')).toBe(true);
  });

  it('does not match a notehead of another letter, even when its key was pressed', () => {
    // the A sharp key was pressed; the expected note is B flat, so the A notehead is not the one
    expect(noteheadMatchesKey(['Bb3'], 'A', '3', 'A#3')).toBe(false);
  });

  it('does not match the right letter for the wrong key', () => {
    expect(noteheadMatchesKey(['Bb3'], 'B', '3', 'B3')).toBe(false);
  });

  it('keeps the octave of the written note, not of the key: C flat 5 is drawn in octave 5 and played on B4', () => {
    expect(noteheadMatchesKey(['Cb5'], 'C', '5', 'B4')).toBe(true);
    expect(noteheadMatchesKey(['Cb5'], 'B', '4', 'B4')).toBe(false);
  });

  it('finds the notehead of a chord among all its pitches', () => {
    expect(noteheadMatchesKey(['Bb3', 'D4', 'F4'], 'D', '4', 'D4')).toBe(true);
    expect(noteheadMatchesKey(['Bb3', 'D4', 'F4'], 'B', '3', 'A#3')).toBe(true);
    expect(noteheadMatchesKey(['Bb3', 'D4', 'F4'], 'E', '4', 'E4')).toBe(false);
  });

  it('takes a quarter tone on the key of its letter: E koron is played on E', () => {
    expect(noteheadMatchesKey(['Ek4'], 'E', '4', 'E4')).toBe(true);
  });

  it('has nothing to match when nothing is expected, or the pitch cannot be read', () => {
    expect(noteheadMatchesKey([], 'C', '4', 'C4')).toBe(false);
    expect(noteheadMatchesKey(['not a note'], 'C', '4', 'C4')).toBe(false);
  });
});
