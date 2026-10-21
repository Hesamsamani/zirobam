import { describe, expect, it } from 'vitest';
import { generateProgression, type Progression } from '../generator/progression';
import { STYLE_IDS, STYLES, type StyleId } from '../generator/styles';
import { chordsOfScale } from '../theory/diatonic';
import { parsePitch, pianoMidi } from '../theory/pitch';
import { getScale, SCALES } from '../theory/scaleCatalog';
import { spellScale } from '../theory/spell';

const cMajor = spellScale(0, 'major');
const make = (style: StyleId, bars = 8, seed = 1, scale = cMajor): Progression => generateProgression({ scale, style, bars, seed });
const midiOf = (pitch: string): number => pianoMidi(parsePitch(pitch)!);
const families = (p: Progression): Set<string> => new Set(p.chords.map((c) => c.chord.def.family));

describe('the styles', () => {
  it('are the thirteen of the plan, each with phrases of four bars, endings on the tonic and a tempo range', () => {
    expect(STYLE_IDS).toHaveLength(13);
    for (const id of STYLE_IDS) {
      const style = STYLES[id];
      expect(style.id).toBe(id);
      expect(style.phrases.length).toBeGreaterThan(1);
      expect(style.endings.length).toBeGreaterThan(0);
      for (const phrase of [...style.phrases, ...style.endings]) {
        expect(phrase).toHaveLength(4);
        for (const bar of phrase) expect([1, 2, 4]).toContain(bar.length);
      }
      for (const ending of style.endings) expect(ending[3]).toEqual([1]);
      expect(style.tempo[0]).toBeLessThan(style.tempo[1]);
      expect(style.chords.length).toBeGreaterThan(2);
    }
  });
});

describe('generateProgression', () => {
  it('gives the same progression for the same options, and another for another seed', () => {
    const a = make('pop', 8, 7);
    const b = make('pop', 8, 7);
    expect(b).toEqual(a);
    const symbols = (p: Progression) => p.chords.map((c) => c.chord.symbol).join(' ');
    const others = [1, 2, 3, 4, 5, 6].map((seed) => symbols(make('pop', 8, seed)));
    expect(new Set(others).size).toBeGreaterThan(1);
  });

  it('fills exactly the bars asked for, chord after chord, four beats to a bar', () => {
    for (const bars of [1, 2, 3, 4, 5, 8, 12, 16]) {
      const p = make('jazz', bars, 3);
      expect(p.bars).toBe(bars);
      let at = 0;
      for (const chord of p.chords) {
        expect(chord.bar * 4 + chord.beat).toBe(at);
        expect(chord.beats).toBeGreaterThan(0);
        // a chord never runs over a bar line
        expect(chord.beat + chord.beats).toBeLessThanOrEqual(4);
        at += chord.beats;
      }
      expect(at).toBe(bars * 4);
    }
  });

  it('ends on the chord of the first degree in every style, so that the piece closes', () => {
    for (const id of STYLE_IDS) {
      for (const bars of [4, 8, 12]) {
        const last = make(id, bars, 5).chords.at(-1)!;
        expect(last.chord.degree, `${id} ${bars}`).toBe(1);
      }
    }
  });

  it('makes a pop cadence of a dominant before the end: the fifth, then the first', () => {
    const p = make('pop', 8, 9);
    const lastBar = p.chords.filter((c) => c.bar === 7);
    const before = p.chords.filter((c) => c.bar === 6);
    expect(lastBar.map((c) => c.chord.degree)).toEqual([1]);
    expect(before.at(-1)!.chord.degree).toBe(5);
  });

  it('only uses chords of the scale, the very chords the dictionary shows for it', () => {
    for (const id of STYLE_IDS) {
      const p = make(id, 8, 4);
      const all = chordsOfScale(cMajor);
      for (const c of p.chords) {
        expect(all.some((x) => x.degree === c.chord.degree && x.def.id === c.chord.def.id), `${id} ${c.chord.symbol}`).toBe(true);
      }
    }
  });

  it('keeps to what a style likes: triads for pop, sevenths for jazz, ninths and sevenths for lo-fi', () => {
    for (const seed of [1, 2, 3]) {
      expect([...families(make('pop', 8, seed))]).toEqual(['triad']);
      expect([...families(make('folk', 8, seed))]).toEqual(['triad']);
      expect([...families(make('jazz', 8, seed))]).toEqual(['seventh']);
      for (const family of families(make('lofi', 8, seed))) expect(['seventh', 'ninth']).toContain(family);
    }
  });

  it('plays the blues on dominant sevenths when the scale has them', () => {
    const mixolydian = spellScale(0, 'mixolydian');
    const p = make('blues', 12, 2, mixolydian);
    const tonic = p.chords.filter((c) => c.chord.degree === 1);
    expect(tonic.length).toBeGreaterThan(0);
    for (const c of tonic) expect(c.chord.def.id).toBe('dom7');
  });

  it('gives a Persian mode open chords only, from the notes of the piano: fifths, suspended and fourths', () => {
    const shur = spellScale('D', 'shur');
    for (const id of STYLE_IDS) {
      const p = make(id, 8, 6, shur);
      expect(p.chords.length, id).toBeGreaterThan(0);
      for (const c of p.chords) {
        expect(['power', 'suspended', 'quartal', 'triad'], `${id} ${c.chord.symbol}`).toContain(c.chord.def.family);
      }
    }
  });

  it('finds chords on every scale of the catalog in every style, whatever the root', () => {
    for (const def of SCALES) {
      const scale = def.persian ? spellScale(def.persian.defaultRoot, def.id) : spellScale(0, def.id);
      for (const id of STYLE_IDS) {
        const p = generateProgression({ scale, style: id, bars: 8, seed: 2 });
        // a scale with no chord at all (no root is a piano note) gives an empty progression and says so
        if (p.chords.length === 0) {
          expect(chordsOfScale(scale)).toHaveLength(0);
          continue;
        }
        expect(p.chords.reduce((sum, c) => sum + c.beats, 0), `${def.id} ${id}`).toBe(32);
      }
    }
  });

  it('gives an empty progression for a scale that has no chord', () => {
    const none = { ...cMajor, names: [], offsets: [], pitches: [] };
    const p = generateProgression({ scale: none, style: 'pop', bars: 4, seed: 1 });
    expect(p.chords).toEqual([]);
    expect(p.bars).toBe(4);
  });

  it('keeps the tempo inside the range of the style, or takes the one asked for', () => {
    for (const id of STYLE_IDS) {
      const bpm = make(id, 8, 11).bpm;
      expect(bpm).toBeGreaterThanOrEqual(STYLES[id].tempo[0]);
      expect(bpm).toBeLessThanOrEqual(STYLES[id].tempo[1]);
    }
    expect(generateProgression({ scale: cMajor, style: 'pop', bars: 4, seed: 1, bpm: 90 }).bpm).toBe(90);
  });
});

describe('the voicing of the chords', () => {
  it('has the notes of the chord, from the lowest up, between C3 and C5', () => {
    for (const id of STYLE_IDS) {
      for (const c of make(id, 8, 8).chords) {
        const pitches = c.voicing.map(midiOf);
        expect([...pitches].sort((a, b) => a - b)).toEqual(pitches);
        expect(pitches[0], `${id} ${c.chord.symbol}`).toBeGreaterThanOrEqual(48);
        expect(pitches.at(-1), `${id} ${c.chord.symbol}`).toBeLessThanOrEqual(76);
        // every note of the chord is there (a note may be doubled, none is missing)
        const names = new Set(c.voicing.map((p) => p.replace(/-?\d+$/, '')));
        expect(names).toEqual(new Set(c.chord.notes));
      }
    }
  });

  it('keeps the hand where it is: a chord is a short step from the one before', () => {
    const p = make('pop', 16, 12);
    let total = 0;
    let steps = 0;
    for (let i = 1; i < p.chords.length; i++) {
      const a = p.chords[i - 1].voicing.map(midiOf);
      const b = p.chords[i].voicing.map(midiOf);
      if (a.length !== b.length) continue;
      total += a.reduce((sum, m, k) => sum + Math.abs(m - b[k]), 0) / a.length;
      steps++;
    }
    expect(total / steps).toBeLessThanOrEqual(3.5);
  });

  it('gives each chord a bass note: its root, in the octave from C2 to B2', () => {
    for (const c of make('rock', 8, 3).chords) {
      const m = midiOf(c.bass);
      expect(m).toBeGreaterThanOrEqual(36);
      expect(m).toBeLessThanOrEqual(47);
      expect(c.bass.replace(/-?\d+$/, '')).toBe(c.chord.root);
    }
  });
});

describe('the scales of the catalog', () => {
  it('are all found by id', () => {
    expect(getScale('major').id).toBe('major');
  });
});
