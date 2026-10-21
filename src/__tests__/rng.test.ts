import { describe, expect, it } from 'vitest';
import { between, freshSeed, pickOne, pickWeighted, seededRng } from '../core/rng';

describe('seededRng', () => {
  it('gives the same numbers for the same seed, and others for another', () => {
    const a = seededRng(42);
    const b = seededRng(42);
    const first = [a(), a(), a()];
    expect([b(), b(), b()]).toEqual(first);
    expect(seededRng(43)()).not.toBe(first[0]);
  });

  it('stays from 0 up to, not including, 1', () => {
    const rng = seededRng(7);
    for (let i = 0; i < 1000; i++) {
      const n = rng();
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(1);
    }
  });
});

describe('pickOne and between', () => {
  it('pick from the list and the range, both ends included', () => {
    const rng = seededRng(3);
    const seen = new Set<number>();
    for (let i = 0; i < 200; i++) seen.add(between(rng, 2, 5));
    expect([...seen].sort()).toEqual([2, 3, 4, 5]);
    expect(['a', 'b', 'c']).toContain(pickOne(rng, ['a', 'b', 'c']));
  });

  it('refuses to pick from nothing', () => {
    expect(() => pickOne(seededRng(1), [])).toThrow();
  });
});

describe('pickWeighted', () => {
  it('follows the weights', () => {
    const rng = seededRng(11);
    const counts = { a: 0, b: 0, c: 0 };
    for (let i = 0; i < 6000; i++) counts[pickWeighted(rng, ['a', 'b', 'c'] as const, [1, 2, 3])]++;
    expect(counts.a).toBeGreaterThan(800);
    expect(counts.a).toBeLessThan(1200);
    expect(counts.c).toBeGreaterThan(counts.b);
    expect(counts.b).toBeGreaterThan(counts.a);
  });

  it('never picks an item of weight 0, and picks anything when every weight is 0', () => {
    const rng = seededRng(5);
    for (let i = 0; i < 300; i++) expect(pickWeighted(rng, ['x', 'y'], [0, 1])).toBe('y');
    expect(['x', 'y']).toContain(pickWeighted(rng, ['x', 'y'], [0, 0]));
  });

  it('refuses a list and weights of different lengths', () => {
    expect(() => pickWeighted(seededRng(1), ['x'], [1, 2])).toThrow();
  });
});

describe('freshSeed', () => {
  it('is a whole number from 1 to 999999', () => {
    for (const r of [0, 0.5, 0.999999999]) {
      const seed = freshSeed(() => r);
      expect(Number.isInteger(seed)).toBe(true);
      expect(seed).toBeGreaterThanOrEqual(1);
      expect(seed).toBeLessThanOrEqual(999_999);
    }
  });
});
