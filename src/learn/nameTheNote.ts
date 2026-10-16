import { MAX_STAGE, RECENT_LIMIT, type NoteStats } from './noteStats';
import { pickNextPitch } from './noteScheduler';

export type Clef = 'treble' | 'bass';

export interface Question {
  pitch: string;
  clef: Clef;
  stage: number;
}

export interface AnswerResult {
  correct: boolean;
  expectedPitch: string;
  expectedLetter: string;
  unlockedStage: number | null;
}

const STAGE_1 = ['C4', 'D4', 'E4', 'F4', 'G4'];
const STAGE_2 = ['E4', 'F4', 'G4', 'A4', 'B4', 'C5', 'D5', 'E5', 'F5'];
const STAGE_3 = ['G2', 'A2', 'B2', 'C3', 'D3', 'E3', 'F3', 'G3', 'A3'];
const STAGE_4 = [...new Set([...STAGE_1, ...STAGE_2, ...STAGE_3])];
const STAGE_5 = ['B3', 'C4', 'D4', 'A5', 'B5', 'C6', 'D2', 'E2', 'F2'];

export const STAGE_POOLS: Readonly<Record<number, readonly string[]>> = {
  1: STAGE_1,
  2: STAGE_2,
  3: STAGE_3,
  4: STAGE_4,
  5: STAGE_5,
};

export const UNLOCK_ACCURACY = 0.9;

/** C4 (middle C) and above are written in treble clef, everything lower in bass clef. */
export function clefForPitch(pitch: string): Clef {
  const octave = parseInt(pitch.replace(/^[A-G][#b]?/, ''), 10);
  return octave >= 4 ? 'treble' : 'bass';
}

export class NameTheNoteQuiz {
  private stage = 1;
  private currentQuestion: Question | null = null;
  private lastPitch: string | null = null;
  private lastResult: AnswerResult | null = null;
  private readonly stats: NoteStats;
  private readonly rng: () => number;

  constructor(stats: NoteStats, rng: () => number = Math.random) {
    this.stats = stats;
    this.rng = rng;
  }

  getStage(): number {
    return this.stage;
  }

  getMaxStage(): number {
    return this.stats.getMaxStage();
  }

  setStage(stage: number): boolean {
    if (!Number.isInteger(stage) || stage < 1 || stage > this.stats.getMaxStage()) return false;
    this.stage = stage;
    this.lastPitch = null;
    return true;
  }

  next(): Question {
    const pitch = pickNextPitch(STAGE_POOLS[this.stage], (p) => this.stats.get(p), this.lastPitch, this.rng);
    this.lastPitch = pitch;
    this.lastResult = null;
    this.currentQuestion = { pitch, clef: clefForPitch(pitch), stage: this.stage };
    return this.currentQuestion;
  }

  current(): Question | null {
    return this.currentQuestion;
  }

  recentAccuracy(): { answered: number; accuracy: number } {
    return this.stats.recent(this.stage);
  }

  /** The letter alone is enough: C in any octave. */
  answerLetter(letter: string): AnswerResult {
    const question = this.requireQuestion();
    return this.lastResult ?? this.finish(question, letter.toUpperCase() === question.pitch[0]);
  }

  /** A played note must be the exact pitch, octave included. */
  answerPitch(pitch: string): AnswerResult {
    const question = this.requireQuestion();
    return this.lastResult ?? this.finish(question, pitch === question.pitch);
  }

  private requireQuestion(): Question {
    if (!this.currentQuestion) throw new Error('No question has been asked');
    return this.currentQuestion;
  }

  private finish(question: Question, correct: boolean): AnswerResult {
    this.stats.record(question.pitch, question.stage, correct);
    let unlockedStage: number | null = null;
    if (question.stage === this.stats.getMaxStage() && question.stage < MAX_STAGE) {
      const recent = this.stats.recent(question.stage);
      if (recent.answered >= RECENT_LIMIT && recent.accuracy >= UNLOCK_ACCURACY && this.stats.unlock(question.stage + 1)) {
        unlockedStage = question.stage + 1;
      }
    }
    this.lastResult = {
      correct,
      expectedPitch: question.pitch,
      expectedLetter: question.pitch[0],
      unlockedStage,
    };
    return this.lastResult;
  }
}
