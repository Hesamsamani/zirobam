import { describe, it, expect } from 'vitest';
import {
  EAR_STAGES,
  INTERVALS,
  intervalName,
  makeQuestion,
  midiToNote,
  noteToMidi,
  seededRng,
  type EarQuestion,
  type IntervalId,
} from '../ear/questions';

function many(stage: number, count = 200, seed = 7): EarQuestion[] {
  const rng = seededRng(seed);
  const out: EarQuestion[] = [];
  let previous: EarQuestion | null = null;
  for (let i = 0; i < count; i++) {
    previous = makeQuestion(stage, rng, previous);
    out.push(previous);
  }
  return out;
}

describe('note helpers', () => {
  it('turns notes into MIDI numbers and back, with sharps', () => {
    expect(noteToMidi('C4')).toBe(60);
    expect(noteToMidi('A4')).toBe(69);
    expect(noteToMidi('C#5')).toBe(73);
    expect(midiToNote(60)).toBe('C4');
    expect(midiToNote(70)).toBe('A#4');
    expect(midiToNote(noteToMidi('F#3'))).toBe('F#3');
  });

  it('knows the size of every interval in semitones', () => {
    expect(INTERVALS.m2).toBe(1);
    expect(INTERVALS.TT).toBe(6);
    expect(INTERVALS.P5).toBe(7);
    expect(INTERVALS.P8).toBe(12);
    expect(intervalName(3)).toBe('m3');
    expect(intervalName(12)).toBe('P8');
  });
});

describe('seededRng', () => {
  it('gives the same numbers for the same seed, always between 0 and 1', () => {
    const a = seededRng(42);
    const b = seededRng(42);
    const first = Array.from({ length: 5 }, () => a());
    expect(first).toEqual(Array.from({ length: 5 }, () => b()));
    expect(first.every((n) => n >= 0 && n < 1)).toBe(true);
    expect(seededRng(43)()).not.toBe(first[0]);
  });
});

describe('makeQuestion', () => {
  it('is the same for the same random numbers', () => {
    expect(many(3, 20, 5)).toEqual(many(3, 20, 5));
  });

  it('has five stages', () => {
    expect(EAR_STAGES).toBe(5);
    for (let stage = 1; stage <= 5; stage++) expect(makeQuestion(stage, seededRng(1)).stage).toBe(stage);
  });

  it('stage 1: two different notes, and which one is higher', () => {
    for (const q of many(1)) {
      if (q.kind !== 'higher') throw new Error('wrong kind');
      const [a, b] = q.notes.map(noteToMidi);
      expect(a).not.toBe(b);
      expect(Math.abs(a - b)).toBeGreaterThanOrEqual(2);
      expect(q.answer).toBe(a > b ? 'first' : 'second');
      expect(q.choices).toEqual(['first', 'second']);
    }
    const answers = new Set(many(1).map((q) => (q.kind === 'higher' ? q.answer : '')));
    expect(answers).toEqual(new Set(['first', 'second']));
  });

  it('stage 2: the five easy intervals, going up, one note after the other', () => {
    const seen = new Set<IntervalId>();
    for (const q of many(2)) {
      if (q.kind !== 'interval') throw new Error('wrong kind');
      expect(q.together).toBe(false);
      expect(q.choices).toEqual(['M2', 'M3', 'P4', 'P5', 'P8']);
      const [a, b] = q.notes.map(noteToMidi);
      expect(b - a).toBe(INTERVALS[q.answer]);
      seen.add(q.answer);
    }
    expect([...seen].sort()).toEqual(['M2', 'M3', 'P4', 'P5', 'P8']);
  });

  it('stage 3: every interval, also played together', () => {
    const seen = new Set<IntervalId>();
    let together = 0;
    for (const q of many(3, 400)) {
      if (q.kind !== 'interval') throw new Error('wrong kind');
      expect(q.choices).toHaveLength(12);
      const [a, b] = q.notes.map(noteToMidi);
      expect(b - a).toBe(INTERVALS[q.answer]);
      seen.add(q.answer);
      if (q.together) together++;
    }
    expect(seen.size).toBe(12);
    expect(together).toBeGreaterThan(40);
    expect(together).toBeLessThan(250);
  });

  it('stage 4: a major or minor triad, with the third a major or a minor third above the root', () => {
    const seen = new Set<string>();
    for (const q of many(4)) {
      if (q.kind !== 'chord') throw new Error('wrong kind');
      const [root, third, fifth] = q.notes.map(noteToMidi);
      expect(fifth - root).toBe(7);
      expect(third - root).toBe(q.answer === 'major' ? 4 : 3);
      expect(q.choices).toEqual(['major', 'minor']);
      seen.add(q.answer);
    }
    expect(seen).toEqual(new Set(['major', 'minor']));
  });

  it('stage 5: a note to play back, or a short melody of white keys without a repeated note', () => {
    const kinds = new Set<string>();
    for (const q of many(5)) {
      if (q.kind !== 'playNote' && q.kind !== 'playMelody') throw new Error('wrong kind');
      kinds.add(q.kind);
      expect(q.notes).toHaveLength(q.kind === 'playNote' ? 1 : 3);
      for (const note of q.notes) {
        expect(note).toMatch(/^[A-G]\d$/); // white keys only
        expect(noteToMidi(note)).toBeGreaterThanOrEqual(60);
        expect(noteToMidi(note)).toBeLessThanOrEqual(72);
      }
      for (let i = 1; i < q.notes.length; i++) expect(q.notes[i]).not.toBe(q.notes[i - 1]);
    }
    expect(kinds).toEqual(new Set(['playNote', 'playMelody']));
  });

  it('keeps every note between C3 and C6', () => {
    for (let stage = 1; stage <= 5; stage++) {
      for (const q of many(stage, 300)) {
        for (const note of q.notes) {
          expect(noteToMidi(note)).toBeGreaterThanOrEqual(48);
          expect(noteToMidi(note)).toBeLessThanOrEqual(84);
        }
      }
    }
  });

  it('does not ask the same question twice in a row', () => {
    for (let stage = 1; stage <= 5; stage++) {
      const list = many(stage, 150);
      for (let i = 1; i < list.length; i++) {
        expect(`${list[i].kind}:${list[i].notes}`, `stage ${stage} question ${i}`).not.toBe(`${list[i - 1].kind}:${list[i - 1].notes}`);
      }
    }
  });

  it('gives each question a key for the statistics', () => {
    const q2 = makeQuestion(2, seededRng(3));
    expect(q2.key).toBe(`interval:${q2.kind === 'interval' ? q2.answer : ''}`);
    expect(makeQuestion(1, seededRng(3)).key).toBe('higher');
    const q4 = makeQuestion(4, seededRng(3));
    expect(q4.key).toBe(`chord:${q4.kind === 'chord' ? q4.answer : ''}`);
  });

  it('treats an unknown stage as the nearest one', () => {
    expect(makeQuestion(0, seededRng(1)).stage).toBe(1);
    expect(makeQuestion(99, seededRng(1)).stage).toBe(5);
  });
});

describe('the sounds of a question', () => {
  it('plays two notes one after the other, or together', () => {
    const rng = seededRng(11);
    const sequential = many(2)[0];
    expect(sequential.plan.map((step) => step.notes.length)).toEqual([1, 1]);
    expect(sequential.plan[1].at).toBeGreaterThan(sequential.plan[0].at);
    const together = many(3, 400).find((q) => q.kind === 'interval' && q.together)!;
    expect(together.plan).toHaveLength(1);
    expect(together.plan[0].notes).toHaveLength(2);
    expect(rng()).toBeGreaterThanOrEqual(0);
  });

  it('plays a chord as one block', () => {
    const q = many(4)[0];
    expect(q.plan).toHaveLength(1);
    expect(q.plan[0].notes).toEqual(q.notes);
  });

  it('plays a melody note by note, in order', () => {
    const q = many(5, 100).find((x) => x.kind === 'playMelody')!;
    expect(q.plan.map((step) => step.notes[0])).toEqual(q.notes);
    for (let i = 1; i < q.plan.length; i++) expect(q.plan[i].at).toBeGreaterThan(q.plan[i - 1].at);
  });

  it('makes every sound last a moment', () => {
    for (let stage = 1; stage <= 5; stage++) {
      for (const step of many(stage, 30).flatMap((q) => q.plan)) expect(step.length).toBeGreaterThan(0.3);
    }
  });
});
