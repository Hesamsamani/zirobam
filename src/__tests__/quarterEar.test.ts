import { describe, expect, it } from 'vitest';
import { seededRng } from '../core/rng';
import { makeQuarterQuestion, QUARTER_STAGES, type QuarterQuestion } from '../persian/quarterEar';
import { frequencyOf, parsePitch, pitchMidi } from '../theory/pitch';

const pitchOf = (note: string): number => pitchMidi(parsePitch(note)!);

describe('makeQuarterQuestion', () => {
  it('has four stages', () => {
    expect(QUARTER_STAGES).toBe(4);
  });

  it('asks which of two notes is lower in the first stage: a note and its koron', () => {
    const rng = seededRng(1);
    for (let i = 0; i < 60; i++) {
      const q = makeQuarterQuestion(1, rng);
      expect(q.kind).toBe('order');
      expect(q.choices).toEqual(['first', 'second']);
      expect(q.plan).toHaveLength(2);
      const [a, b] = q.plan.map((s) => pitchOf(s.note));
      expect(Math.abs(a - b)).toBeCloseTo(0.5, 5);
      expect(q.answer).toBe(a < b ? 'first' : 'second');
    }
  });

  it('asks koron or flat in the second stage: the second note is a quarter tone or a semitone below the first', () => {
    const rng = seededRng(2);
    const seen = new Set<string>();
    for (let i = 0; i < 80; i++) {
      const q = makeQuarterQuestion(2, rng);
      seen.add(q.answer);
      const [a, b] = q.plan.map((s) => pitchOf(s.note));
      expect(a - b).toBeCloseTo(q.answer === 'koron' ? 0.5 : 1, 5);
      expect(q.choices).toEqual(['koron', 'flat']);
    }
    expect([...seen].sort()).toEqual(['flat', 'koron']);
  });

  it('asks sori or sharp in the third stage: the second note is a quarter tone or a semitone above the first', () => {
    const rng = seededRng(3);
    const seen = new Set<string>();
    for (let i = 0; i < 80; i++) {
      const q = makeQuarterQuestion(3, rng);
      seen.add(q.answer);
      const [a, b] = q.plan.map((s) => pitchOf(s.note));
      expect(b - a).toBeCloseTo(q.answer === 'sori' ? 0.5 : 1, 5);
      expect(q.choices).toEqual(['sori', 'sharp']);
    }
    expect([...seen].sort()).toEqual(['sharp', 'sori']);
  });

  it('plays two motifs in the fourth stage and asks which has the koron: the one with E koron', () => {
    const rng = seededRng(4);
    for (let i = 0; i < 40; i++) {
      const q = makeQuarterQuestion(4, rng);
      expect(q.kind).toBe('motif');
      expect(q.plan).toHaveLength(8);
      const first = q.plan.slice(0, 4).map((s) => s.note);
      const second = q.plan.slice(4).map((s) => s.note);
      const withKoron = first.includes('Ek4') ? 'first' : 'second';
      expect(q.answer).toBe(withKoron);
      expect(first.includes('Ek4')).not.toBe(second.includes('Ek4'));
    }
  });

  it('puts the sounds in time order, one after the other, and every note can be sounded', () => {
    for (let stage = 1; stage <= QUARTER_STAGES; stage++) {
      const q = makeQuarterQuestion(stage, seededRng(stage));
      for (let i = 1; i < q.plan.length; i++) expect(q.plan[i].at).toBeGreaterThan(q.plan[i - 1].at);
      for (const s of q.plan) {
        expect(parsePitch(s.note), s.note).not.toBeNull();
        expect(frequencyOf(parsePitch(s.note)!)).toBeGreaterThan(100);
        expect(s.seconds).toBeGreaterThan(0);
      }
    }
  });

  it('never asks the question just asked, and keeps the stage in range', () => {
    const rng = seededRng(5);
    let previous: QuarterQuestion | null = null;
    for (let i = 0; i < 100; i++) {
      const q: QuarterQuestion = makeQuarterQuestion(2, rng, previous);
      if (previous) expect(q.key).not.toBe(previous.key);
      previous = q;
    }
    expect(makeQuarterQuestion(0, seededRng(1)).kind).toBe('order');
    expect(makeQuarterQuestion(99, seededRng(1)).kind).toBe('motif');
  });
});
