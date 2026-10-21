import { EventEmitter } from '../core/events';
import { BADGES, isBadgeId, type BadgeContext, type BadgeId } from './achievements';

export type Goal = 20 | 50 | 100;
export const GOALS: readonly Goal[] = [20, 50, 100];
export type Stars = 1 | 2 | 3;

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;
const STORAGE_KEY = 'game.v1';
const DAY_LIMIT = 400; // days of history kept

// ----- pure rules -----

/** XP needed to reach a level: each level asks 50 XP more than the one before (50, 100, 150, ...). */
export function xpForLevel(level: number): number {
  return (25 * level * (level - 1)) | 0;
}

export function levelForXp(xp: number): { level: number; into: number; needed: number } {
  const safe = Number.isFinite(xp) ? Math.max(0, xp) : 0;
  let level = 1;
  while (xpForLevel(level + 1) <= safe) level++;
  return { level, into: safe - xpForLevel(level), needed: 50 * level };
}

/** The local date as year-month-day, the key of a day in the progress. */
export function dayKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Stars for finishing a song in practice mode: fewer for many repeated steps. */
export function practiceStars(steps: number, retries: number): Stars {
  const ratio = steps > 0 ? retries / steps : 0;
  if (ratio <= 0.25) return 3;
  if (ratio <= 0.6) return 2;
  return 1;
}

// ----- state -----

interface Counters {
  correct: number;
  bestCombo: number;
  piecesPassed: number;
  stepsPassed: number;
  songsFinished: number;
  xyloSongs: number;
  xyloThreeStars: number;
  /** Right answers in ear training, and scales or chords played along. */
  earCorrect: number;
  /** Right answers in the chord quiz. */
  chordsCorrect: number;
  /** Pieces of the rhythm trainer tapped on time. */
  rhythmPassed: number;
  /** Right answers in the quarter-tone ear training. */
  persianCorrect: number;
  /** Daily plans done to the end. */
  todayDone: number;
  scalesPlayed: number;
  maxLevel: number;
  maxStage: number;
  /** The most lessons read so far, and how many lessons the course had at that time. */
  lessonsRead: number;
  lessonsTotal: number;
}

interface State {
  version: 1;
  xp: number;
  goal: Goal;
  days: Record<string, number>;
  counters: Counters;
  songStars: Record<string, Stars>;
  xyloBest: Record<string, Stars>;
  badges: Partial<Record<BadgeId, string>>;
}

function emptyState(): State {
  return {
    version: 1,
    xp: 0,
    goal: 50,
    days: {},
    counters: {
      correct: 0, bestCombo: 0, piecesPassed: 0, stepsPassed: 0, songsFinished: 0,
      xyloSongs: 0, xyloThreeStars: 0, earCorrect: 0, chordsCorrect: 0, rhythmPassed: 0, persianCorrect: 0, todayDone: 0, scalesPlayed: 0, maxLevel: 1, maxStage: 1, lessonsRead: 0, lessonsTotal: 0,
    },
    songStars: {},
    xyloBest: {},
    badges: {},
  };
}

function count(value: unknown, fallback = 0, max = 1e9): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(max, Math.round(value))) : fallback;
}

function asStars(value: unknown): Stars | null {
  return value === 1 || value === 2 || value === 3 ? value : null;
}

function readState(raw: unknown): State | null {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as Record<string, unknown>;
  if (data.version !== 1) return null;
  const state = emptyState();
  state.xp = count(data.xp);
  state.goal = (GOALS as readonly unknown[]).includes(data.goal) ? (data.goal as Goal) : 50;

  if (data.days && typeof data.days === 'object') {
    for (const [key, value] of Object.entries(data.days as Record<string, unknown>)) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(key)) state.days[key] = count(value);
    }
  }
  const counters = (data.counters && typeof data.counters === 'object' ? data.counters : {}) as Record<string, unknown>;
  for (const key of Object.keys(state.counters) as Array<keyof Counters>) {
    state.counters[key] = count(counters[key], state.counters[key], key === 'maxLevel' || key === 'maxStage' ? 99 : 1e9);
  }
  state.counters.maxLevel = Math.max(1, state.counters.maxLevel);
  state.counters.maxStage = Math.max(1, state.counters.maxStage);

  for (const field of ['songStars', 'xyloBest'] as const) {
    const source = data[field];
    if (source && typeof source === 'object') {
      for (const [id, value] of Object.entries(source as Record<string, unknown>)) {
        const stars = asStars(value);
        if (stars) state[field][id] = stars;
      }
    }
  }
  if (data.badges && typeof data.badges === 'object') {
    for (const [id, date] of Object.entries(data.badges as Record<string, unknown>)) {
      if (isBadgeId(id) && typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) state.badges[id] = date;
    }
  }
  return state;
}

/** What one event gave the player. */
export interface Award {
  xp: number;
  totalXp: number;
  level: number;
  leveledUp: boolean;
  newBadges: BadgeId[];
  /** True only at the moment the daily goal is crossed. */
  goalReached: boolean;
  streak: number;
}

export interface GameStoreOptions {
  storage?: StorageLike | null;
  now?: () => Date;
  /** The ids of the beginner songs, for the badge for finishing them all. */
  beginnerSongIds?: readonly string[];
}

const BASE_ANSWER_XP = 2;

/**
 * The player's progress: XP and level, the daily goal and streak, and badges. It lives in the browser only.
 * Every `record...` method returns what the event gave, so the screen can show it.
 */
export class GameStore {
  private state: State = emptyState();
  private readonly storage: StorageLike | null;
  private readonly now: () => Date;
  private readonly beginnerSongIds: readonly string[];
  private readonly changes = new EventEmitter<void>();
  private comboNow = 0;

  constructor(options: GameStoreOptions = {}) {
    this.storage = options.storage === undefined ? this.defaultStorage() : options.storage;
    this.now = options.now ?? (() => new Date());
    this.beginnerSongIds = options.beginnerSongIds ?? [];
    this.load();
  }

  private defaultStorage(): StorageLike | null {
    try {
      return typeof localStorage === 'undefined' ? null : localStorage;
    } catch {
      return null;
    }
  }

  // ----- reading -----

  totalXp(): number {
    return this.state.xp;
  }

  level(): number {
    return levelForXp(this.state.xp).level;
  }

  levelProgress(): { level: number; into: number; needed: number } {
    return levelForXp(this.state.xp);
  }

  goal(): Goal {
    return this.state.goal;
  }

  todayXp(): number {
    return this.state.days[dayKey(this.now())] ?? 0;
  }

  /** Days in a row, up to today or yesterday, on which the goal was reached. */
  streak(): number {
    const day = new Date(this.now());
    day.setHours(12, 0, 0, 0);
    const met = (d: Date) => (this.state.days[dayKey(d)] ?? 0) >= this.state.goal;
    if (!met(day)) day.setDate(day.getDate() - 1); // today may still be on its way
    let streak = 0;
    while (met(day) && streak < DAY_LIMIT) {
      streak++;
      day.setDate(day.getDate() - 1);
    }
    return streak;
  }

  combo(): number {
    return this.comboNow;
  }

  stats(): Readonly<Counters> {
    return { ...this.state.counters };
  }

  songStars(songId: string): number {
    return this.state.songStars[songId] ?? 0;
  }

  hasBadge(id: BadgeId): boolean {
    return this.state.badges[id] !== undefined;
  }

  badgeDate(id: BadgeId): string | null {
    return this.state.badges[id] ?? null;
  }

  onChange(listener: () => void): () => void {
    return this.changes.on(listener);
  }

  // ----- events -----

  /** A note answered in a quiz: 2 XP, with one more for every fifth right answer in a row (plus two for the tenth...). */
  recordAnswer(correct: boolean): Award {
    if (!correct) {
      this.comboNow = 0;
      return this.award(0);
    }
    this.comboNow++;
    const c = this.state.counters;
    c.correct++;
    c.bestCombo = Math.max(c.bestCombo, this.comboNow);
    const bonus = this.comboNow % 5 === 0 ? this.comboNow / 5 : 0;
    return this.award(BASE_ANSWER_XP + bonus);
  }

  /** An ear training question: 3 XP when it is right. It has its own count, so the quiz combo is left alone. */
  recordEarAnswer(correct: boolean): Award {
    if (!correct) return this.award(0);
    this.state.counters.earCorrect++;
    return this.award(3);
  }

  /** A chord of the chord quiz played right: 3 XP. */
  recordChordAnswer(correct: boolean): Award {
    if (!correct) return this.award(0);
    this.state.counters.chordsCorrect++;
    return this.award(3);
  }

  /** A question of the quarter-tone ear training answered right: 3 XP. */
  recordPersianAnswer(correct: boolean): Award {
    if (!correct) return this.award(0);
    this.state.counters.persianCorrect++;
    return this.award(3);
  }

  /** The plan of the day done to the end: 15 XP. */
  recordTodayDone(): Award {
    this.state.counters.todayDone++;
    return this.award(15);
  }

  /** A piece of the rhythm trainer tapped on time: 5 XP. */
  recordRhythmPassed(): Award {
    this.state.counters.rhythmPassed++;
    return this.award(5);
  }

  /** A scale or a chord played along to the end: 5 XP. */
  recordScalePlayed(): Award {
    this.state.counters.scalesPlayed++;
    return this.award(5);
  }

  /** A piece of the levels played and passed. `level` is the level the player is on now. */
  recordLevelPassed(level: number): Award {
    this.state.counters.piecesPassed++;
    this.state.counters.maxLevel = Math.max(this.state.counters.maxLevel, count(level, 1, 99));
    return this.award(10);
  }

  recordStepPassed(): Award {
    this.state.counters.stepsPassed++;
    return this.award(5);
  }

  /** A whole song played through in practice mode: 30 XP the first time, 5 after that. */
  recordSongFinished(songId: string, stars: Stars): Award {
    const first = this.state.songStars[songId] === undefined;
    this.state.counters.songsFinished++;
    this.state.songStars[songId] = Math.max(this.state.songStars[songId] ?? 1, stars) as Stars;
    return this.award(first ? 30 : 5);
  }

  /** A song played on the xylophone: 10, 20 or 30 XP by stars when they beat the best so far. */
  recordXyloSong(songId: string, stars: Stars): Award {
    const best = this.state.xyloBest[songId] ?? 0;
    this.state.counters.xyloSongs++;
    if (stars === 3) this.state.counters.xyloThreeStars++;
    if (stars > best) this.state.xyloBest[songId] = stars;
    return this.award(stars > best ? stars * 10 : 2);
  }

  /**
   * A lesson was read for the first time: `done` of the course's `total` lessons are read now.
   * 3 XP each, and 20 more the moment the course is complete.
   */
  recordLessonRead(done: number, total: number): Award {
    const counters = this.state.counters;
    const wasComplete = counters.lessonsTotal > 0 && counters.lessonsRead >= counters.lessonsTotal;
    counters.lessonsTotal = count(total);
    counters.lessonsRead = Math.max(counters.lessonsRead, count(done, 0, counters.lessonsTotal));
    const complete = counters.lessonsTotal > 0 && counters.lessonsRead >= counters.lessonsTotal;
    return this.award(3 + (complete && !wasComplete ? 20 : 0));
  }

  /** A stage of the note quiz was unlocked. */
  recordStage(stage: number): Award {
    this.state.counters.maxStage = Math.max(this.state.counters.maxStage, count(stage, 1, 99));
    return this.award(0);
  }

  setGoal(goal: Goal): void {
    if (!(GOALS as readonly unknown[]).includes(goal) || goal === this.state.goal) return;
    this.state.goal = goal;
    this.save();
    this.changes.emit();
  }

  /** Starts over. The daily goal is a setting, so it stays. */
  reset(): void {
    const goal = this.state.goal;
    this.state = emptyState();
    this.state.goal = goal;
    this.comboNow = 0;
    this.save();
    this.changes.emit();
  }

  // ----- inside -----

  private award(xp: number, notify = true): Award {
    const before = this.levelProgress().level;
    const today = dayKey(this.now());
    const todayBefore = this.state.days[today] ?? 0;
    this.state.xp += xp;
    if (xp > 0) this.state.days[today] = todayBefore + xp;
    this.trimDays();

    const newBadges = this.earnBadges(today);
    const goalReached = xp > 0 && todayBefore < this.state.goal && (this.state.days[today] ?? 0) >= this.state.goal;
    const result: Award = {
      xp,
      totalXp: this.state.xp,
      level: this.levelProgress().level,
      leveledUp: this.levelProgress().level > before,
      newBadges,
      goalReached,
      streak: this.streak(),
    };
    this.save();
    if (notify) this.changes.emit();
    return result;
  }

  private earnBadges(today: string): BadgeId[] {
    const ctx: BadgeContext = {
      counters: this.state.counters,
      finishedSongIds: Object.keys(this.state.songStars),
      beginnerSongIds: this.beginnerSongIds,
      daysGoalMet: Object.values(this.state.days).filter((xp) => xp >= this.state.goal).length,
      streak: this.streak(),
    };
    const earned: BadgeId[] = [];
    for (const badge of BADGES) {
      if (this.state.badges[badge.id] === undefined && badge.earned(ctx)) {
        this.state.badges[badge.id] = today;
        earned.push(badge.id);
      }
    }
    return earned;
  }

  private trimDays(): void {
    const keys = Object.keys(this.state.days).sort();
    for (const key of keys.slice(0, Math.max(0, keys.length - DAY_LIMIT))) delete this.state.days[key];
  }

  private load(): void {
    try {
      const raw = this.storage?.getItem(STORAGE_KEY);
      if (!raw) return;
      this.state = readState(JSON.parse(raw)) ?? emptyState();
    } catch {
      this.state = emptyState();
    }
  }

  private save(): void {
    try {
      this.storage?.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch {
      // storage full or blocked: the progress is just not kept
    }
  }
}
