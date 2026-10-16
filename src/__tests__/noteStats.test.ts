import { describe, it, expect } from 'vitest';
import { NoteStats, RECENT_LIMIT } from '../learn/noteStats';

function fakeStorage(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return {
    data,
    getItem: (k: string) => (k in data ? data[k] : null),
    setItem: (k: string, v: string) => {
      data[k] = v;
    },
  };
}

describe('NoteStats', () => {
  it('counts answers per pitch', () => {
    const stats = new NoteStats(fakeStorage());
    stats.record('C4', 1, true, 100);
    stats.record('C4', 1, false, 200);
    expect(stats.get('C4')).toEqual({ seen: 2, correct: 1, lastSeen: 200 });
    expect(stats.get('D4')).toBeUndefined();
  });

  it('keeps only the last 20 answers per stage', () => {
    const stats = new NoteStats(fakeStorage());
    for (let i = 0; i < 25; i++) stats.record('C4', 1, i >= 5);
    expect(stats.recent(1)).toEqual({ answered: RECENT_LIMIT, accuracy: 1 });
    expect(stats.recent(2)).toEqual({ answered: 0, accuracy: 0 });
  });

  it('saves and reloads', () => {
    const storage = fakeStorage();
    new NoteStats(storage).record('E4', 1, true);
    expect(new NoteStats(storage).get('E4')?.seen).toBe(1);
  });

  it('starts empty on corrupt or unknown data', () => {
    expect(new NoteStats(fakeStorage({ 'noteStats.v1': '{not json' })).get('C4')).toBeUndefined();
    expect(new NoteStats(fakeStorage({ 'noteStats.v1': JSON.stringify({ version: 9 }) })).getMaxStage()).toBe(1);
  });

  it('works without storage', () => {
    const stats = new NoteStats(null);
    stats.record('C4', 1, true);
    expect(stats.get('C4')?.seen).toBe(1);
  });

  it('only ever raises the unlocked stage, up to 5', () => {
    const stats = new NoteStats(fakeStorage());
    expect(stats.unlock(2)).toBe(true);
    expect(stats.unlock(2)).toBe(false);
    expect(stats.unlock(1)).toBe(false);
    expect(stats.unlock(6)).toBe(false);
    expect(stats.getMaxStage()).toBe(2);
  });

  it('keeps separate statistics under a different storage key', () => {
    const storage = fakeStorage();
    const quiz = new NoteStats(storage);
    const xylophone = new NoteStats(storage, 'xyloStats.v1');
    quiz.record('C4', 1, true);
    xylophone.record('D4', 1, false);
    expect(Object.keys(storage.data).sort()).toEqual(['noteStats.v1', 'xyloStats.v1']);
    expect(new NoteStats(storage).get('D4')).toBeUndefined();
    expect(new NoteStats(storage, 'xyloStats.v1').get('D4')).toMatchObject({ seen: 1, correct: 0 });
    expect(new NoteStats(storage, 'xyloStats.v1').get('C4')).toBeUndefined();
  });

  it('reset clears everything', () => {
    const stats = new NoteStats(fakeStorage());
    stats.record('C4', 1, true);
    stats.unlock(3);
    stats.reset();
    expect(stats.get('C4')).toBeUndefined();
    expect(stats.getMaxStage()).toBe(1);
  });
});
