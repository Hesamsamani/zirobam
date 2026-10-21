import { describe, expect, it } from 'vitest';
import { heatOf, isEmpty, noteHeat, rhythmSummary, trendPoints, worstItems } from '../stats/heatmap';

describe('heatOf', () => {
  it('is 0 for a note asked too few times, whatever was missed', () => {
    expect(heatOf({ asked: 2, missed: 2 })).toBe(0);
    expect(heatOf({ asked: 0, missed: 0 })).toBe(0);
  });

  it('goes from 1 to 5 as more of the answers are wrong', () => {
    expect(heatOf({ asked: 10, missed: 0 })).toBe(0);
    expect(heatOf({ asked: 20, missed: 1 })).toBe(0);
    expect(heatOf({ asked: 10, missed: 1 })).toBe(1);
    expect(heatOf({ asked: 8, missed: 2 })).toBe(2);
    expect(heatOf({ asked: 10, missed: 4 })).toBe(3);
    expect(heatOf({ asked: 10, missed: 6 })).toBe(4);
    expect(heatOf({ asked: 10, missed: 8 })).toBe(5);
    expect(heatOf({ asked: 10, missed: 10 })).toBe(5);
  });

  it('can be told how many answers are enough', () => {
    expect(heatOf({ asked: 2, missed: 2 }, 2)).toBe(5);
  });
});

describe('noteHeat', () => {
  it('names a key by its sharp name with octave, and drops the keys that are fine', () => {
    const heat = noteHeat({ C4: { asked: 10, missed: 0 }, G4: { asked: 10, missed: 7 } });
    expect(heat).toEqual({ G4: 4 });
  });

  it('puts a flat and its sharp on the one key: B flat and A sharp add up', () => {
    const heat = noteHeat({ Bb3: { asked: 3, missed: 2 }, 'A#3': { asked: 3, missed: 1 } });
    expect(heat).toEqual({ 'A#3': 3 });
  });

  it('puts a koron on the key of its letter', () => {
    expect(noteHeat({ Ek4: { asked: 4, missed: 4 } })).toEqual({ E4: 5 });
  });

  it('is empty when nothing was asked', () => {
    expect(noteHeat({})).toEqual({});
  });
});

describe('worstItems', () => {
  const counts = {
    C4: { asked: 10, missed: 1 },
    D4: { asked: 10, missed: 6 },
    E4: { asked: 5, missed: 3 },
    F4: { asked: 2, missed: 2 },
    G4: { asked: 10, missed: 0 },
    A4: { asked: 10, missed: 6 },
  };

  it('lists the notes missed most, worst first, leaving out the ones with too few answers and the ones never missed', () => {
    const list = worstItems(counts);
    expect(list.map((s) => s.name)).toEqual(['A4', 'D4', 'E4', 'C4']);
    expect(list[0]).toEqual({ name: 'A4', asked: 10, missed: 6, rate: 0.6 });
  });

  it('puts the one missed more often first when the share is the same, and stops at the count', () => {
    expect(worstItems({ X: { asked: 4, missed: 2 }, Y: { asked: 10, missed: 5 } }).map((s) => s.name)).toEqual(['Y', 'X']);
    expect(worstItems(counts, 2)).toHaveLength(2);
  });
});

describe('rhythmSummary', () => {
  it('adds up the taps', () => {
    expect(rhythmSummary({ hits: 10, early: 2, late: 3, missed: 1 })).toMatchObject({ total: 16, hits: 10, early: 2, late: 3, missed: 1 });
  });

  it('says which way the student leans, when it is clear', () => {
    expect(rhythmSummary({ hits: 10, early: 8, late: 2, missed: 0 }).lean).toBe('early');
    expect(rhythmSummary({ hits: 10, early: 1, late: 9, missed: 0 }).lean).toBe('late');
    expect(rhythmSummary({ hits: 10, early: 5, late: 4, missed: 0 }).lean).toBe('none');
    // too few taps to say
    expect(rhythmSummary({ hits: 10, early: 3, late: 0, missed: 0 }).lean).toBe('none');
  });
});

describe('trendPoints', () => {
  it('gives the share right in each week, and null for a week with too few answers', () => {
    const weeks = [
      { from: 'a', to: 'b', asked: 2, missed: 1 },
      { from: 'c', to: 'd', asked: 10, missed: 2 },
      { from: 'e', to: 'f', asked: 20, missed: 0 },
    ];
    expect(trendPoints(weeks)).toEqual([null, 0.8, 1]);
  });
});

describe('isEmpty', () => {
  it('is true when nothing was asked or tapped', () => {
    expect(isEmpty({ notes: {}, chords: {}, rhythm: { hits: 0, early: 0, late: 0, missed: 0 } })).toBe(true);
    expect(isEmpty({ notes: { C4: { asked: 1, missed: 0 } }, chords: {}, rhythm: { hits: 0, early: 0, late: 0, missed: 0 } })).toBe(false);
    expect(isEmpty({ notes: {}, chords: {}, rhythm: { hits: 1, early: 0, late: 0, missed: 0 } })).toBe(false);
  });
});
