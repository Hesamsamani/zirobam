import { describe, it, expect } from 'vitest';
import { buildTimingEventList, effectiveHand, getAllPitchesFromNote, noteDataToPitch } from '../practice/timingEvents';
import type { NoteData } from '../musicGenerator';

const note = (step: string, octave: number, duration: number, extra: Partial<NoteData> = {}): NoteData => ({
  step,
  alter: 0,
  octave,
  duration,
  isRest: false,
  ...extra,
});
const rest = (duration: number): NoteData => ({ step: 'C', alter: 0, octave: 4, duration, isRest: true });

describe('noteDataToPitch and getAllPitchesFromNote', () => {
  it('writes the pitch with its sharp or flat, and nothing for a rest', () => {
    expect(noteDataToPitch(note('C', 4, 1))).toBe('C4');
    expect(noteDataToPitch(note('F', 5, 1, { alter: 1 }))).toBe('F#5');
    expect(noteDataToPitch(note('B', 3, 1, { alter: -1 }))).toBe('Bb3');
    expect(noteDataToPitch(rest(1))).toBeNull();
  });

  it('takes the notes of a chord too', () => {
    const chord = note('C', 4, 2, { chordNotes: [{ step: 'E', alter: 0, octave: 4 }, { step: 'G', alter: 1, octave: 4 }] });
    expect(getAllPitchesFromNote(chord)).toEqual(['C4', 'E4', 'G#4']);
    expect(getAllPitchesFromNote(rest(2))).toEqual([]);
  });
});

describe('buildTimingEventList, both hands', () => {
  it('puts the notes of both hands that sound together in one event', () => {
    const events = buildTimingEventList([note('E', 4, 1), note('G', 4, 1)], [note('C', 3, 2)]);
    expect(events).toEqual([
      { time: 0, duration: 1, pitches: ['E4', 'C3'], isTieContinuation: false, tiedPitches: undefined },
      { time: 1, duration: 1, pitches: ['G4'], isTieContinuation: false, tiedPitches: undefined },
    ]);
  });

  it('gives a rest an event without pitches', () => {
    const events = buildTimingEventList([rest(1), note('C', 4, 1)], []);
    expect(events.map((e) => e.pitches)).toEqual([[], ['C4']]);
  });

  it('marks the pitches that are held over a tie', () => {
    const events = buildTimingEventList([note('C', 4, 1, { tieStart: true }), note('C', 4, 1, { tieEnd: true }), note('D', 4, 1)], []);
    expect(events[1]).toMatchObject({ pitches: ['C4'], isTieContinuation: true, tiedPitches: ['C4'] });
    expect(events[0].isTieContinuation).toBe(false);
  });

  it('works out each duration from the next event', () => {
    const events = buildTimingEventList([note('C', 4, 2)], [note('C', 3, 1), note('G', 3, 1)]);
    expect(events.map((e) => [e.time, e.duration])).toEqual([
      [0, 1],
      [1, 1],
    ]);
  });

  it('has no accompaniment', () => {
    const events = buildTimingEventList([note('C', 4, 1)], [note('C', 3, 1)]);
    expect(events[0].accompaniment).toBeUndefined();
  });
});

describe('buildTimingEventList, one hand at a time', () => {
  const right = [note('E', 4, 1), note('G', 4, 1), note('C', 5, 2)];
  const left = [note('C', 3, 2), note('G', 2, 2)];

  it('asks only for the notes of the right hand, and gives the left hand as accompaniment', () => {
    const events = buildTimingEventList(right, left, 'right');
    expect(events.map((e) => e.pitches)).toEqual([['E4'], ['G4'], ['C5']]);
    expect(events.map((e) => e.accompaniment)).toEqual([['C3'], undefined, ['G2']]);
  });

  it('asks only for the left hand, and plays the right hand', () => {
    const events = buildTimingEventList(right, left, 'left');
    expect(events.map((e) => e.pitches)).toEqual([['C3'], [], ['G2']]);
    expect(events.map((e) => e.accompaniment)).toEqual([['E4'], ['G4'], ['C5']]);
  });

  it('keeps an event for accompaniment that has no note of the practised hand, so it is still played', () => {
    const events = buildTimingEventList([note('C', 4, 2)], [note('C', 3, 1), note('G', 3, 1)], 'right');
    expect(events.map((e) => [e.time, e.pitches, e.accompaniment])).toEqual([
      [0, ['C4'], ['C3']],
      [1, [], ['G3']],
    ]);
  });

  it('counts a tie in the practised hand, but not in the accompaniment', () => {
    const events = buildTimingEventList(
      [note('C', 4, 1, { tieStart: true }), note('C', 4, 1, { tieEnd: true })],
      [note('G', 2, 1, { tieStart: true }), note('G', 2, 1, { tieEnd: true })],
      'right',
    );
    expect(events[1]).toMatchObject({ pitches: ['C4'], tiedPitches: ['C4'], isTieContinuation: true });
    expect(events[1].accompaniment).toBeUndefined(); // the left-hand note is still ringing, so it is not played again
  });
});

describe('effectiveHand', () => {
  const some = [note('C', 4, 1)];
  const none = [rest(4)];

  it('keeps the choice when that hand has notes', () => {
    expect(effectiveHand(some, some, 'right')).toBe('right');
    expect(effectiveHand(some, some, 'left')).toBe('left');
    expect(effectiveHand(some, some, 'both')).toBe('both');
  });

  it('falls back to both hands when the chosen hand only rests, so a step never asks for nothing', () => {
    expect(effectiveHand(some, none, 'left')).toBe('both');
    expect(effectiveHand(none, some, 'right')).toBe('both');
  });
});
