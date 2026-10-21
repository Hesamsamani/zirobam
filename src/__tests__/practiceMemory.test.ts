import { describe, it, expect } from 'vitest';
import { MistakeLog } from '../stats/mistakeLog';
import { SrsStore } from '../stats/srs';
import { PracticeMemory, answersFromPress } from '../stats/practiceMemory';

function memoryStorage() {
  const data = new Map<string, string>();
  return { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => void data.set(key, value) };
}

function setup(day = '2026-10-21') {
  const log = new MistakeLog(memoryStorage(), () => day);
  const srs = new SrsStore(memoryStorage(), () => day);
  return { memory: new PracticeMemory(log, srs), log, srs, day };
}

describe('answersFromPress', () => {
  it('credits a right key to the written note it matched, whatever it is called on the keyboard', () => {
    // the piece has B flat; the keyboard says A sharp
    expect(answersFromPress(['Bb4'], 'A#4', true)).toEqual([{ note: 'Bb4', correct: true }]);
    expect(answersFromPress(['Cb5'], 'B4', true)).toEqual([{ note: 'Cb5', correct: true }]);
  });

  it('credits only the note of a chord that was played', () => {
    expect(answersFromPress(['C4', 'E4', 'G4'], 'E4', true)).toEqual([{ note: 'E4', correct: true }]);
  });

  it('counts a wrong key against every note that was waited for', () => {
    expect(answersFromPress(['C4', 'E4'], 'D4', false)).toEqual([
      { note: 'C4', correct: false },
      { note: 'E4', correct: false },
    ]);
  });

  it('says nothing about a right key that matches none of the notes, or when nothing was waited for', () => {
    expect(answersFromPress(['C4'], 'D4', true)).toEqual([]);
    expect(answersFromPress([], 'D4', false)).toEqual([]);
  });
});

describe('PracticeMemory', () => {
  it('a note answered right or wrong goes into both the mistake log and the boxes', () => {
    const { memory, log, srs, day } = setup();
    memory.noteAnswered('C4', true);
    memory.noteAnswered('C4', false);
    memory.noteAnswered('F#4', true);
    expect(log.aggregate(day, day).notes).toEqual({ C4: { asked: 2, missed: 1 }, 'F#4': { asked: 1, missed: 0 } });
    expect(srs.get('note:C4')).toMatchObject({ box: 1, seen: 2, wrong: 1 }); // the last answer was wrong
    expect(srs.get('note:F#4')).toMatchObject({ box: 2 });
  });

  it('a key press is turned into the answers it stands for', () => {
    const { memory, log, day } = setup();
    memory.keyPressed(['Bb4'], 'A#4', true);
    memory.keyPressed(['Bb4'], 'C5', false);
    expect(log.aggregate(day, day).notes).toEqual({ Bb4: { asked: 2, missed: 1 } });
  });

  it('an ear question goes into the boxes under its own name, not into the notes', () => {
    const { memory, log, srs, day } = setup();
    memory.earAnswered('interval:m3', false);
    expect(srs.get('ear:interval:m3')).toMatchObject({ box: 1, wrong: 1 });
    expect(log.aggregate(day, day).notes).toEqual({});
  });

  it('can be made without arguments, on the browser storage', () => {
    localStorage.clear();
    const memory = new PracticeMemory();
    memory.noteAnswered('C4', true);
    expect(localStorage.getItem('mistakes.v1')).toContain('C4');
    expect(localStorage.getItem('srs.v1')).toContain('note:C4');
    localStorage.clear();
  });
});
