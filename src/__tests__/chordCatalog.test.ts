import { describe, it, expect } from 'vitest';
import { Chord } from 'tonal';
import { CHORD_DEFS, CHORD_FAMILIES, chordDegrees, chordsOfFamily, getChord, hasMinorThird, spellChord } from '../theory/chordCatalog';

/** The symbol `tonal` writes for the chords it has an equivalent of, where the notes are the same. */
const TONAL_SYMBOL: Record<string, string> = {
  major: 'M', minor: 'm', dim: 'dim', aug: 'aug', six: '6', m6: 'm6', maj7: 'maj7', dom7: '7', m7: 'm7', m7b5: 'm7b5', dim7: 'dim7',
  mMaj7: 'mMaj7', aug7: '7#5', augMaj7: 'maj7#5', sus2: 'sus2', sus4: 'sus4', dom7sus4: '7sus4', power: '5', dom9: '9', maj9: 'maj9',
  m9: 'm9', m11: 'm11', dom13: '13', maj13: 'maj13', m13: 'm13', add9: 'add9', madd9: 'madd9', dom7b9: '7b9', dom7s9: '7#9',
  dom7b5: '7b5', dom7s11: '7#11',
};

describe('the catalog', () => {
  it('has the families the dictionary shows, each with chords', () => {
    expect([...CHORD_FAMILIES]).toEqual(['triad', 'sixth', 'seventh', 'suspended', 'power', 'quartal', 'ninth', 'eleventh', 'thirteenth', 'add', 'altered']);
    for (const family of CHORD_FAMILIES) expect(chordsOfFamily(family).length, family).toBeGreaterThan(0);
  });

  it('has 37 chords, each once, in the order of their families', () => {
    expect(CHORD_DEFS).toHaveLength(37);
    expect(new Set(CHORD_DEFS.map((d) => d.id)).size).toBe(37);
    expect(new Set(CHORD_DEFS.map((d) => d.symbol)).size).toBe(37);
    const order = CHORD_DEFS.map((d) => CHORD_FAMILIES.indexOf(d.family));
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  it('counts the chords of each family', () => {
    expect(Object.fromEntries(CHORD_FAMILIES.map((f) => [f, chordsOfFamily(f).length]))).toEqual({
      triad: 4, sixth: 2, seventh: 8, suspended: 3, power: 1, quartal: 2, ninth: 3, eleventh: 3, thirteenth: 3, add: 3, altered: 5,
    });
  });

  it('finds a chord by its id', () => {
    expect(getChord('m7').symbol).toBe('m7');
    expect(() => getChord('nonsense')).toThrow();
  });

  it('starts every chord on the root, and rises', () => {
    for (const def of CHORD_DEFS) {
      const degrees = chordDegrees(def);
      expect(degrees[0], def.id).toEqual({ letterSteps: 0, semitones: 0 });
      for (let i = 1; i < degrees.length; i++) expect(degrees[i].semitones, def.id).toBeGreaterThan(degrees[i - 1].semitones);
    }
  });

  it('is the same as `tonal` for the chords it has, note for note', () => {
    for (const def of CHORD_DEFS) {
      const symbol = TONAL_SYMBOL[def.id];
      if (!symbol) continue;
      expect([...def.formula], def.id).toEqual(Chord.get(`C${symbol}`).intervals);
    }
  });

  it('says whether a chord has a minor third, which decides the case of its Roman numeral', () => {
    expect(hasMinorThird(getChord('minor'))).toBe(true);
    expect(hasMinorThird(getChord('dim'))).toBe(true);
    expect(hasMinorThird(getChord('m7b5'))).toBe(true);
    expect(hasMinorThird(getChord('major'))).toBe(false);
    expect(hasMinorThird(getChord('sus4'))).toBe(false);
    expect(hasMinorThird(getChord('power'))).toBe(false);
  });
});

describe('spellChord', () => {
  const names = (root: string, id: string) => spellChord(root, getChord(id));

  it('writes the notes of a chord with their harmonic spelling', () => {
    expect(names('C', 'major')).toEqual(['C', 'E', 'G']);
    expect(names('C', 'minor')).toEqual(['C', 'Eb', 'G']);
    expect(names('Bb', 'major')).toEqual(['Bb', 'D', 'F']);
    expect(names('F#', 'minor')).toEqual(['F#', 'A', 'C#']);
    expect(names('B', 'dim7')).toEqual(['B', 'D', 'F', 'Ab']);
    expect(names('C', 'dom9')).toEqual(['C', 'E', 'G', 'Bb', 'D']);
    expect(names('C', 'dom13')).toEqual(['C', 'E', 'G', 'Bb', 'D', 'A']);
    expect(names('C', 'quartal')).toEqual(['C', 'F', 'Bb']);
    expect(names('C', 'quintal')).toEqual(['C', 'G', 'D']);
    expect(names('C', 'power')).toEqual(['C', 'G']);
  });

  it('agrees with `tonal` on the spelling of every chord on every root it can write', () => {
    for (const root of ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']) {
      for (const def of CHORD_DEFS) {
        const symbol = TONAL_SYMBOL[def.id];
        if (!symbol) continue;
        expect(spellChord(root, def), `${root}${def.symbol}`).toEqual(Chord.get(`${root}${symbol}`).notes);
      }
    }
  });

  it('gives nothing for a chord that would need more than a double sign', () => {
    expect(spellChord('G##', getChord('maj7'))).toBeNull();
  });
});
