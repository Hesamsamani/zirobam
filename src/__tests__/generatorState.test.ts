import { describe, expect, it } from 'vitest';
import { DEFAULT_STATE, queryOf, readSettings, stateFromQuery, writeSettings, type GeneratorState } from '../generator/generatorState';

function memory(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
  };
}

const state = (overrides: Partial<GeneratorState> = {}): GeneratorState => ({ ...DEFAULT_STATE, ...overrides });

describe('DEFAULT_STATE', () => {
  it('is a pop progression of eight bars in C major', () => {
    expect(DEFAULT_STATE).toMatchObject({ tab: 'prog', root: 0, scale: 'major', style: 'pop', bars: 8, bpm: null, meter: '4/4', over: 'scale' });
  });
});

describe('queryOf', () => {
  it('writes the scale as in the dictionary, the style, the bars and the seed', () => {
    expect(queryOf(state({ root: 2, scale: 'dorian', style: 'jazz', bars: 12, seed: 123 }))).toBe('t=prog&s=d-dorian&style=jazz&bars=12&seed=123');
  });

  it('spells a root of the twelve notes the way the dictionary does, and keeps one written as it is', () => {
    expect(queryOf(state({ root: 1, seed: 5 }))).toContain('s=db-major');
    expect(queryOf(state({ root: 'Ek', scale: 'segah', seed: 5 }))).toContain('s=ek-segah');
  });

  it('adds the tempo when one was chosen', () => {
    expect(queryOf(state({ bpm: 96, seed: 5 }))).toContain('&bpm=96');
    expect(queryOf(state({ bpm: null, seed: 5 }))).not.toContain('bpm');
  });

  it('adds what only the melody uses when the melody is open', () => {
    const q = queryOf(state({ tab: 'melody', seed: 9, meter: '6/8', density: 'dense', feel: 'dotted', contour: 'wave', range: 'wide', octave: 5, over: 'scale' }));
    expect(q).toBe('t=melody&s=c-major&style=pop&bars=8&seed=9&meter=68&density=dense&feel=dotted&contour=wave&range=wide&oct=5&over=scale');
    expect(queryOf(state({ tab: 'prog', seed: 9, meter: '6/8' }))).not.toContain('meter');
  });
});

describe('stateFromQuery', () => {
  it('reads back what queryOf wrote, for every tab', () => {
    const cases: GeneratorState[] = [
      state({ seed: 77 }),
      state({ root: 'Db', scale: 'lydian', style: 'bossa', bars: 16, bpm: 104, seed: 4321 }),
      state({ tab: 'melody', root: 'Ek', scale: 'segah', style: 'cinematic', bars: 4, seed: 8, meter: '3/4', density: 'sparse', feel: 'syncopated', contour: 'falling', range: 'narrow', octave: 3, over: 'scale' }),
      state({ tab: 'melody', root: 'F#', scale: 'blues', style: 'blues', seed: 12, over: 'progression' }),
    ];
    for (const original of cases) {
      const read = stateFromQuery(queryOf(original), DEFAULT_STATE);
      // a root of the twelve notes comes back as the name it was written with
      expect({ ...read, root: undefined, category: undefined }).toEqual({ ...original, root: undefined, category: undefined });
      expect(read.scale).toBe(original.scale);
    }
  });

  it('takes the root as written, and chooses the group of the scale for the list', () => {
    const read = stateFromQuery('s=d-shur&seed=3', DEFAULT_STATE);
    expect(read.root).toBe('D');
    expect(read.scale).toBe('shur');
    expect(read.category).toBe('persian');
  });

  it('keeps what the address does not say', () => {
    const read = stateFromQuery('seed=5', state({ style: 'jazz', bars: 12, tab: 'melody', density: 'dense' }));
    expect(read).toMatchObject({ style: 'jazz', bars: 12, tab: 'melody', density: 'dense', seed: 5 });
  });

  it('ignores a value that is not one of the choices, and a scale that does not exist', () => {
    const base = state({ style: 'rock', bars: 8, scale: 'dorian', root: 5 });
    const read = stateFromQuery('t=nonsense&s=h-nothing&style=disco&bars=7&seed=-4&bpm=9000&meter=99&density=x&feel=y&contour=z&range=q&oct=9&over=w', base);
    expect(read).toEqual({ ...base, seed: base.seed });
  });

  it('refuses a tempo outside 40 to 220, a seed that is not a whole number of 1 to 999999, and bars that are not offered', () => {
    expect(stateFromQuery('bpm=39', DEFAULT_STATE).bpm).toBeNull();
    expect(stateFromQuery('bpm=221', DEFAULT_STATE).bpm).toBeNull();
    expect(stateFromQuery('bpm=40', DEFAULT_STATE).bpm).toBe(40);
    expect(stateFromQuery('bpm=96.5', DEFAULT_STATE).bpm).toBeNull();
    expect(stateFromQuery('seed=0', DEFAULT_STATE).seed).toBe(DEFAULT_STATE.seed);
    expect(stateFromQuery('seed=1000000', DEFAULT_STATE).seed).toBe(DEFAULT_STATE.seed);
    expect(stateFromQuery('seed=12abc', DEFAULT_STATE).seed).toBe(DEFAULT_STATE.seed);
    expect(stateFromQuery('bars=6', DEFAULT_STATE).bars).toBe(DEFAULT_STATE.bars);
    expect(stateFromQuery('bars=16', DEFAULT_STATE).bars).toBe(16);
  });

  it('puts a melody over a progression only in 4/4: anything else is over the scale', () => {
    expect(stateFromQuery('t=melody&meter=34&over=progression', DEFAULT_STATE)).toMatchObject({ meter: '3/4', over: 'scale' });
    expect(stateFromQuery('t=melody&meter=44&over=progression', DEFAULT_STATE)).toMatchObject({ meter: '4/4', over: 'progression' });
  });

  it('takes an empty query, a leading question mark and a hash for what they are', () => {
    expect(stateFromQuery('', DEFAULT_STATE)).toEqual(DEFAULT_STATE);
    expect(stateFromQuery('?style=jazz', DEFAULT_STATE).style).toBe('jazz');
  });
});

describe('the settings kept between visits', () => {
  it('are written and read back, without the seed', () => {
    const store = memory();
    writeSettings(state({ tab: 'melody', root: 'Bb', scale: 'dorian', style: 'funk', bars: 16, bpm: 100, seed: 555, density: 'dense' }), store);
    const read = readSettings(store);
    expect(read).toMatchObject({ tab: 'melody', root: 'Bb', scale: 'dorian', style: 'funk', bars: 16, bpm: 100, density: 'dense' });
    expect('seed' in read).toBe(false);
  });

  it('are the defaults when nothing was kept, or what was kept is damaged', () => {
    expect(readSettings(memory())).toMatchObject({ style: 'pop', bars: 8, scale: 'major' });
    expect(readSettings(memory({ 'generator.v1': 'not json' }))).toMatchObject({ style: 'pop' });
    expect(readSettings(memory({ 'generator.v1': '[1,2]' }))).toMatchObject({ style: 'pop' });
    expect(readSettings(memory({ 'generator.v1': JSON.stringify({ style: 'disco', bars: 3, scale: 'x', root: [1] }) }))).toMatchObject({ style: 'pop', bars: 8, scale: 'major', root: 0 });
  });

  it('do not throw when the storage does', () => {
    const broken = {
      getItem: () => {
        throw new Error('no');
      },
      setItem: () => {
        throw new Error('no');
      },
    };
    expect(() => writeSettings(DEFAULT_STATE, broken)).not.toThrow();
    expect(readSettings(broken)).toMatchObject({ style: 'pop' });
  });
});
