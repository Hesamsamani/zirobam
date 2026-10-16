import { pickNextPitch } from '../learn/noteScheduler';
import type { NoteStats } from '../learn/noteStats';

/** 3 stars from 90 percent of the hits right, 2 from 70 percent, and 1 for finishing at all. */
export function starsFor(notes: number, mistakes: number): 1 | 2 | 3 {
  const accuracy = notes / (notes + mistakes);
  if (accuracy >= 0.9) return 3;
  if (accuracy >= 0.7) return 2;
  return 1;
}

export interface SongPlayResult {
  correct: boolean;
  done: boolean;
}

/** Playing a tune note by note: the next note only comes when the right bar was hit. */
export class SongRun {
  private readonly notes: readonly string[];
  private index = 0;
  private wrongHits = 0;

  constructor(notes: readonly string[]) {
    if (notes.length === 0) throw new Error('A song needs at least one note');
    this.notes = notes;
  }

  current(): string | null {
    return this.index < this.notes.length ? this.notes[this.index] : null;
  }

  position(): { index: number; total: number } {
    return { index: this.index, total: this.notes.length };
  }

  mistakes(): number {
    return this.wrongHits;
  }

  isDone(): boolean {
    return this.index >= this.notes.length;
  }

  stars(): 1 | 2 | 3 {
    return starsFor(this.notes.length, this.wrongHits);
  }

  play(pitch: string): SongPlayResult {
    if (this.isDone()) return { correct: false, done: true };
    if (pitch !== this.notes[this.index]) {
      this.wrongHits++;
      return { correct: false, done: false };
    }
    this.index++;
    return { correct: true, done: this.isDone() };
  }

  restart(): void {
    this.index = 0;
    this.wrongHits = 0;
  }
}

export interface ReadResult {
  correct: boolean;
  expected: string;
}

/** "Read the note, play the bar": questions that favour the notes that were missed before. */
export class ReadRound {
  private readonly stats: NoteStats;
  private readonly rng: () => number;
  private pool: readonly string[];
  private lastPitch: string | null = null;
  private question: string | null = null;
  private answered = false;
  private runLength = 0;
  private best = 0;

  constructor(stats: NoteStats, pool: readonly string[], rng: () => number = Math.random) {
    this.stats = stats;
    this.pool = pool;
    this.rng = rng;
  }

  setPool(pool: readonly string[]): void {
    this.pool = pool;
    this.lastPitch = null;
    this.question = null;
  }

  next(): string {
    const pitch = pickNextPitch(this.pool, (p) => this.stats.get(p), this.lastPitch, this.rng);
    this.lastPitch = pitch;
    this.question = pitch;
    this.answered = false;
    return pitch;
  }

  current(): string | null {
    return this.question;
  }

  streak(): number {
    return this.runLength;
  }

  bestStreak(): number {
    return this.best;
  }

  /** Only the first answer to a question counts. */
  answer(pitch: string): ReadResult {
    if (this.question === null) throw new Error('No note has been asked');
    const expected = this.question;
    const correct = pitch === expected;
    if (!this.answered) {
      this.answered = true;
      this.stats.record(expected, 1, correct);
      this.runLength = correct ? this.runLength + 1 : 0;
      this.best = Math.max(this.best, this.runLength);
    }
    return { correct, expected };
  }
}
