import { keyName } from '../theory/pitch';
import { MistakeLog } from './mistakeLog';
import { SrsStore } from './srs';

/**
 * What a key press says about the notes that were asked. A right key is a right answer for the written note it
 * matched (a pressed A sharp answers a written B flat); a wrong key is a miss for every note that was waited for.
 */
export function answersFromPress(expected: readonly string[], played: string, right: boolean): Array<{ note: string; correct: boolean }> {
  if (!right) return expected.map((note) => ({ note, correct: false }));
  const key = keyName(played);
  const matched = expected.find((note) => keyName(note) === key);
  return matched ? [{ note: matched, correct: true }] : [];
}

/** The two stores of what the student knows and what they miss, behind the few calls the screens make. */
export class PracticeMemory {
  readonly log: MistakeLog;
  readonly srs: SrsStore;

  constructor(log: MistakeLog = new MistakeLog(), srs: SrsStore = new SrsStore()) {
    this.log = log;
    this.srs = srs;
  }

  /** A note was asked (in the quiz, an exercise, a piece) and answered right or wrong. The note is written as in the score (Bb4). */
  noteAnswered(note: string, correct: boolean): void {
    this.log.recordNote(note, !correct);
    this.srs.review(`note:${note}`, correct);
  }

  /** A key was pressed while `expected` notes were waited for, and was right or wrong. */
  keyPressed(expected: readonly string[], played: string, right: boolean): void {
    for (const answer of answersFromPress(expected, played, right)) this.noteAnswered(answer.note, answer.correct);
  }

  /** A chord of the chord quiz was answered; `symbol` is how it was asked (`Cm7`, `C/E`). */
  chordAnswered(symbol: string, correct: boolean): void {
    this.log.recordChord(symbol, !correct);
    this.srs.review(`chord:${symbol}`, correct);
  }

  /** An ear question was answered; `question` is the key the ear training knows it by (`interval:m3`). */
  earAnswered(question: string, correct: boolean): void {
    this.srs.review(`ear:${question}`, correct);
  }
}
