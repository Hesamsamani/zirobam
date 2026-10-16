import { describe, it, expect } from 'vitest';
import { spellFromMidi } from '../core/noteUtils';

describe('spellFromMidi', () => {
  it('keeps natural notes plain', () => {
    expect(spellFromMidi('C', 4, 60)).toBe('C');
    expect(spellFromMidi('A', 4, 69)).toBe('A');
  });

  it('adds a sharp or flat from the sounding pitch (key signatures included)', () => {
    expect(spellFromMidi('F', 4, 66)).toBe('F#');
    expect(spellFromMidi('B', 4, 70)).toBe('Bb');
    expect(spellFromMidi('C', 5, 73)).toBe('C#');
  });

  it('handles enharmonic spellings that cross the letter boundary', () => {
    expect(spellFromMidi('E', 4, 65)).toBe('E#');
    expect(spellFromMidi('C', 4, 59)).toBe('Cb');
  });

  it('falls back to the plain letter when the pitch is more than a semitone away', () => {
    expect(spellFromMidi('C', 4, 62)).toBe('C');
  });
});
