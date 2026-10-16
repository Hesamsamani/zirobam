import { describe, it, expect, beforeEach, vi } from 'vitest';

const KEY = 'sightreading-progress';

/** The progress is read once when the module loads, so every case imports a fresh copy. */
async function loadWith(saved: unknown) {
  localStorage.clear();
  if (saved !== undefined) localStorage.setItem(KEY, typeof saved === 'string' ? saved : JSON.stringify(saved));
  vi.resetModules();
  return import('../musicGenerator');
}

describe('loading saved progress', () => {
  beforeEach(() => localStorage.clear());

  it('restores a valid saved state', async () => {
    const gen = await loadWith({ level: 7, subLevel: 2, repetitions: 1, currentBpm: 80, bpmMastery: 2 });
    expect(gen.getLevel()).toBe(7);
    expect(gen.getSubLevel()).toBe(2);
    expect(gen.getCurrentBpm()).toBe(80);
  });

  it('starts at level 1a when nothing is saved', async () => {
    const gen = await loadWith(undefined);
    expect(gen.getFullLevelString()).toBe('1a');
    expect(gen.getCurrentBpm()).toBe(30);
  });

  it.each([
    ['text instead of a level', { level: 'abc', subLevel: null }],
    ['a null level', { level: null, subLevel: 'x', currentBpm: 'fast' }],
    ['an object instead of numbers', { level: {}, subLevel: [], repetitions: {}, currentBpm: {}, bpmMastery: [] }],
    ['not JSON at all', 'not json'],
    ['a JSON array', '[1,2,3]'],
    ['a JSON string', '"hello"'],
  ])('falls back to safe values for %s', async (_name, saved) => {
    const gen = await loadWith(saved);
    expect(gen.getLevel()).toBe(1);
    expect(gen.getSubLevel()).toBe(0);
    expect(Number.isFinite(gen.getCurrentBpm())).toBe(true);
    // and a piece can still be generated from it
    expect(() => gen.generateMusicXML()).not.toThrow();
  });

  it('clamps numbers that are out of range', async () => {
    const gen = await loadWith({ level: 99, subLevel: 9, currentBpm: 99999, repetitions: -4, bpmMastery: 1e9 });
    expect(gen.getLevel()).toBe(gen.MAX_LEVEL);
    expect(gen.getSubLevel()).toBe(3);
    expect(gen.getCurrentBpm()).toBe(200);
    expect(gen.getRepetitionsRemaining()).toBeLessThanOrEqual(3);
  });

  it('accepts numbers saved as text and rounds fractions', async () => {
    const gen = await loadWith({ level: '4', subLevel: 1.6, currentBpm: '90' });
    expect(gen.getLevel()).toBe(4);
    expect(gen.getSubLevel()).toBe(2);
    expect(gen.getCurrentBpm()).toBe(90);
  });
});
