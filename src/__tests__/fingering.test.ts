import { describe, it, expect } from 'vitest';
import { fingering as legacyFingering, scaleOf, type ScaleType } from '../scales/scaleData';
import { fingeringFor } from '../scales/fingering';
import { spellScale } from '../theory/spell';

describe('fingeringFor', () => {
  it('gives the usual fingers of C major, for each hand, one octave up', () => {
    const c = spellScale(0, 'major');
    expect(fingeringFor(c, 'right')).toEqual([1, 2, 3, 1, 2, 3, 4, 5]);
    expect(fingeringFor(c, 'left')).toEqual([5, 4, 3, 2, 1, 3, 2, 1]);
  });

  it('gives F major and B major their own fingers', () => {
    expect(fingeringFor(spellScale(5, 'major'), 'right')).toEqual([1, 2, 3, 4, 1, 2, 3, 4]);
    expect(fingeringFor(spellScale(11, 'major'), 'left')).toEqual([4, 3, 2, 1, 4, 3, 2, 1]);
  });

  it('gives the minor scales of A, E and D the usual fingers', () => {
    for (const root of [9, 4, 2]) {
      for (const id of ['natural-minor', 'harmonic-minor', 'melodic-minor'] as const) {
        expect(fingeringFor(spellScale(root, id), 'right'), `${id} ${root}`).toEqual([1, 2, 3, 1, 2, 3, 4, 5]);
      }
    }
  });

  it('is nothing for a scale that has no agreed fingering', () => {
    expect(fingeringFor(spellScale(1, 'major'), 'right')).toBeNull(); // D flat major
    expect(fingeringFor(spellScale(0, 'pentatonic-major'), 'right')).toBeNull();
    expect(fingeringFor(spellScale(0, 'dorian'), 'left')).toBeNull();
    expect(fingeringFor(spellScale('D', 'shur'), 'right')).toBeNull();
    expect(fingeringFor(spellScale('C', 'mahur'), 'right')).toBeNull(); // the notes of C major, but not the scale
  });

  it('gives one finger for each note of the scale, root at both ends', () => {
    const scale = spellScale(0, 'major');
    expect(fingeringFor(scale, 'right')).toHaveLength(scale.pitches.length);
  });

  it('gives a copy, so a caller cannot change the table', () => {
    const scale = spellScale(0, 'major');
    fingeringFor(scale, 'right')![0] = 9;
    expect(fingeringFor(scale, 'right')![0]).toBe(1);
  });

  it('agrees with what the first version of the screen had, on every root', () => {
    const ids: ReadonlyArray<readonly [ScaleType, Parameters<typeof spellScale>[1]]> = [
      ['major', 'major'], ['minor', 'natural-minor'], ['harmonic', 'harmonic-minor'], ['melodic', 'melodic-minor'], ['pentaMajor', 'pentatonic-major'], ['pentaMinor', 'pentatonic-minor'],
    ];
    for (const [old, id] of ids) {
      for (let pc = 0; pc < 12; pc++) {
        for (const hand of ['right', 'left'] as const) {
          expect(fingeringFor(spellScale(pc, id), hand), `${id} ${pc} ${hand}`).toEqual(legacyFingering(scaleOf(pc, old), hand));
        }
      }
    }
  });
});
