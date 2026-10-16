import { describe, it, expect } from 'vitest';
import { SongRun, ReadRound, starsFor } from '../xylophone/xyloGame';
import { NoteStats } from '../learn/noteStats';

function fakeStorage() {
  const data: Record<string, string> = {};
  return {
    getItem: (k: string) => (k in data ? data[k] : null),
    setItem: (k: string, v: string) => {
      data[k] = v;
    },
    data,
  };
}

describe('starsFor', () => {
  it('gives three stars for an accuracy of 90 percent or more', () => {
    expect(starsFor(26, 0)).toBe(3);
    expect(starsFor(26, 2)).toBe(3); // 26 of 28
  });

  it('gives two stars from 70 percent', () => {
    expect(starsFor(26, 3)).toBe(2); // 26 of 29 = 89.7 percent
    expect(starsFor(26, 11)).toBe(2); // 26 of 37 = 70.3 percent
  });

  it('always gives at least one star for finishing', () => {
    expect(starsFor(26, 12)).toBe(1);
    expect(starsFor(26, 500)).toBe(1);
  });
});

describe('SongRun', () => {
  const notes = ['C4', 'D4', 'E4'];

  it('starts on the first note', () => {
    const run = new SongRun(notes);
    expect(run.current()).toBe('C4');
    expect(run.position()).toEqual({ index: 0, total: 3 });
    expect(run.isDone()).toBe(false);
  });

  it('moves on when the right note is played', () => {
    const run = new SongRun(notes);
    expect(run.play('C4')).toEqual({ correct: true, done: false });
    expect(run.current()).toBe('D4');
    expect(run.position().index).toBe(1);
  });

  it('stays on the note and counts a mistake when a wrong note is played', () => {
    const run = new SongRun(notes);
    expect(run.play('G4')).toEqual({ correct: false, done: false });
    expect(run.current()).toBe('C4');
    expect(run.mistakes()).toBe(1);
  });

  it('is done after the last note, with stars from the mistakes', () => {
    const run = new SongRun(notes);
    run.play('C4');
    run.play('A4');
    run.play('D4');
    expect(run.play('E4')).toEqual({ correct: true, done: true });
    expect(run.isDone()).toBe(true);
    expect(run.current()).toBeNull();
    expect(run.stars()).toBe(starsFor(3, 1));
  });

  it('ignores notes after it is done', () => {
    const run = new SongRun(['C4']);
    run.play('C4');
    expect(run.play('D4')).toEqual({ correct: false, done: true });
    expect(run.mistakes()).toBe(0);
  });

  it('can start again from the beginning', () => {
    const run = new SongRun(notes);
    run.play('X1');
    run.play('C4');
    run.restart();
    expect(run.current()).toBe('C4');
    expect(run.mistakes()).toBe(0);
    expect(run.isDone()).toBe(false);
  });

  it('needs at least one note', () => {
    expect(() => new SongRun([])).toThrow();
  });
});

describe('ReadRound', () => {
  const pool = ['C4', 'D4', 'E4'];
  const seeded = () => {
    let s = 7;
    return () => {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      return s / 4294967296;
    };
  };

  it('asks for a note from the pool and never the same one twice in a row', () => {
    const round = new ReadRound(new NoteStats(fakeStorage(), 'x'), pool, seeded());
    let last = '';
    for (let i = 0; i < 30; i++) {
      const pitch = round.next();
      expect(pool).toContain(pitch);
      expect(pitch).not.toBe(last);
      last = pitch;
    }
  });

  it('tells whether an answer was right, and which note was asked', () => {
    const round = new ReadRound(new NoteStats(fakeStorage(), 'x'), pool, seeded());
    const asked = round.next();
    const wrong = pool.find((p) => p !== asked)!;
    expect(round.answer(wrong)).toEqual({ correct: false, expected: asked });
  });

  it('counts only the first answer to a question', () => {
    const stats = new NoteStats(fakeStorage(), 'x');
    const round = new ReadRound(stats, pool, seeded());
    const asked = round.next();
    round.answer(asked);
    round.answer(asked);
    expect(stats.get(asked)!.seen).toBe(1);
  });

  it('keeps a streak of right answers and the best streak', () => {
    const round = new ReadRound(new NoteStats(fakeStorage(), 'x'), pool, seeded());
    for (let i = 0; i < 3; i++) round.answer(round.next() && round.current()!);
    expect(round.streak()).toBe(3);
    const asked = round.next();
    round.answer(pool.find((p) => p !== asked)!);
    expect(round.streak()).toBe(0);
    expect(round.bestStreak()).toBe(3);
  });

  it('saves the result in the notes statistics so weak notes come back more often', () => {
    const storage = fakeStorage();
    const stats = new NoteStats(storage, 'xyloStats.v1');
    const round = new ReadRound(stats, pool, seeded());
    const asked = round.next();
    round.answer(pool.find((p) => p !== asked)!);
    expect(stats.get(asked)).toMatchObject({ seen: 1, correct: 0 });
    expect(Object.keys(storage.data)).toEqual(['xyloStats.v1']);
  });

  it('switches to a new pool', () => {
    const round = new ReadRound(new NoteStats(fakeStorage(), 'x'), pool, seeded());
    round.setPool(['G5', 'A5']);
    expect(['G5', 'A5']).toContain(round.next());
  });

  it('refuses to answer before a question was asked', () => {
    const round = new ReadRound(new NoteStats(fakeStorage(), 'x'), pool, seeded());
    expect(() => round.answer('C4')).toThrow();
  });
});
