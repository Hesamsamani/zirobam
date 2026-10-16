import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PracticeOptionsStore, SPEED_STEPS, nextLadderBpm, slowedBpm, speedPercent, LADDER_STEP } from '../practice/practiceOptions';
import { MIN_BPM } from '../core/tempo';

beforeEach(() => localStorage.clear());

describe('PracticeOptionsStore', () => {
  it('starts with everything off and both hands', () => {
    expect(new PracticeOptionsStore().get()).toEqual({ wait: false, loop: false, ladder: false, hand: 'both' });
  });

  it('changes one option and keeps the others', () => {
    const store = new PracticeOptionsStore();
    store.set({ wait: true });
    store.set({ hand: 'left' });
    expect(store.get()).toEqual({ wait: true, loop: false, ladder: false, hand: 'left' });
  });

  it('remembers the options for the next visit', () => {
    new PracticeOptionsStore().set({ loop: true, hand: 'right' });
    expect(new PracticeOptionsStore().get()).toMatchObject({ loop: true, hand: 'right' });
  });

  it('tells its listeners only about real changes, until they stop listening', () => {
    const store = new PracticeOptionsStore();
    const listener = vi.fn();
    const stop = store.onChange(listener);
    store.set({ wait: true });
    store.set({ wait: true });
    expect(listener).toHaveBeenCalledTimes(1);
    stop();
    store.set({ wait: false });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('ignores a damaged or hostile saved value', () => {
    for (const saved of ['not json', '[]', '{"wait":"yes"}', '{"hand":"middle"}', 'null', '{"loop":1}']) {
      localStorage.setItem('practice.options.v1', saved);
      expect(new PracticeOptionsStore().get()).toEqual({ wait: false, loop: false, ladder: false, hand: 'both' });
    }
  });

  it('takes the good parts of a partly good saved value', () => {
    localStorage.setItem('practice.options.v1', '{"wait":true,"hand":"middle","loop":"x"}');
    expect(new PracticeOptionsStore().get()).toEqual({ wait: true, loop: false, ladder: false, hand: 'both' });
  });

  it('works when the browser does not keep anything', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const store = new PracticeOptionsStore();
    store.set({ wait: true });
    expect(store.get().wait).toBe(true);
    vi.restoreAllMocks();
  });
});

describe('tempo helpers', () => {
  it('has the quick speeds 50, 75 and 100 percent', () => {
    expect([...SPEED_STEPS]).toEqual([50, 75, 100]);
  });

  it('slows the tempo to a share of the base tempo, as a whole number', () => {
    expect(slowedBpm(80, 50)).toBe(40);
    expect(slowedBpm(90, 75)).toBe(68); // 67.5 rounds up
    expect(slowedBpm(60, 100)).toBe(60);
  });

  it('does not go below the slowest tempo the app can play', () => {
    expect(slowedBpm(MIN_BPM + 2, 50)).toBe(MIN_BPM);
  });

  it('says which quick speed the tempo is at', () => {
    expect(speedPercent(40, 80)).toBe(50);
    expect(speedPercent(60, 80)).toBe(75);
    expect(speedPercent(80, 80)).toBe(100);
    expect(speedPercent(70, 80)).toBeNull();
  });

  it('speeds up by a small step after a clean pass, and stops at the base tempo', () => {
    expect(LADDER_STEP).toBe(5);
    expect(nextLadderBpm(40, 80)).toBe(45);
    expect(nextLadderBpm(78, 80)).toBe(80);
    expect(nextLadderBpm(80, 80)).toBe(80);
    expect(nextLadderBpm(95, 80)).toBe(95); // faster than the base already: left as it is
  });
});
