import { describe, expect, it } from 'vitest';
import { seededRng } from '../core/rng';
import { CHORD_STAGES, judgeChord, makeChordQuestion, type ChordQuestion } from '../chords/chordQuiz';

const ask = (stage: number, seed = 1): ChordQuestion => makeChordQuestion(stage, seededRng(seed));

describe('makeChordQuestion', () => {
  it('has five stages', () => {
    expect(CHORD_STAGES).toBe(5);
  });

  it('asks major and minor triads on the white keys in the first stage', () => {
    const rng = seededRng(3);
    for (let i = 0; i < 60; i++) {
      const q = makeChordQuestion(1, rng);
      expect(['major', 'minor']).toContain(q.def.id);
      expect([0, 2, 4, 5, 7, 9, 11]).toContain(q.rootPc);
      expect(q.bass).toBeNull();
      expect(q.inversion).toBe(0);
    }
  });

  it('uses every root in the second stage, more kinds in the third and sevenths in the fourth', () => {
    const rng = seededRng(5);
    const roots = new Set<number>();
    const kinds3 = new Set<string>();
    const kinds4 = new Set<string>();
    for (let i = 0; i < 300; i++) {
      roots.add(makeChordQuestion(2, rng).rootPc);
      kinds3.add(makeChordQuestion(3, rng).def.id);
      kinds4.add(makeChordQuestion(4, rng).def.id);
    }
    expect(roots.size).toBe(12);
    expect([...kinds3].sort()).toEqual(['aug', 'dim', 'major', 'minor', 'sus2', 'sus4']);
    expect([...kinds4].sort()).toEqual(['dom7', 'm7', 'm7b5', 'maj7']);
  });

  it('turns the chord in the fifth stage and names the bass', () => {
    const rng = seededRng(7);
    let turned = 0;
    for (let i = 0; i < 200; i++) {
      const q = makeChordQuestion(5, rng);
      if (q.inversion > 0) {
        turned++;
        expect(q.bass).toBe(q.notes[q.inversion]);
        expect(q.symbol).toBe(`${q.root}${q.def.symbol}/${q.bass}`);
      } else {
        expect(q.bass).toBeNull();
      }
    }
    expect(turned).toBeGreaterThan(50);
  });

  it('is the same for the same seed and never the chord just asked', () => {
    expect(ask(3, 9)).toEqual(ask(3, 9));
    const rng = seededRng(2);
    let previous: ChordQuestion | null = null;
    for (let i = 0; i < 200; i++) {
      const q: ChordQuestion = makeChordQuestion(1, rng, previous);
      if (previous) expect(q.symbol).not.toBe(previous.symbol);
      previous = q;
    }
  });

  it('keeps the stage in range', () => {
    expect(makeChordQuestion(0, seededRng(1)).stage).toBe(0);
    expect(() => makeChordQuestion(99, seededRng(1))).not.toThrow();
  });
});

describe('judgeChord', () => {
  const cMajor = ask(1, 1);

  function question(root: string, rootPc: number, id: string, notes: string[], bass: string | null = null): ChordQuestion {
    return { ...cMajor, root, rootPc, def: { ...cMajor.def, id }, notes, bass, inversion: bass ? notes.indexOf(bass) : 0, symbol: root, key: root };
  }

  it('is right for the notes of the chord, in any octave and with any doubling', () => {
    const c = question('C', 0, 'major', ['C', 'E', 'G']);
    expect(judgeChord(c, [60, 64, 67])).toBe(true);
    expect(judgeChord(c, [48, 64, 79])).toBe(true);
    expect(judgeChord(c, [52, 55, 60, 64])).toBe(true);
  });

  it('is wrong for a missing note, an extra note, or other notes', () => {
    const c = question('C', 0, 'major', ['C', 'E', 'G']);
    expect(judgeChord(c, [60, 64])).toBe(false);
    expect(judgeChord(c, [60, 64, 67, 70])).toBe(false);
    expect(judgeChord(c, [60, 63, 67])).toBe(false);
    expect(judgeChord(c, [])).toBe(false);
  });

  it('wants the bass lowest for a turned chord', () => {
    const turned = question('C', 0, 'major', ['C', 'E', 'G'], 'E');
    expect(judgeChord(turned, [64, 67, 72])).toBe(true);
    expect(judgeChord(turned, [60, 64, 67])).toBe(false);
  });

  it('takes a flat and its sharp for the same key', () => {
    const bb = question('Bb', 10, 'major', ['Bb', 'D', 'F']);
    expect(judgeChord(bb, [58, 62, 65])).toBe(true);
  });
});
