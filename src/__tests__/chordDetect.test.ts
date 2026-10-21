import { describe, expect, it } from 'vitest';
import { detectChord } from '../chords/chordDetect';
import { HeldNotes } from '../chords/heldNotes';

const read = (...midis: number[]) => detectChord(midis);
const symbol = (...midis: number[]) => detectChord(midis)?.symbol ?? null;

describe('detectChord', () => {
  it('names a triad in root position', () => {
    expect(symbol(60, 64, 67)).toBe('C');
    expect(symbol(57, 60, 64)).toBe('Am');
    expect(symbol(62, 65, 68)).toBe('Ddim');
    expect(symbol(60, 64, 68)).toBe('Caug');
  });

  it('names a triad in a turn by its bass: E G C is C over E', () => {
    const turned = read(64, 67, 72)!;
    expect(turned.symbol).toBe('C/E');
    expect(turned.inversion).toBe(1);
    expect(symbol(67, 72, 76)).toBe('C/G');
  });

  it('names sevenths, sixths and extended chords', () => {
    expect(symbol(60, 64, 67, 71)).toBe('Cmaj7');
    expect(symbol(60, 64, 67, 70)).toBe('C7');
    expect(symbol(60, 63, 67, 70)).toBe('Cm7');
    expect(symbol(59, 62, 65, 69)).toBe('Bm7b5');
    expect(symbol(60, 64, 67, 71, 74)).toBe('Cmaj9');
  });

  it('reads the same pitches as the chord whose root is the lowest note: A C E G is Am7, with C lowest it is C6 over A', () => {
    expect(symbol(57, 60, 64, 67)).toBe('Am7');
    expect(symbol(48, 52, 55, 57)).toBe('C6');
    expect(symbol(60, 64, 67, 69)).toBe('C6');
  });

  it('does not mind the octave or a doubled note', () => {
    expect(symbol(48, 60, 64, 67, 72)).toBe('C');
    expect(symbol(36, 55, 64)).toBe('C');
  });

  it('spells the root with the fewest signs: D flat, not C sharp, and F sharp minor', () => {
    expect(symbol(61, 65, 68)).toBe('Db');
    expect(symbol(66, 69, 73)).toBe('F#m');
    expect(symbol(58, 62, 65)).toBe('Bb');
  });

  it('names two notes a fifth apart as a power chord', () => {
    expect(symbol(60, 67)).toBe('C5');
    expect(symbol(62, 69)).toBe('D5');
  });

  it('has no name for one note, two notes that are no fifth, or a cluster', () => {
    expect(symbol(60)).toBeNull();
    expect(symbol(60, 64)).toBeNull();
    expect(symbol(60, 61, 62)).toBeNull();
    expect(symbol()).toBeNull();
  });

  it('gives the notes of the chord, the root and the kind', () => {
    const c = read(55, 59, 62)!;
    expect(c).toMatchObject({ root: 'G', rootPc: 7, bass: null, inversion: 0 });
    expect(c.def.id).toBe('major');
    expect(c.notes).toEqual(['G', 'B', 'D']);
  });
});

describe('HeldNotes', () => {
  function setup() {
    let now = 0;
    const held = new HeldNotes(() => now, 80);
    return { held, advance: (ms: number) => (now += ms) };
  }

  it('holds the keys that are down, lowest first', () => {
    const { held } = setup();
    held.press(67);
    held.press(60);
    held.press(64);
    expect(held.down()).toEqual([60, 64, 67]);
    held.release(64);
    expect(held.down()).toEqual([60, 67]);
  });

  it('only calls the notes settled when they have not changed for the settling time', () => {
    const { held, advance } = setup();
    held.press(60);
    advance(30);
    held.press(64);
    advance(30);
    held.press(67);
    expect(held.settled()).toBeNull();
    advance(79);
    expect(held.settled()).toBeNull();
    advance(1);
    expect(held.settled()).toEqual([60, 64, 67]);
  });

  it('starts counting again when a key comes or goes', () => {
    const { held, advance } = setup();
    held.press(60);
    held.press(64);
    advance(100);
    expect(held.settled()).toEqual([60, 64]);
    held.press(67);
    expect(held.settled()).toBeNull();
    advance(80);
    expect(held.settled()).toEqual([60, 64, 67]);
  });

  it('has nothing settled when no key is down, and clears', () => {
    const { held, advance } = setup();
    advance(500);
    expect(held.settled()).toBeNull();
    held.press(60);
    held.clear();
    advance(500);
    expect(held.settled()).toBeNull();
    expect(held.down()).toEqual([]);
  });

  it('counts a key pressed twice as one, and a release of a key that was never down as nothing', () => {
    const { held } = setup();
    held.press(60);
    held.press(60);
    held.release(99);
    expect(held.down()).toEqual([60]);
  });
});
