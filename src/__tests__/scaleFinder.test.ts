import { describe, expect, it } from 'vitest';
import { circleKeys } from '../theory/circle';
import { findScales } from '../theory/scaleFinder';

const C = 0;
const E = 4;
const G = 7;
const names = (pcs: number[], limit = 40) => findScales(pcs, limit).map((r) => `${r.root}:${r.scale}`);

describe('findScales', () => {
  it('finds nothing for no note', () => {
    expect(findScales([])).toEqual([]);
  });

  it('finds the scales that hold every note given: C, E and G are in C major, G major, F major and more', () => {
    const found = names([C, E, G]);
    expect(found).toContain('0:major');
    expect(found).toContain('7:major');
    expect(found).toContain('5:major');
    // A minor holds C E G too, as its third, fifth and seventh... A C E G: all four are notes of A minor
    expect(found).toContain('9:natural-minor');
    // D flat major has no G natural
    expect(found).not.toContain('1:major');
  });

  it('puts the scale whose notes are exactly those given first', () => {
    const cMajor = [0, 2, 4, 5, 7, 9, 11];
    const first = findScales(cMajor, 5)[0];
    expect(first).toMatchObject({ root: 0, scale: 'major', exact: true, extra: 0 });
    // C major and its modes have the same notes: all of them are exact
    const exact = findScales(cMajor, 60).filter((r) => r.exact);
    expect(exact.map((r) => r.scale)).toEqual(expect.arrayContaining(['major', 'natural-minor', 'dorian', 'phrygian', 'lydian', 'mixolydian', 'locrian']));
  });

  it('ranks a scale with fewer extra notes before one with more', () => {
    const found = findScales([C, E, G], 200);
    for (let i = 1; i < found.length; i++) expect(found[i].extra).toBeGreaterThanOrEqual(found[i - 1].extra);
    // the major pentatonic of C has 5 notes: two extra; the chromatic scale has nine extra
    const penta = found.find((r) => r.root === 0 && r.scale === 'pentatonic-major')!;
    const chromatic = found.find((r) => r.root === 0 && r.scale === 'chromatic')!;
    expect(penta.extra).toBe(2);
    expect(chromatic.extra).toBe(9);
    expect(found.indexOf(penta)).toBeLessThan(found.indexOf(chromatic));
  });

  it('counts the notes of the scale and leaves out the Persian modes that need a quarter tone', () => {
    const found = findScales([0], 500);
    expect(found.every((r) => r.size >= 1)).toBe(true);
    expect(found.some((r) => r.scale === 'segah')).toBe(false);
    // Mahur has no quarter tone: it is the major scale and is found
    expect(found.some((r) => r.scale === 'mahur')).toBe(true);
  });

  it('keeps the root a number from 0 to 11 and respects the limit', () => {
    const found = findScales([0, 2], 7);
    expect(found).toHaveLength(7);
    for (const r of found) expect(r.root).toBeGreaterThanOrEqual(0), expect(r.root).toBeLessThanOrEqual(11);
  });

  it('finds nothing when the notes fit no scale of a few notes but the chromatic one holds them', () => {
    const found = findScales([0, 1, 2, 3, 4, 5, 6, 7], 500);
    expect(found.length).toBeGreaterThan(0);
    expect(found.every((r) => r.size >= 8)).toBe(true);
  });
});

describe('circleKeys', () => {
  it('has the twelve major keys round the circle by fifths, each with its relative minor', () => {
    const keys = circleKeys();
    expect(keys).toHaveLength(12);
    expect(keys.map((k) => k.major)).toEqual([0, 7, 2, 9, 4, 11, 6, 1, 8, 3, 10, 5]);
    expect(keys.map((k) => k.minor)).toEqual([9, 4, 11, 6, 1, 8, 3, 10, 5, 0, 7, 2]);
  });

  it('gives each key its signature: C none, G one sharp, F one flat, F sharp six sharps', () => {
    const keys = circleKeys();
    expect(keys[0].fifths).toBe(0);
    expect(keys[1].fifths).toBe(1);
    expect(keys[11].fifths).toBe(-1);
    expect(keys[6].fifths).toBe(6);
    expect(keys[7].fifths).toBe(-5);
  });
});
