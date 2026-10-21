import { describe, it, expect } from 'vitest';
import { stepsOf, toneLabel } from '../scales/stairs';
import { SCALES } from '../theory/scaleCatalog';
import { spellScale } from '../theory/spell';

describe('toneLabel', () => {
  it('writes a step in tones: whole numbers, and halves and quarters as fractions', () => {
    expect(toneLabel(1)).toBe('1');
    expect(toneLabel(2)).toBe('2');
    expect(toneLabel(0.5)).toBe('½');
    expect(toneLabel(1.5)).toBe('1½');
    expect(toneLabel(0.75)).toBe('¾');
    expect(toneLabel(1.75)).toBe('1¾');
    expect(toneLabel(0.25)).toBe('¼');
    expect(toneLabel(2.25)).toBe('2¼');
  });

  it('writes any other number as it is', () => {
    expect(toneLabel(0.3)).toBe('0.3');
  });
});

describe('stepsOf', () => {
  it('gives C major its seven steps: whole, whole, half, whole, whole, whole, half', () => {
    const steps = stepsOf(spellScale(0, 'major'));
    expect(steps.map((s) => s.name)).toEqual(['C', 'D', 'E', 'F', 'G', 'A', 'B']);
    expect(steps.map((s) => s.gap)).toEqual([2, 2, 1, 2, 2, 2, 1]);
    expect(steps.map((s) => toneLabel(s.tones))).toEqual(['1', '1', '½', '1', '1', '1', '½']);
    expect(steps.map((s) => s.degree)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(steps.map((s) => s.tonic)).toEqual([true, false, false, false, false, false, false]);
    expect(steps.every((s) => !s.quarter)).toBe(true);
  });

  it('measures each step from its note to the next, and the last back to the root an octave up', () => {
    const steps = stepsOf(spellScale(0, 'major'));
    expect(steps.at(-1)).toMatchObject({ name: 'B', offset: 11, gap: 1, tones: 0.5 });
  });

  it('shows the quarter tones of Shur: three-quarter tone steps beside the koron', () => {
    const steps = stepsOf(spellScale('D', 'shur')); // D Ek F G A Bb C
    expect(steps.map((s) => s.name)).toEqual(['D', 'Ek', 'F', 'G', 'A', 'Bb', 'C']);
    expect(steps.map((s) => s.gap)).toEqual([1.5, 1.5, 2, 2, 1, 2, 2]);
    expect(steps.map((s) => toneLabel(s.tones))).toEqual(['¾', '¾', '1', '1', '½', '1', '1']);
    expect(steps.map((s) => s.quarter)).toEqual([false, true, false, false, false, false, false]);
  });

  it('gives Segah a root that is itself a quarter tone', () => {
    const steps = stepsOf(spellScale('Ek', 'segah'));
    expect(steps.map((s) => s.name)).toEqual(['Ek', 'F', 'G', 'Ak', 'Bb', 'C', 'D']);
    expect(steps.map((s) => s.gap)).toEqual([1.5, 2, 1.5, 1.5, 2, 2, 1.5]);
    expect(steps.map((s) => s.quarter)).toEqual([true, false, false, true, false, false, false]);
    expect(steps[0].tonic).toBe(true);
  });

  it('gives a pentatonic scale its steps of a tone and a half', () => {
    expect(stepsOf(spellScale(0, 'pentatonic-major')).map((s) => toneLabel(s.tones))).toEqual(['1', '1', '1½', '1', '1½']);
  });

  it('gives the chromatic scale twelve steps of a semitone', () => {
    const steps = stepsOf(spellScale(0, 'chromatic'));
    expect(steps).toHaveLength(12);
    expect(steps.every((s) => s.gap === 1 && toneLabel(s.tones) === '½')).toBe(true);
  });

  it('adds up to one octave, for every scale on every note', () => {
    for (const scale of SCALES) {
      for (let pc = 0; pc < 12; pc++) {
        const steps = stepsOf(spellScale(pc, scale.id));
        expect(steps.reduce((sum, s) => sum + s.gap, 0), `${scale.id} on ${pc}`).toBe(12);
        expect(steps.filter((s) => s.tonic)).toHaveLength(1);
      }
    }
  });
});
