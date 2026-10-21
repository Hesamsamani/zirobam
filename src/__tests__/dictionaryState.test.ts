import { describe, it, expect } from 'vitest';
import { DEFAULT_CHOICE, formatParam, parseParam, readChoice, rootChipPc, rootPcOf, rootToken, writeChoice, type Choice } from '../scales/dictionaryState';
import { ROOT_SPELLINGS } from '../theory/spell';
import { SCALES } from '../theory/scaleCatalog';

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return { data, getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => void data.set(key, value) };
}

describe('the default choice', () => {
  it('is the C major scale on the scales tab, with the note names under the notes', () => {
    expect(DEFAULT_CHOICE).toEqual({ tab: 'scales', root: 0, scale: 'major', category: 'major', labels: 'names', family: 'all', degree: null, primaryOnly: false });
  });
});

describe('readChoice and writeChoice', () => {
  const choice: Choice = { tab: 'chords', root: 'Ek', scale: 'segah', category: 'persian', labels: 'right', family: 'seventh', degree: 3, primaryOnly: true };

  it('keep a choice: what is written is read back', () => {
    const storage = memoryStorage();
    writeChoice(choice, storage);
    expect(readChoice(storage)).toEqual(choice);
  });

  it('start from the default when nothing is stored', () => {
    expect(readChoice(memoryStorage())).toEqual(DEFAULT_CHOICE);
  });

  it.each([
    ['text that is not JSON', 'nope'],
    ['null', 'null'],
    ['a number', '5'],
    ['a list', '[]'],
  ])('start from the default for %s', (_name, text) => {
    expect(readChoice(memoryStorage({ 'scales.v2': text }))).toEqual(DEFAULT_CHOICE);
  });

  it('replace a field that is wrong by its default, and keep the others', () => {
    const storage = memoryStorage({
      'scales.v2': JSON.stringify({ ...choice, tab: 'dance', root: 14, scale: 'nonsense', category: 5, labels: 'x', family: 'huge', degree: -2, primaryOnly: 'yes' }),
    });
    expect(readChoice(storage)).toEqual(DEFAULT_CHOICE);
    const partly = memoryStorage({ 'scales.v2': JSON.stringify({ ...choice, scale: 'nonsense' }) });
    expect(readChoice(partly)).toEqual({ ...choice, scale: 'major' });
  });

  it('accept the group of all scales', () => {
    expect(readChoice(memoryStorage({ 'scales.v2': JSON.stringify({ ...choice, category: 'all' }) })).category).toBe('all');
  });

  it('accept a root that is a name, and refuse one that is not a note name', () => {
    expect(readChoice(memoryStorage({ 'scales.v2': JSON.stringify({ ...choice, root: 'Db' }) })).root).toBe('Db');
    expect(readChoice(memoryStorage({ 'scales.v2': JSON.stringify({ ...choice, root: 'Db4' }) })).root).toBe(0);
    expect(readChoice(memoryStorage({ 'scales.v2': JSON.stringify({ ...choice, root: 'H' }) })).root).toBe(0);
    expect(readChoice(memoryStorage({ 'scales.v2': JSON.stringify({ ...choice, root: 7.5 }) })).root).toBe(0);
  });

  it('do not throw when the browser refuses', () => {
    const refusing = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('quota');
      },
    };
    expect(readChoice(refusing)).toEqual(DEFAULT_CHOICE);
    expect(() => writeChoice(choice, refusing)).not.toThrow();
  });

  describe('from the first version of the screen (scales.v1)', () => {
    const v1 = (data: object) => memoryStorage({ 'scales.v1': JSON.stringify(data) });

    it('take over the tab, the root and the labels, and name the old kind of scale as the new one', () => {
      const cases: Array<[string, string, string]> = [
        ['major', 'major', 'major'],
        ['minor', 'natural-minor', 'minor'],
        ['harmonic', 'harmonic-minor', 'minor'],
        ['melodic', 'melodic-minor', 'minor'],
        ['pentaMajor', 'pentatonic-major', 'pentatonic'],
        ['pentaMinor', 'pentatonic-minor', 'pentatonic'],
      ];
      for (const [old, id, category] of cases) {
        expect(readChoice(v1({ tab: 'chords', root: 7, scale: old, chord: 'minor', labels: 'left' })), old).toEqual({
          ...DEFAULT_CHOICE,
          tab: 'chords',
          root: 7,
          scale: id,
          category,
          labels: 'left',
        });
      }
    });

    it('are ignored once the new version has stored a choice', () => {
      const storage = memoryStorage({ 'scales.v1': JSON.stringify({ tab: 'chords', root: 7, scale: 'minor' }), 'scales.v2': JSON.stringify(DEFAULT_CHOICE) });
      expect(readChoice(storage)).toEqual(DEFAULT_CHOICE);
    });

    it('fall back to the default for a stored choice that makes no sense', () => {
      expect(readChoice(v1({ tab: 'x', root: 99, scale: 'weird', labels: 7 }))).toEqual(DEFAULT_CHOICE);
    });
  });
});

describe('rootPcOf', () => {
  it('is the note as one of twelve, or null for a quarter tone', () => {
    expect(rootPcOf(5)).toBe(5);
    expect(rootPcOf('C')).toBe(0);
    expect(rootPcOf('Db')).toBe(1);
    expect(rootPcOf('F#')).toBe(6);
    expect(rootPcOf('B#')).toBe(0);
    expect(rootPcOf('Cb')).toBe(11);
    expect(rootPcOf('Ek')).toBeNull();
    expect(rootPcOf('Co')).toBeNull();
  });
});

describe('rootChipPc', () => {
  it('is the chip that stands for the root: a quarter-tone root stands on the chip of its letter', () => {
    expect(rootChipPc(5)).toBe(5);
    expect(rootChipPc('Db')).toBe(1);
    expect(rootChipPc('Ek')).toBe(4);
    expect(rootChipPc('Co')).toBe(0);
    expect(rootChipPc('Dk')).toBe(2);
    expect(rootChipPc('Bk')).toBe(11);
  });
});

describe('the address of a scale', () => {
  it('writes the root and the scale: d-shur, eb-natural-minor, fs-dorian, ek-segah', () => {
    expect(formatParam('D', 'shur')).toBe('d-shur');
    expect(formatParam('Eb', 'natural-minor')).toBe('eb-natural-minor');
    expect(formatParam('F#', 'dorian')).toBe('fs-dorian');
    expect(formatParam('Ek', 'segah')).toBe('ek-segah');
    expect(formatParam('C', 'double-harmonic-major')).toBe('c-double-harmonic-major');
  });

  it('writes a token a route accepts: lower case letters, digits and hyphens only', () => {
    for (const root of ['C', 'C#', 'Db', 'F##', 'Bbb', 'Ek', 'Co', 'B']) {
      for (const scale of SCALES) expect(formatParam(root, scale.id), `${root} ${scale.id}`).toMatch(/^[a-z0-9-]+$/);
    }
  });

  it('is read back as the same root and scale, for every root and every scale', () => {
    const roots = [...Object.values(ROOT_SPELLINGS).flat(), 'Ek', 'Co', 'Dk', 'Fo'];
    for (const root of roots) {
      for (const scale of SCALES) expect(parseParam(formatParam(root, scale.id)), `${root} ${scale.id}`).toEqual({ root, scale: scale.id });
    }
  });

  it('reads the token of a root: s is a sharp, b a flat, k koron and o sori', () => {
    expect(rootToken('C#')).toBe('cs');
    expect(rootToken('F##')).toBe('fss');
    expect(rootToken('Bb')).toBe('bb');
    expect(rootToken('Bbb')).toBe('bbb');
    expect(rootToken('B')).toBe('b');
    expect(rootToken('Ek')).toBe('ek');
  });

  it('is nothing for an address that is not a root and a scale', () => {
    for (const bad of ['', 'shur', 'd', 'd-', '-shur', 'h-shur', 'd-nonsense', 'dd-shur', 'dsk-shur', 'D-shur', 'd shur', 'd-Shur']) {
      expect(parseParam(bad), bad).toBeNull();
    }
  });
});
