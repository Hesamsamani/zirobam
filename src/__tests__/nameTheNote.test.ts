import { describe, it, expect } from 'vitest';
import { NoteStats } from '../learn/noteStats';
import { NameTheNoteQuiz, STAGE_POOLS, clefForPitch } from '../learn/nameTheNote';

function fakeStorage() {
  const data: Record<string, string> = {};
  return {
    getItem: (k: string) => (k in data ? data[k] : null),
    setItem: (k: string, v: string) => {
      data[k] = v;
    },
  };
}

function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function makeQuiz() {
  const stats = new NoteStats(fakeStorage());
  return { stats, quiz: new NameTheNoteQuiz(stats, seeded(3)) };
}

describe('stages', () => {
  it('stage 1 is five natural notes C4 to G4', () => {
    expect([...STAGE_POOLS[1]]).toEqual(['C4', 'D4', 'E4', 'F4', 'G4']);
  });

  it('every pool pitch is a natural note with an octave', () => {
    for (const pool of Object.values(STAGE_POOLS)) {
      for (const pitch of pool) expect(pitch).toMatch(/^[A-G]\d$/);
    }
  });

  it('chooses the clef by pitch: C4 and above treble, below bass', () => {
    expect(clefForPitch('C4')).toBe('treble');
    expect(clefForPitch('A5')).toBe('treble');
    expect(clefForPitch('B3')).toBe('bass');
    expect(clefForPitch('F2')).toBe('bass');
  });
});

describe('NameTheNoteQuiz', () => {
  it('asks from the current stage and never repeats the previous pitch', () => {
    const { quiz } = makeQuiz();
    let last = '';
    for (let i = 0; i < 50; i++) {
      const q = quiz.next();
      expect(STAGE_POOLS[1]).toContain(q.pitch);
      expect(q.stage).toBe(1);
      expect(q.pitch).not.toBe(last);
      last = q.pitch;
    }
  });

  it('answerLetter is correct for the right letter in any octave and records stats', () => {
    const { quiz, stats } = makeQuiz();
    const q = quiz.next();
    const result = quiz.answerLetter(q.pitch[0].toLowerCase());
    expect(result).toMatchObject({ correct: true, expectedPitch: q.pitch, expectedLetter: q.pitch[0] });
    expect(stats.get(q.pitch)).toMatchObject({ seen: 1, correct: 1 });
  });

  it('answerPitch needs the exact octave', () => {
    const { quiz } = makeQuiz();
    const q = quiz.next();
    const wrongOctave = `${q.pitch[0]}${Number(q.pitch.slice(1)) + 1}`;
    expect(quiz.answerPitch(wrongOctave).correct).toBe(false);
  });

  it('a wrong answer is recorded as wrong', () => {
    const { quiz, stats } = makeQuiz();
    const q = quiz.next();
    const wrongLetter = q.pitch[0] === 'C' ? 'D' : 'C';
    expect(quiz.answerLetter(wrongLetter).correct).toBe(false);
    expect(stats.get(q.pitch)).toMatchObject({ seen: 1, correct: 0 });
  });

  it('answering the same question twice returns the first result and counts once', () => {
    const { quiz, stats } = makeQuiz();
    const q = quiz.next();
    const first = quiz.answerLetter(q.pitch[0]);
    const second = quiz.answerLetter('Z');
    expect(second).toEqual(first);
    expect(stats.get(q.pitch)?.seen).toBe(1);
  });

  it('throws when answering before asking', () => {
    const { quiz } = makeQuiz();
    expect(() => quiz.answerLetter('C')).toThrow();
  });

  it('unlocks the next stage after 20 answers at 90% or better', () => {
    const { quiz } = makeQuiz();
    let unlocked: number | null = null;
    for (let i = 0; i < 20; i++) {
      const q = quiz.next();
      const letter = i < 2 ? (q.pitch[0] === 'C' ? 'D' : 'C') : q.pitch[0];
      unlocked = quiz.answerLetter(letter).unlockedStage;
    }
    expect(unlocked).toBe(2);
    expect(quiz.getMaxStage()).toBe(2);
    expect(quiz.setStage(2)).toBe(true);
    expect(quiz.next().stage).toBe(2);
    expect(quiz.setStage(3)).toBe(false);
  });

  it('does not unlock below 90% accuracy', () => {
    const { quiz } = makeQuiz();
    for (let i = 0; i < 20; i++) {
      const q = quiz.next();
      const letter = i < 3 ? (q.pitch[0] === 'C' ? 'D' : 'C') : q.pitch[0];
      quiz.answerLetter(letter);
    }
    expect(quiz.getMaxStage()).toBe(1);
  });

  it('rejects stages that are not unlocked', () => {
    const { quiz } = makeQuiz();
    expect(quiz.setStage(2)).toBe(false);
    expect(quiz.setStage(0)).toBe(false);
    expect(quiz.getStage()).toBe(1);
  });
});
