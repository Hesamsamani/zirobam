import { describe, it, expect } from 'vitest';
import { pitchWeight, pickNextPitch } from '../learn/noteScheduler';

function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

describe('pitchWeight', () => {
  it('weights unseen notes in the middle and weak notes highest', () => {
    expect(pitchWeight(undefined)).toBe(3);
    expect(pitchWeight({ seen: 4, correct: 4, lastSeen: 0 })).toBe(1);
    expect(pitchWeight({ seen: 4, correct: 0, lastSeen: 0 })).toBe(5);
    expect(pitchWeight({ seen: 2, correct: 1, lastSeen: 0 })).toBe(3);
  });
});

describe('pickNextPitch', () => {
  const pool = ['C4', 'D4', 'E4'];

  it('never repeats the last pitch when there is a choice', () => {
    const rng = seeded(7);
    for (let i = 0; i < 200; i++) expect(pickNextPitch(pool, () => undefined, 'D4', rng)).not.toBe('D4');
  });

  it('can repeat when the pool has a single pitch', () => {
    expect(pickNextPitch(['C4'], () => undefined, 'C4')).toBe('C4');
  });

  it('follows the random roll across the weights', () => {
    expect(pickNextPitch(pool, () => undefined, null, () => 0)).toBe('C4');
    expect(pickNextPitch(pool, () => undefined, null, () => 0.999)).toBe('E4');
  });

  it('asks weak notes more often', () => {
    const stats: Record<string, { seen: number; correct: number; lastSeen: number }> = {
      C4: { seen: 10, correct: 10, lastSeen: 0 },
      D4: { seen: 10, correct: 0, lastSeen: 0 },
      E4: { seen: 10, correct: 10, lastSeen: 0 },
    };
    const rng = seeded(42);
    let weak = 0;
    for (let i = 0; i < 2000; i++) if (pickNextPitch(pool, (p) => stats[p], null, rng) === 'D4') weak++;
    expect(weak / 2000).toBeGreaterThan(0.6);
  });

  it('throws on an empty pool', () => {
    expect(() => pickNextPitch([], () => undefined, null)).toThrow();
  });
});
