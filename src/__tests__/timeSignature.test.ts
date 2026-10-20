import { describe, it, expect } from 'vitest';
import { beatsPerMeasure, countInBeats } from '../core/timeSignature';

// The transport counts quarter notes, whatever the time signature says a beat is.

describe('beatsPerMeasure', () => {
  it('is the number of beats when a beat is a quarter note', () => {
    expect(beatsPerMeasure({ beats: 4, beatType: 4 })).toBe(4);
    expect(beatsPerMeasure({ beats: 3, beatType: 4 })).toBe(3);
    expect(beatsPerMeasure({ beats: 2, beatType: 4 })).toBe(2);
  });

  it('counts a measure of eighth notes in quarter notes: 6/8 is 3, 12/8 is 6', () => {
    expect(beatsPerMeasure({ beats: 6, beatType: 8 })).toBe(3);
    expect(beatsPerMeasure({ beats: 12, beatType: 8 })).toBe(6);
    expect(beatsPerMeasure({ beats: 3, beatType: 8 })).toBe(1.5);
  });

  it('counts half notes too: 2/2 is 4', () => {
    expect(beatsPerMeasure({ beats: 2, beatType: 2 })).toBe(4);
    expect(beatsPerMeasure({ beats: 3, beatType: 2 })).toBe(6);
  });
});

describe('countInBeats', () => {
  it('is one click for each quarter note of a bar', () => {
    expect(countInBeats({ beats: 4, beatType: 4 })).toBe(4);
    expect(countInBeats({ beats: 3, beatType: 4 })).toBe(3);
    expect(countInBeats({ beats: 6, beatType: 8 })).toBe(3);
  });

  it('is a whole number of clicks, rounding half a beat up', () => {
    expect(countInBeats({ beats: 3, beatType: 8 })).toBe(2);
    expect(countInBeats({ beats: 5, beatType: 8 })).toBe(3);
    expect(countInBeats({ beats: 7, beatType: 8 })).toBe(4);
  });

  it('is at least one click', () => {
    expect(countInBeats({ beats: 1, beatType: 16 })).toBe(1);
  });
});
