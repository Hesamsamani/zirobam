import { storageGet, storageSet } from '../core/safeStorage';
import { addDays, dayString, daysBetween, isDay } from './days';

/** How long a day is kept: half a year, enough for the trends the progress screen draws. */
export const KEEP_DAYS = 182;
/** At most this many different notes, and this many different chords, are kept for one day. */
export const MAX_ENTRIES_PER_DAY = 300;
/** A note or a chord name longer than this is not one. */
export const MAX_KEY_CHARS = 24;
/** The most the stored text may be: well under the 2 MB a backup accepts for one value. */
export const MAX_STORED_CHARS = 1_500_000;

const STORAGE_KEY = 'mistakes.v1';
const MAX_COUNT = 1_000_000_000;

/** How often something was asked of the student, and how often the answer was wrong. */
export interface Counts {
  asked: number;
  missed: number;
}

export type RhythmVerdict = 'hit' | 'early' | 'late' | 'missed';

export interface RhythmCounts {
  hits: number;
  early: number;
  late: number;
  missed: number;
}

export interface Aggregate {
  notes: Record<string, Counts>;
  chords: Record<string, Counts>;
  rhythm: RhythmCounts;
}

export interface TrendWeek {
  from: string;
  to: string;
  asked: number;
  missed: number;
}

type Pairs = Record<string, [number, number]>;

interface DayRecord {
  notes: Pairs;
  chords: Pairs;
  rhythm: RhythmCounts;
}

interface StoredData {
  version: 1;
  days: Record<string, DayRecord>;
}

/** The part of the browser storage the log uses; it never throws (see `core/safeStorage`). */
export interface LogStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const browserStorage: LogStorage = { getItem: storageGet, setItem: storageSet };

const emptyRhythm = (): RhythmCounts => ({ hits: 0, early: 0, late: 0, missed: 0 });
const isCount = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= MAX_COUNT;
const isPlain = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

/** What is worth keeping of a stored map: names of a sensible length, and counts that can have happened. */
function cleanPairs(value: unknown): Pairs {
  const out: Pairs = {};
  if (!isPlain(value)) return out;
  for (const [name, pair] of Object.entries(value)) {
    if (name.length === 0 || name.length > MAX_KEY_CHARS || !Array.isArray(pair) || pair.length !== 2) continue;
    const [asked, missed] = pair as unknown[];
    if (isCount(asked) && isCount(missed) && missed <= asked) out[name] = [asked, missed];
  }
  return out;
}

function cleanRhythm(value: unknown): RhythmCounts {
  const out = emptyRhythm();
  if (!isPlain(value)) return out;
  for (const key of ['hits', 'early', 'late', 'missed'] as const) {
    const count = value[key];
    if (isCount(count)) out[key] = count;
  }
  return out;
}

/** The log from the browser, with whatever cannot be right left out; an empty log when there is nothing or it is rubbish. */
function load(storage: LogStorage, key: string): StoredData {
  const data: StoredData = { version: 1, days: {} };
  try {
    const text = storage.getItem(key);
    if (!text) return data;
    const parsed: unknown = JSON.parse(text);
    if (!isPlain(parsed) || parsed.version !== 1 || !isPlain(parsed.days)) return data;
    for (const [day, record] of Object.entries(parsed.days)) {
      if (!isDay(day) || !isPlain(record)) continue;
      data.days[day] = { notes: cleanPairs(record.notes), chords: cleanPairs(record.chords), rhythm: cleanRhythm(record.rhythm) };
    }
    return data;
  } catch {
    return { version: 1, days: {} };
  }
}

/** Takes the entries that matter least (asked least, then missed least) out of a map that has grown too big, never the one just touched. */
function trim(pairs: Pairs, keep: string): void {
  const names = Object.keys(pairs);
  if (names.length <= MAX_ENTRIES_PER_DAY) return;
  const weakest = names
    .filter((name) => name !== keep)
    .sort((a, b) => pairs[a][0] - pairs[b][0] || pairs[a][1] - pairs[b][1])
    .slice(0, names.length - MAX_ENTRIES_PER_DAY);
  for (const name of weakest) delete pairs[name];
}

function addPairs(into: Record<string, Counts>, from: Pairs): void {
  for (const [name, [asked, missed]] of Object.entries(from)) {
    const total = into[name] ?? { asked: 0, missed: 0 };
    total.asked += asked;
    total.missed += missed;
    into[name] = total;
  }
}

/**
 * What the student got wrong, day by day: which notes and chords were asked and missed, and how the taps of the
 * rhythm trainer fell. It feeds the mistake heat map and the daily plan. A day is kept for half a year.
 */
export class MistakeLog {
  private readonly storage: LogStorage;
  private readonly today: () => string;
  private readonly storageKey: string;
  private data: StoredData;

  constructor(storage: LogStorage = browserStorage, today: () => string = () => dayString(new Date()), storageKey: string = STORAGE_KEY) {
    this.storage = storage;
    this.today = today;
    this.storageKey = storageKey;
    this.data = load(storage, storageKey);
  }

  /** A note was asked (in the quiz, the exercise or a scale), and the answer was `missed` or not. */
  recordNote(note: string, missed: boolean): void {
    this.bump('notes', note, missed);
  }

  /** A chord was asked, and the answer was `missed` or not. */
  recordChord(chord: string, missed: boolean): void {
    this.bump('chords', chord, missed);
  }

  /** One tap of the rhythm trainer: on time, early, late, or a note that was not played. */
  recordRhythm(verdict: RhythmVerdict): void {
    const rhythm = this.dayRecord().rhythm;
    if (verdict === 'hit') rhythm.hits += 1;
    else rhythm[verdict] += 1;
    this.save();
  }

  /** The counts of the days from `from` to `to` (both included), added up. */
  aggregate(from: string, to: string): Aggregate {
    const result: Aggregate = { notes: {}, chords: {}, rhythm: emptyRhythm() };
    for (const [day, record] of Object.entries(this.data.days)) {
      if (day < from || day > to) continue;
      addPairs(result.notes, record.notes);
      addPairs(result.chords, record.chords);
      for (const key of ['hits', 'early', 'late', 'missed'] as const) result.rhythm[key] += record.rhythm[key];
    }
    return result;
  }

  /** The last `weeks` weeks, oldest first, each of seven days ending on a day that is a multiple of seven days before `today`. Notes and chords only. */
  weeklyTrend(weeks: number, today: string = this.today()): TrendWeek[] {
    const trend: TrendWeek[] = [];
    for (let i = weeks - 1; i >= 0; i--) {
      const to = addDays(today, -7 * i);
      const from = addDays(to, -6);
      const { notes, chords } = this.aggregate(from, to);
      const sum = (counts: Record<string, Counts>, field: keyof Counts) => Object.values(counts).reduce((total, c) => total + c[field], 0);
      trend.push({ from, to, asked: sum(notes, 'asked') + sum(chords, 'asked'), missed: sum(notes, 'missed') + sum(chords, 'missed') });
    }
    return trend;
  }

  private dayRecord(): DayRecord {
    const day = this.today();
    return (this.data.days[day] ??= { notes: {}, chords: {}, rhythm: emptyRhythm() });
  }

  private bump(kind: 'notes' | 'chords', name: string, missed: boolean): void {
    if (name.length === 0 || name.length > MAX_KEY_CHARS) return;
    const pairs = this.dayRecord()[kind];
    const pair = (pairs[name] ??= [0, 0]);
    pair[0] += 1;
    if (missed) pair[1] += 1;
    trim(pairs, name);
    this.save();
  }

  /** Writes the log: forgets the days that are too old, and the oldest days more while the text is too big. */
  private save(): void {
    const today = this.today();
    const days = this.data.days;
    for (const day of Object.keys(days)) if (daysBetween(day, today) >= KEEP_DAYS) delete days[day];

    // each day's share of the text, so that the oldest can go without writing the whole log out again and again
    const sizes = new Map(Object.entries(days).map(([day, record]) => [day, day.length + JSON.stringify(record).length + 4]));
    let total = 24 + [...sizes.values()].reduce((sum, size) => sum + size, 0);
    for (const day of Object.keys(days).sort()) {
      if (total <= MAX_STORED_CHARS) break;
      if (day === today) continue; // today is never the one that goes
      total -= sizes.get(day) ?? 0;
      delete days[day];
    }
    try {
      this.storage.setItem(this.storageKey, JSON.stringify(this.data));
    } catch {
      // storage full or refused: the counts just are not kept
    }
  }
}
