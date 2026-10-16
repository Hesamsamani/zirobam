import { describe, it, expect } from 'vitest';
import { WaitSession, countWaitNotes } from '../practice/waitMode';

const ev = (pitches: string[], tiedPitches?: string[]) => ({ pitches, tiedPitches });

describe('WaitSession', () => {
  it('waits at the first note and moves on when it is played', () => {
    const s = new WaitSession([ev(['C4']), ev(['D4']), ev(['E4'])]);
    expect(s.index()).toBe(0);
    expect(s.expected()).toEqual(['C4']);
    expect(s.press('C4')).toEqual({ result: 'advance', index: 1 });
    expect(s.expected()).toEqual(['D4']);
    expect(s.press('D4')).toEqual({ result: 'advance', index: 2 });
    expect(s.press('E4')).toEqual({ result: 'done', index: 2 });
    expect(s.finished()).toBe(true);
  });

  it('stays at the note while a wrong one is played, and counts it', () => {
    const s = new WaitSession([ev(['C4']), ev(['D4'])]);
    expect(s.press('E4')).toEqual({ result: 'wrong', index: 0 });
    expect(s.press('F4')).toEqual({ result: 'wrong', index: 0 });
    expect(s.index()).toBe(0);
    expect(s.press('C4').result).toBe('advance');
  });

  it('waits for every note of a chord, in any order', () => {
    const s = new WaitSession([ev(['C4', 'E4', 'G4']), ev(['D4'])]);
    expect(s.press('G4')).toEqual({ result: 'partial', index: 0, matched: 'G4' });
    expect(s.press('C4')).toEqual({ result: 'partial', index: 0, matched: 'C4' });
    expect(s.expected()).toEqual(['E4']); // what is still missing
    expect(s.press('E4')).toEqual({ result: 'advance', index: 1 });
  });

  it('ignores a note of the chord that was played twice', () => {
    const s = new WaitSession([ev(['C4', 'E4'])]);
    s.press('C4');
    expect(s.press('C4')).toEqual({ result: 'ignored', index: 0 });
    expect(s.press('E4').result).toBe('done');
  });

  it('skips rests and notes that are only held over a tie', () => {
    const s = new WaitSession([ev(['C4']), ev([]), ev(['C4'], ['C4']), ev(['D4'])]);
    expect(s.press('C4')).toEqual({ result: 'advance', index: 3 });
    expect(s.expected()).toEqual(['D4']);
  });

  it('asks only for the new notes of an event that also holds a tied note', () => {
    const s = new WaitSession([ev(['C4']), ev(['C4', 'G3'], ['C4'])]);
    s.press('C4');
    expect(s.expected()).toEqual(['G3']);
    expect(s.press('G3').result).toBe('done');
  });

  it('starts after the rests at the beginning', () => {
    const s = new WaitSession([ev([]), ev([]), ev(['E4'])]);
    expect(s.index()).toBe(2);
  });

  it('is finished at once when there is nothing to play', () => {
    expect(new WaitSession([ev([]), ev([])]).finished()).toBe(true);
    expect(new WaitSession([]).finished()).toBe(true);
  });

  it('does nothing once it is finished', () => {
    const s = new WaitSession([ev(['C4'])]);
    s.press('C4');
    expect(s.press('C4')).toEqual({ result: 'ignored', index: 0 });
  });

  it('treats a sharp and its flat as the same key', () => {
    const s = new WaitSession([ev(['Bb3']), ev(['C#4'])]);
    expect(s.press('A#3').result).toBe('advance');
    expect(s.press('Db4').result).toBe('done');
  });

  it('knows how many keys have to be pressed in all', () => {
    expect(countWaitNotes([ev(['C4', 'E4']), ev([]), ev(['C4'], ['C4']), ev(['D4', 'C4'], ['C4'])])).toBe(3);
  });

  it('starts again from the first note', () => {
    const s = new WaitSession([ev(['C4']), ev(['D4'])]);
    s.press('C4');
    s.restart();
    expect(s.index()).toBe(0);
    expect(s.finished()).toBe(false);
  });
});
