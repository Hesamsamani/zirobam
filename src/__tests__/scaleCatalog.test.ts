import { describe, it, expect } from 'vitest';
import { ScaleType } from 'tonal';
import { parsePitch } from '../theory/pitch';
import { SCALES, SCALE_CATEGORIES, SCALE_IDS, getScale, parseFormula, scalesOfCategory, type ScaleId } from '../theory/scaleCatalog';

/** The names `tonal` gives the scales it has an equivalent of; the Persian modes and Neapolitan minor are not in it. */
const TONAL_NAME: Partial<Record<ScaleId, string>> = {
  major: 'major',
  'harmonic-major': 'harmonic major',
  'double-harmonic-major': 'double harmonic major',
  'natural-minor': 'minor',
  'harmonic-minor': 'harmonic minor',
  'melodic-minor': 'melodic minor',
  'hungarian-minor': 'hungarian minor',
  dorian: 'dorian',
  phrygian: 'phrygian',
  lydian: 'lydian',
  mixolydian: 'mixolydian',
  locrian: 'locrian',
  'pentatonic-major': 'major pentatonic',
  'pentatonic-minor': 'minor pentatonic',
  chromatic: 'chromatic',
  blues: 'minor blues',
  'whole-tone': 'whole tone',
  'diminished-wh': 'diminished',
  'diminished-hw': 'half-whole diminished',
};

describe('the catalog', () => {
  it('has the 32 scales of the dictionary, each once', () => {
    expect(SCALES).toHaveLength(32);
    expect(SCALE_IDS).toHaveLength(32);
    expect(new Set(SCALES.map((s) => s.id)).size).toBe(32);
    expect(SCALES.map((s) => s.id)).toEqual([...SCALE_IDS]);
  });

  it('puts each scale in a category, and the categories have these many', () => {
    const counts = Object.fromEntries(SCALE_CATEGORIES.map((c) => [c, scalesOfCategory(c).length]));
    expect(counts).toEqual({ major: 3, minor: 5, church: 5, persian: 12, pentatonic: 2, blues: 1, chromatic: 1, wholetone: 1, diminished: 2 });
  });

  it('finds a scale by its id', () => {
    expect(getScale('dorian').category).toBe('church');
    expect(() => getScale('nonsense' as ScaleId)).toThrow();
  });

  it('gives every scale words to be found by, in English and in Persian', () => {
    for (const scale of SCALES) {
      expect(scale.aliases.en.length, scale.id).toBeGreaterThan(0);
      expect(scale.aliases.fa.length, scale.id).toBeGreaterThan(0);
      for (const word of [...scale.aliases.en, ...scale.aliases.fa]) expect(word.trim(), scale.id).toBe(word);
      // a Persian alias is written with Persian letters, never the Arabic ones
      for (const word of scale.aliases.fa) expect(word, `${scale.id}: ${word}`).not.toMatch(/[يك]/);
    }
  });
});

describe('parseFormula', () => {
  it('reads a degree with its sign as an offset in semitones from the root', () => {
    expect(parseFormula('1 2 b3 4 5 b6 b7')).toEqual([
      { degree: 1, offset: 0 },
      { degree: 2, offset: 2 },
      { degree: 3, offset: 3 },
      { degree: 4, offset: 5 },
      { degree: 5, offset: 7 },
      { degree: 6, offset: 8 },
      { degree: 7, offset: 10 },
    ]);
  });

  it('knows sharp, double signs and the quarter tones koron and sori', () => {
    expect(parseFormula('#4')).toEqual([{ degree: 4, offset: 6 }]);
    expect(parseFormula('##4 bb3 k2 o6')).toEqual([
      { degree: 4, offset: 7 },
      { degree: 3, offset: 2 },
      { degree: 2, offset: 1.5 },
      { degree: 6, offset: 9.5 },
    ]);
  });

  it('refuses what is not a formula', () => {
    for (const bad of ['', '0', '8', 'x3', '3b', 'bbb3', '1,2', '#']) expect(() => parseFormula(bad), bad).toThrow();
  });
});

describe('every formula', () => {
  it.each(SCALES.map((s) => [s.id, s.formula]))('%s: starts on the root, rises, and stays inside the octave', (_id, formula) => {
    const notes = parseFormula(formula as string);
    expect(notes[0]).toEqual({ degree: 1, offset: 0 });
    for (let i = 1; i < notes.length; i++) {
      expect(notes[i].offset).toBeGreaterThan(notes[i - 1].offset);
      expect(notes[i].degree).toBeGreaterThanOrEqual(notes[i - 1].degree); // the letters never go back
    }
    expect(notes.at(-1)!.offset).toBeLessThan(12);
  });

  it('matches the pitches `tonal` has for the same scale', () => {
    for (const [id, name] of Object.entries(TONAL_NAME) as Array<[ScaleId, string]>) {
      const chroma = ScaleType.get(name).chroma;
      const ours = Array.from({ length: 12 }, (_, i) => (parseFormula(getScale(id).formula).some((n) => n.offset === i) ? '1' : '0')).join('');
      expect(ours, id).toBe(chroma);
    }
  });

  it('writes Neapolitan minor as the minor scale with a flat second and a natural seventh', () => {
    expect(getScale('neapolitan-minor').formula).toBe('1 b2 b3 4 5 b6 7');
  });

  it('has no quarter tone in any scale but the Persian ones', () => {
    for (const scale of SCALES.filter((s) => s.category !== 'persian')) {
      expect(parseFormula(scale.formula).every((n) => Number.isInteger(n.offset)), scale.id).toBe(true);
    }
  });
});

describe('the Persian modes', () => {
  const persian = scalesOfCategory('persian');

  // The table awaiting the owner's review (docs/persian-scales-review.md). A correction changes this table on purpose.
  const TABLE: Record<string, { formula: string; defaultRoot: string }> = {
    shur: { formula: '1 k2 b3 4 5 b6 b7', defaultRoot: 'D' },
    mahur: { formula: '1 2 3 4 5 6 7', defaultRoot: 'C' },
    homayun: { formula: '1 k2 3 4 5 b6 b7', defaultRoot: 'D' },
    segah: { formula: '1 k2 k3 4 k5 k6 k7', defaultRoot: 'Ek' },
    chahargah: { formula: '1 k2 3 4 5 k6 7', defaultRoot: 'C' },
    nava: { formula: '1 2 b3 4 5 k6 b7', defaultRoot: 'G' },
    'rast-panjgah': { formula: '1 2 3 4 5 6 7', defaultRoot: 'F' },
    'abu-ata': { formula: '1 b2 b3 4 k5 b6 b7', defaultRoot: 'D' },
    'bayat-tork': { formula: '1 2 3 4 5 6 k7', defaultRoot: 'F' },
    afshari: { formula: '1 2 b3 4 5 k6 b7', defaultRoot: 'C' },
    dashti: { formula: '1 b2 b3 4 5 b6 b7', defaultRoot: 'D' },
    'bayat-esfahan': { formula: '1 2 b3 4 5 k6 7', defaultRoot: 'G' },
  };

  it('are twelve: seven dastgahs and five avazes', () => {
    expect(persian.filter((s) => s.persian?.family === 'dastgah').map((s) => s.id)).toEqual(['shur', 'mahur', 'homayun', 'segah', 'chahargah', 'nava', 'rast-panjgah']);
    expect(persian.filter((s) => s.persian?.family === 'avaz').map((s) => s.id)).toEqual(['abu-ata', 'bayat-tork', 'afshari', 'dashti', 'bayat-esfahan']);
  });

  it('have the pitches of the table', () => {
    expect(Object.fromEntries(persian.map((s) => [s.id, { formula: s.formula, defaultRoot: s.persian!.defaultRoot }]))).toEqual(TABLE);
  });

  it('start on a root that is a note, with or without a quarter tone', () => {
    for (const scale of persian) {
      const root = scale.persian!.defaultRoot;
      expect(parsePitch(`${root}4`), `${scale.id}: ${root}`).not.toBeNull();
    }
  });

  it('give every avaz the dastgah it belongs to', () => {
    const byId = (id: string) => getScale(id as ScaleId);
    expect(byId('abu-ata').persian?.parent).toBe('shur');
    expect(byId('bayat-tork').persian?.parent).toBe('shur');
    expect(byId('afshari').persian?.parent).toBe('shur');
    expect(byId('dashti').persian?.parent).toBe('shur');
    expect(byId('bayat-esfahan').persian?.parent).toBe('homayun');
    expect(persian.filter((s) => s.persian?.family === 'dastgah').every((s) => s.persian?.parent === undefined)).toBe(true);
  });

  it('are all marked as not yet reviewed, until the owner has checked them', () => {
    expect(persian.every((s) => s.persian?.reviewed === false)).toBe(true);
  });

});

describe('key signatures', () => {
  it('belong only to the scales that are modes of the major scale', () => {
    const modes = ['major', 'natural-minor', 'dorian', 'phrygian', 'lydian', 'mixolydian', 'locrian'];
    for (const scale of SCALES) expect(scale.keySignature, scale.id).toBe(modes.includes(scale.id));
  });

  it('are not used for the Persian modes, even Mahur, which has the notes of the major scale: their signs are written at the notes', () => {
    for (const scale of scalesOfCategory('persian')) expect(scale.keySignature, scale.id).toBe(false);
  });
});
