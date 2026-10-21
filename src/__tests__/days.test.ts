import { describe, it, expect } from 'vitest';
import { addDays, dayString, daysBetween, isDay } from '../stats/days';

describe('dayString', () => {
  it('writes the local calendar day as YYYY-MM-DD', () => {
    expect(dayString(new Date(2026, 9, 21, 23, 59))).toBe('2026-10-21');
    expect(dayString(new Date(2026, 0, 5, 0, 1))).toBe('2026-01-05');
  });
});

describe('addDays', () => {
  it('moves forward and back, across months and years', () => {
    expect(addDays('2026-10-21', 1)).toBe('2026-10-22');
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2024-03-01', -1)).toBe('2024-02-29');
    expect(addDays('2026-10-21', 0)).toBe('2026-10-21');
  });

  it('is not thrown off by a change of clock', () => {
    // the days around the clocks changing in many places
    expect(addDays('2026-03-28', 2)).toBe('2026-03-30');
    expect(addDays('2026-10-24', 2)).toBe('2026-10-26');
    expect(addDays('2026-01-01', 365)).toBe('2027-01-01');
  });
});

describe('daysBetween', () => {
  it('counts the days from the first to the second', () => {
    expect(daysBetween('2026-10-21', '2026-10-21')).toBe(0);
    expect(daysBetween('2026-10-21', '2026-10-28')).toBe(7);
    expect(daysBetween('2026-10-28', '2026-10-21')).toBe(-7);
    expect(daysBetween('2026-01-01', '2026-07-02')).toBe(182);
  });
});

describe('isDay', () => {
  it('accepts a real calendar day and nothing else', () => {
    expect(isDay('2026-10-21')).toBe(true);
    expect(isDay('2024-02-29')).toBe(true);
    for (const bad of ['2026-02-29', '2026-13-01', '2026-00-10', '2026-10-32', '2026-1-1', '20261021', '', 'today', 5, null, undefined]) {
      expect(isDay(bad), String(bad)).toBe(false);
    }
  });
});
