import { describe, it, expect } from 'vitest';
import { addDays } from '../stats/days';
import { MistakeLog, KEEP_DAYS, MAX_ENTRIES_PER_DAY, MAX_KEY_CHARS, MAX_STORED_CHARS } from '../stats/mistakeLog';

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
  };
}

/** A log whose clock the test moves. */
function setup(day = '2026-10-21', initial: Record<string, string> = {}) {
  const storage = memoryStorage(initial);
  const clock = { day };
  const make = () => new MistakeLog(storage, () => clock.day);
  return { storage, clock, log: make(), make };
}

describe('MistakeLog', () => {
  it('starts empty', () => {
    const { log } = setup();
    expect(log.aggregate('2026-01-01', '2026-12-31')).toEqual({
      notes: {},
      chords: {},
      rhythm: { hits: 0, early: 0, late: 0, missed: 0 },
    });
  });

  it('counts how often a note was asked and how often it was missed', () => {
    const { log } = setup();
    log.recordNote('C4', false);
    log.recordNote('C4', true);
    log.recordNote('C4', true);
    log.recordNote('F#4', false);
    expect(log.aggregate('2026-10-21', '2026-10-21').notes).toEqual({
      C4: { asked: 3, missed: 2 },
      'F#4': { asked: 1, missed: 0 },
    });
  });

  it('counts chords the same way, apart from the notes', () => {
    const { log } = setup();
    log.recordChord('Am7', true);
    log.recordChord('Am7', false);
    const result = log.aggregate('2026-10-21', '2026-10-21');
    expect(result.chords).toEqual({ Am7: { asked: 2, missed: 1 } });
    expect(result.notes).toEqual({});
  });

  it('counts the verdicts of a rhythm take', () => {
    const { log } = setup();
    for (const verdict of ['hit', 'hit', 'early', 'late', 'late', 'late', 'missed'] as const) log.recordRhythm(verdict);
    expect(log.aggregate('2026-10-21', '2026-10-21').rhythm).toEqual({ hits: 2, early: 1, late: 3, missed: 1 });
  });

  it('files the counts under the day they happened and sums the days asked for', () => {
    const { log, clock } = setup('2026-10-20');
    log.recordNote('C4', true);
    clock.day = '2026-10-21';
    log.recordNote('C4', false);
    log.recordNote('C4', true);
    clock.day = '2026-10-22';
    log.recordNote('C4', true);
    expect(log.aggregate('2026-10-21', '2026-10-21').notes.C4).toEqual({ asked: 2, missed: 1 });
    expect(log.aggregate('2026-10-20', '2026-10-21').notes.C4).toEqual({ asked: 3, missed: 2 });
    expect(log.aggregate('2026-10-20', '2026-10-22').notes.C4).toEqual({ asked: 4, missed: 3 });
    expect(log.aggregate('2026-10-23', '2026-10-30').notes).toEqual({});
  });

  it('is kept: a new log on the same storage sees the counts', () => {
    const { log, make } = setup();
    log.recordNote('C4', true);
    log.recordRhythm('late');
    const again = make().aggregate('2026-10-21', '2026-10-21');
    expect(again.notes.C4).toEqual({ asked: 1, missed: 1 });
    expect(again.rhythm.late).toBe(1);
  });

  describe('when what is stored cannot be trusted', () => {
    const empty = { notes: {}, chords: {}, rhythm: { hits: 0, early: 0, late: 0, missed: 0 } };
    const stored = (value: unknown) => ({ 'mistakes.v1': typeof value === 'string' ? value : JSON.stringify(value) });

    it.each([
      ['text that is not JSON', 'not json'],
      ['a number', 7],
      ['null', null],
      ['another version', { version: 2, days: {} }],
      ['days that are not an object', { version: 1, days: [] }],
    ])('starts empty for %s', (_name, value) => {
      const { log } = setup('2026-10-21', stored(value));
      expect(log.aggregate('2000-01-01', '2100-01-01')).toEqual(empty);
    });

    it('ignores a day or a count that is not what the log writes, and keeps the rest', () => {
      const good = { notes: { C4: [3, 1] }, chords: {}, rhythm: { hits: 1, early: 0, late: 0, missed: 0 } };
      const { log } = setup(
        '2026-10-21',
        stored({
          version: 1,
          days: {
            '2026-10-20': good,
            'yesterday': good,
            '2026-10-19': { notes: { D4: ['x', 1], E4: [2, 5], F4: [1, -1], G4: [1.5, 0] }, chords: 'no', rhythm: { hits: 'many' } },
          },
        }),
      );
      const result = log.aggregate('2000-01-01', '2100-01-01');
      // only the good day counts; the broken one contributes nothing wrong (more missed than asked, negatives, fractions, text)
      expect(result.notes).toEqual({ C4: { asked: 3, missed: 1 } });
      expect(result.rhythm.hits).toBe(1);
    });

    it('can still write after reading rubbish', () => {
      const { log, storage } = setup('2026-10-21', stored('not json'));
      log.recordNote('C4', true);
      expect(JSON.parse(storage.data.get('mistakes.v1')!).version).toBe(1);
    });
  });

  it('does not throw when the browser refuses to read or write', () => {
    const refusing = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('quota');
      },
    };
    const log = new MistakeLog(refusing, () => '2026-10-21');
    expect(() => log.recordNote('C4', true)).not.toThrow();
    expect(() => log.aggregate('2026-10-21', '2026-10-21')).not.toThrow();
  });

  describe('keeping the file small', () => {
    it('forgets days older than the window, and keeps the ones inside it', () => {
      const { log, clock } = setup('2026-01-01');
      log.recordNote('OLD', true);
      clock.day = '2026-01-02';
      log.recordNote('EDGE', true);
      clock.day = '2026-07-02'; // 182 days after the first
      log.recordNote('NEW', true);
      const all = log.aggregate('2000-01-01', '2100-01-01').notes;
      expect(KEEP_DAYS).toBe(182);
      expect(all.OLD).toBeUndefined();
      expect(all.EDGE).toBeDefined(); // 181 days ago: still inside
      expect(all.NEW).toBeDefined();
    });

    it('keeps at most so many different notes in a day, and the ones that matter most', () => {
      const { log, storage } = setup();
      for (let i = 0; i < 5; i++) log.recordNote('KEEP', true); // asked often, missed often
      for (let i = 0; i < MAX_ENTRIES_PER_DAY + 50; i++) log.recordNote(`N${i}`, false);
      const day = JSON.parse(storage.data.get('mistakes.v1')!).days['2026-10-21'];
      expect(Object.keys(day.notes).length).toBeLessThanOrEqual(MAX_ENTRIES_PER_DAY);
      expect(day.notes.KEEP).toEqual([5, 5]);
    });

    it('stays under the size a backup accepts for one value, even in the worst case, by dropping the oldest days', () => {
      // a log filled to the limits on every day, with the longest names it allows: about four times too big
      const days: Record<string, unknown> = {};
      for (let d = 0; d < KEEP_DAYS; d++) {
        const entries = (prefix: string) =>
          Object.fromEntries(Array.from({ length: MAX_ENTRIES_PER_DAY }, (_, i) => [`${prefix}${String(i).padStart(MAX_KEY_CHARS - prefix.length, 'x')}`, [999, 500]]));
        days[addDays('2026-04-23', d)] = { notes: entries('n'), chords: entries('c'), rhythm: { hits: 0, early: 0, late: 0, missed: 0 } };
      }
      const full = JSON.stringify({ version: 1, days });
      expect(full.length).toBeGreaterThan(MAX_STORED_CHARS * 2);

      const { log, storage } = setup('2026-10-21', { 'mistakes.v1': full });
      log.recordNote('C4', true);
      const kept = storage.data.get('mistakes.v1')!;
      expect(kept.length).toBeLessThanOrEqual(MAX_STORED_CHARS);
      const stored = JSON.parse(kept).days as Record<string, unknown>;
      expect(stored['2026-10-21']).toBeDefined(); // today is never the one that goes
      expect(stored['2026-04-23']).toBeUndefined(); // the oldest is
      // the days that stay are the newest, with no gap
      const left = Object.keys(stored).sort();
      expect(left.at(-1)).toBe('2026-10-21');
      expect(left.length).toBeGreaterThan(10);
    });

    it('ignores a name too long to be a note or a chord', () => {
      const long = 'x'.repeat(MAX_KEY_CHARS + 1);
      const { log } = setup('2026-10-21', {
        'mistakes.v1': JSON.stringify({ version: 1, days: { '2026-10-20': { notes: { [long]: [1, 0], C4: [1, 0] }, chords: {}, rhythm: {} } } }),
      });
      expect(Object.keys(log.aggregate('2000-01-01', '2100-01-01').notes)).toEqual(['C4']);
    });
  });
});

describe('weeklyTrend', () => {
  it('gives one entry per week, oldest first, each the seven days up to and including its last day', () => {
    const { log, clock } = setup();
    // today is 10-21, so the three weeks are 10-01 to 10-07, 10-08 to 10-14 and 10-15 to 10-21
    clock.day = '2026-10-04'; // inside the first window
    log.recordNote('C4', true);
    log.recordNote('C4', false);
    clock.day = '2026-10-10'; // second window (10-08 .. 10-14)
    log.recordChord('Am', true);
    clock.day = '2026-10-21'; // third window (10-15 .. 10-21), today
    log.recordNote('D4', true);
    log.recordNote('D4', true);
    log.recordNote('D4', false);
    const trend = log.weeklyTrend(3, '2026-10-21');
    expect(trend).toEqual([
      { from: '2026-10-01', to: '2026-10-07', asked: 2, missed: 1 },
      { from: '2026-10-08', to: '2026-10-14', asked: 1, missed: 1 },
      { from: '2026-10-15', to: '2026-10-21', asked: 3, missed: 2 },
    ]);
  });

  it('gives weeks with nothing in them as zeros, not as gaps', () => {
    const { log } = setup();
    expect(log.weeklyTrend(2, '2026-10-21')).toEqual([
      { from: '2026-10-08', to: '2026-10-14', asked: 0, missed: 0 },
      { from: '2026-10-15', to: '2026-10-21', asked: 0, missed: 0 },
    ]);
  });
});
