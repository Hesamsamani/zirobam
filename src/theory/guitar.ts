import { chordDegrees, type ChordDef } from './chordCatalog';

/** The open strings of a guitar in standard tuning, from the low E up: E2 A2 D3 G3 B3 E4, as MIDI numbers. */
export const OPEN_STRINGS: readonly number[] = [40, 45, 50, 55, 59, 64];

/** How far up the neck the shapes go, and how many frets the hand spans. */
const MAX_FRET = 15;
const SPAN = 4;
const MAX_FINGERS = 4;
/** The shapes kept for one place on the neck, so that the list shows the neck and not one position over and over. */
const PER_POSITION = 4;

export interface GuitarShape {
  /** One number per string, from the low E up: -1 muted, 0 open, or the fret. */
  frets: readonly number[];
  /** The fret the picture starts at: 1 shows the nut, a higher number is written beside the first row. */
  baseFret: number;
  /** `open` uses an open string, `barre` is held by one finger across the strings, `movable` is neither. */
  kind: 'open' | 'barre' | 'movable';
  /** The finger across the strings of a barre shape: the fret and the first and last string it covers (0 is the low E). */
  barre: { fret: number; from: number; to: number } | null;
}

export interface GuitarOptions {
  /** The pitch class (0 to 11) that must sound lowest: the root unless the chord is turned (C over E). */
  bassPc?: number;
  /** How many shapes to give: 8 when left out. */
  limit?: number;
}

interface Tone {
  pc: number;
  /** A tone that can be left out when the strings run short: the fifth of a chord with four notes or more, the ninth of one with five or more. */
  omittable: boolean;
}

function tonesOf(def: ChordDef, rootPc: number): Tone[] {
  const count = def.formula.length;
  return chordDegrees(def).map((degree, i) => {
    const name = def.formula[i];
    const omittable = (name === '5P' && count >= 4) || (name === '9M' && count >= 5);
    return { pc: (((rootPc + degree.semitones) % 12) + 12) % 12, omittable };
  });
}

/** The finger across the strings, when the lowest fretted fret is held on two strings or more with nothing open or muted between. */
function barreOf(frets: readonly number[]): GuitarShape['barre'] {
  const fretted = frets.filter((f) => f > 0);
  if (fretted.length < 2) return null;
  const fret = Math.min(...fretted);
  const on = frets.map((f, i) => (f === fret ? i : -1)).filter((i) => i >= 0);
  if (on.length < 2) return null;
  const from = on[0];
  const to = on[on.length - 1];
  for (let i = from; i <= to; i++) if (frets[i] < fret) return null;
  return { fret, from, to };
}

function fingersNeeded(frets: readonly number[], barre: GuitarShape['barre']): number {
  if (!barre) return frets.filter((f) => f > 0).length;
  const above = frets.filter((f, i) => f > barre.fret || (f === barre.fret && (i < barre.from || i > barre.to))).length;
  return 1 + above;
}

/**
 * The shapes of a chord on a guitar in standard tuning: a search over every place the hand can lie on the first fifteen frets.
 * A shape sounds only notes of the chord, has the root (or the bass of a turned chord) lowest, mutes strings only at the outer
 * edges, keeps the fretted notes inside four frets and needs no more than four fingers. A chord of five or six notes may
 * leave out its fifth and ninth. They are given from the nut up the neck.
 */
export function guitarShapes(def: ChordDef, rootPc: number, options: GuitarOptions = {}): GuitarShape[] {
  const limit = options.limit ?? 8;
  const tones = tonesOf(def, rootPc);
  const pcs = new Set(tones.map((tone) => tone.pc));
  const required = tones.filter((tone) => !tone.omittable).map((tone) => tone.pc);
  const bassPc = options.bassPc ?? (((rootPc % 12) + 12) % 12);
  const minSounded = tones.length === 2 ? 2 : 3;

  const found = new Map<string, { shape: GuitarShape; score: number }>();

  for (let base = 1; base <= MAX_FRET - SPAN + 1; base++) {
    // what each string may do in this position: muted, open (only near the nut), or a fret of the chord inside the window
    const choices = OPEN_STRINGS.map((open) => {
      const list = [-1];
      if (base === 1 && pcs.has(open % 12)) list.push(0);
      for (let fret = base; fret < base + SPAN; fret++) if (pcs.has((open + fret) % 12)) list.push(fret);
      return list;
    });

    const frets: number[] = [];
    // phase 0: muted strings at the low edge, 1: sounding, 2: muted strings at the high edge
    const walk = (string: number, phase: 0 | 1 | 2): void => {
      if (string === OPEN_STRINGS.length) {
        consider(frets, base);
        return;
      }
      for (const fret of choices[string]) {
        let next: 0 | 1 | 2;
        if (fret < 0) next = phase === 0 ? 0 : 2;
        else if (phase === 2) continue;
        else next = 1;
        frets.push(fret);
        walk(string + 1, next);
        frets.pop();
      }
    };

    const consider = (shapeFrets: readonly number[], position: number): void => {
      const sounded = shapeFrets.map((f, i) => (f < 0 ? null : OPEN_STRINGS[i] + f));
      const notes = sounded.filter((m): m is number => m !== null);
      if (notes.length < minSounded) return;
      if (notes[0] % 12 !== bassPc) return;
      const present = new Set(notes.map((m) => m % 12));
      if (!required.every((pc) => present.has(pc))) return;
      const fretted = shapeFrets.filter((f) => f > 0);
      // in a high position the lowest fretted fret decides the window, so that a shape is found once
      if (position > 1 && Math.min(...fretted) !== position) return;
      const barre = barreOf(shapeFrets);
      if (fingersNeeded(shapeFrets, barre) > MAX_FINGERS) return;

      const open = shapeFrets.some((f) => f === 0);
      const maxFret = fretted.length > 0 ? Math.max(...fretted) : 0;
      const span = fretted.length > 0 ? maxFret - Math.min(...fretted) : 0;
      const omitted = tones.filter((tone) => !present.has(tone.pc)).length;
      const score = (6 - notes.length) * 1.2 + omitted * 2 + span * 0.4 + position * 0.08 - (open ? 0.6 : 0);
      const key = shapeFrets.join(',');
      if (found.has(key)) return;
      found.set(key, {
        score,
        shape: {
          frets: [...shapeFrets],
          baseFret: maxFret <= SPAN ? 1 : Math.min(...fretted),
          kind: open ? 'open' : barre ? 'barre' : 'movable',
          barre: open ? null : barre,
        },
      });
    };

    walk(0, 0);
  }

  // the best few of each place on the neck, then the best of those, shown from the nut up
  const byPosition = new Map<number, { shape: GuitarShape; score: number }[]>();
  for (const entry of [...found.values()].sort((a, b) => a.score - b.score)) {
    const list = byPosition.get(entry.shape.baseFret) ?? [];
    if (list.length < PER_POSITION) list.push(entry);
    byPosition.set(entry.shape.baseFret, list);
  }
  return [...byPosition.values()]
    .flat()
    .sort((a, b) => a.score - b.score)
    .slice(0, limit)
    .sort((a, b) => a.shape.baseFret - b.shape.baseFret || a.score - b.score)
    .map((entry) => entry.shape);
}

/** The MIDI note each string sounds in a shape, null for a muted string. */
export function shapeMidi(shape: GuitarShape): (number | null)[] {
  return shape.frets.map((fret, i) => (fret < 0 ? null : OPEN_STRINGS[i] + fret));
}
