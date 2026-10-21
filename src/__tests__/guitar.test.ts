import { describe, expect, it } from 'vitest';
import { CHORD_DEFS, getChord, chordDegrees } from '../theory/chordCatalog';
import { guitarShapes, OPEN_STRINGS, shapeMidi, type GuitarShape } from '../theory/guitar';

const C = 0;
const F = 5;
const G = 7;
const A = 9;
const BB = 10;
const D = 2;

const fretsOf = (shapes: readonly GuitarShape[]): string[] => shapes.map((s) => s.frets.map((f) => (f < 0 ? 'x' : String(f))).join(','));
const find = (shapes: readonly GuitarShape[], frets: readonly number[]) => shapes.find((s) => s.frets.join(',') === frets.join(','));
const chordPcs = (root: number, id: string): Set<number> => new Set(chordDegrees(getChord(id)).map((d) => (root + d.semitones) % 12));

describe('guitarShapes', () => {
  it('tunes the strings to E A D G B E', () => {
    expect(OPEN_STRINGS).toEqual([40, 45, 50, 55, 59, 64]);
  });

  it('finds the open shapes every guitarist knows', () => {
    const c = guitarShapes(getChord('major'), C, { limit: 20 });
    expect(find(c, [-1, 3, 2, 0, 1, 0])?.kind).toBe('open');
    const g = guitarShapes(getChord('major'), G, { limit: 20 });
    expect(find(g, [3, 2, 0, 0, 0, 3])?.kind).toBe('open');
    const am = guitarShapes(getChord('minor'), A, { limit: 20 });
    expect(find(am, [-1, 0, 2, 2, 1, 0])?.kind).toBe('open');
    const d = guitarShapes(getChord('major'), D, { limit: 20 });
    expect(find(d, [-1, -1, 0, 2, 3, 2])?.kind).toBe('open');
  });

  it('finds the barre shapes and says where the barre lies', () => {
    const f = guitarShapes(getChord('major'), F, { limit: 20 });
    const e = find(f, [1, 3, 3, 2, 1, 1]);
    expect(e?.kind).toBe('barre');
    expect(e?.barre).toEqual({ fret: 1, from: 0, to: 5 });
    const bb = guitarShapes(getChord('major'), BB, { limit: 20 });
    const a = find(bb, [-1, 1, 3, 3, 3, 1]);
    expect(a?.kind).toBe('barre');
    expect(a?.barre).toEqual({ fret: 1, from: 1, to: 5 });
  });

  it('calls a shape without open strings and without a barre movable', () => {
    const shapes = guitarShapes(getChord('major'), C, { limit: 40 });
    const movable = shapes.filter((s) => s.kind === 'movable');
    for (const s of movable) {
      expect(s.barre).toBeNull();
      expect(s.frets.some((f) => f === 0)).toBe(false);
    }
  });

  it('only plays notes of the chord, with the root lowest, and keeps the hand inside four frets', () => {
    for (const [id, root] of [['major', C], ['minor', A], ['maj7', F], ['m7', D], ['dom7', G], ['sus4', C], ['dim', C], ['aug', C], ['power', A]] as const) {
      const def = getChord(id);
      const pcs = chordPcs(root, id);
      const shapes = guitarShapes(def, root, { limit: 12 });
      expect(shapes.length, `${id} on ${root}`).toBeGreaterThan(0);
      for (const shape of shapes) {
        const sounded = shapeMidi(shape).filter((m): m is number => m !== null);
        for (const midi of sounded) expect(pcs.has(midi % 12), `${id} ${shape.frets}`).toBe(true);
        expect(sounded[0] % 12, `${id} ${shape.frets}`).toBe(root);
        const fretted = shape.frets.filter((f) => f > 0);
        if (fretted.length > 0) expect(Math.max(...fretted) - Math.min(...fretted)).toBeLessThanOrEqual(3);
      }
    }
  });

  it('keeps every tone that defines the chord (a seventh chord keeps its seventh)', () => {
    const def = getChord('dom7');
    const shapes = guitarShapes(def, G, { limit: 12 });
    const seventh = (G + 10) % 12;
    const third = (G + 4) % 12;
    for (const shape of shapes) {
      const pcs = new Set(shapeMidi(shape).filter((m): m is number => m !== null).map((m) => m % 12));
      expect(pcs.has(seventh), `${shape.frets}`).toBe(true);
      expect(pcs.has(third), `${shape.frets}`).toBe(true);
    }
  });

  it('never mutes a string between two that sound', () => {
    for (const shape of guitarShapes(getChord('maj7'), C, { limit: 20 })) {
      const first = shape.frets.findIndex((f) => f >= 0);
      const last = shape.frets.length - 1 - [...shape.frets].reverse().findIndex((f) => f >= 0);
      expect(shape.frets.slice(first, last + 1).every((f) => f >= 0), `${shape.frets}`).toBe(true);
    }
  });

  it('puts the bass of a turned chord lowest: C over E', () => {
    const shapes = guitarShapes(getChord('major'), C, { bassPc: 4, limit: 20 });
    expect(shapes.length).toBeGreaterThan(0);
    for (const shape of shapes) {
      const lowest = shapeMidi(shape).find((m): m is number => m !== null)!;
      expect(lowest % 12).toBe(4);
    }
    expect(find(shapes, [0, 3, 2, 0, 1, 0])).toBeDefined();
  });

  it('lists the shapes from the nut up the neck, and stops at the limit', () => {
    const shapes = guitarShapes(getChord('minor'), C, { limit: 5 });
    expect(shapes.length).toBeLessThanOrEqual(5);
    const bases = shapes.map((s) => s.baseFret);
    expect([...bases].sort((a, b) => a - b)).toEqual(bases);
  });

  it('shows the nut for an open shape and starts the picture at the first fretted fret for a high one', () => {
    const shapes = guitarShapes(getChord('major'), C, { limit: 20 });
    expect(find(shapes, [-1, 3, 2, 0, 1, 0])?.baseFret).toBe(1);
    for (const s of shapes) if (s.kind !== 'open' && Math.min(...s.frets.filter((f) => f > 0)) > 4) expect(s.baseFret).toBe(Math.min(...s.frets.filter((f) => f > 0)));
  });

  it('has a shape for every chord of the catalog on C and on F sharp', () => {
    for (const def of CHORD_DEFS) {
      for (const root of [C, 6]) {
        expect(guitarShapes(def, root).length, `${def.id} on ${root}`).toBeGreaterThan(0);
      }
    }
  });

  it('lists each shape once', () => {
    const shapes = fretsOf(guitarShapes(getChord('major'), C, { limit: 50 }));
    expect(new Set(shapes).size).toBe(shapes.length);
  });

  it('turns a shape into the MIDI notes of the strings, null for a muted one', () => {
    const shape = find(guitarShapes(getChord('major'), C, { limit: 20 }), [-1, 3, 2, 0, 1, 0])!;
    expect(shapeMidi(shape)).toEqual([null, 48, 52, 55, 60, 64]);
  });
});
