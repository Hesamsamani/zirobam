import { SCALES, parseFormula, type ScaleId } from './scaleCatalog';

export interface ScaleMatch {
  /** The root as one of the twelve notes (0 is C). */
  root: number;
  scale: ScaleId;
  /** How many notes the scale has. */
  size: number;
  /** How many of its notes were not asked for. */
  extra: number;
  /** The scale has exactly the notes asked for. */
  exact: boolean;
}

/** The notes of each scale as semitones above its root, left out when one is a quarter tone: those cannot be asked for on a piano. */
const SHAPES: ReadonlyArray<{ id: ScaleId; offsets: number[] }> = SCALES.flatMap((def) => {
  const offsets = parseFormula(def.formula).map((note) => note.offset);
  return offsets.every(Number.isInteger) ? [{ id: def.id, offsets }] : [];
});

/** Scales of the same fit are shown in this order: the ones a student meets first come first. */
const PRIORITY: readonly ScaleId[] = SCALES.map((def) => def.id);

/**
 * The scales that contain every one of the notes (0 to 11), on every root. The ones with fewest notes that were not
 * asked for come first, and among those the scales of the catalog in its own order. `limit` cuts the list.
 */
export function findScales(notes: readonly number[], limit = 40): ScaleMatch[] {
  const wanted = new Set(notes.map((n) => ((Math.round(n) % 12) + 12) % 12));
  if (wanted.size === 0) return [];
  const found: ScaleMatch[] = [];
  for (const shape of SHAPES) {
    for (let root = 0; root < 12; root++) {
      const held = new Set(shape.offsets.map((offset) => (root + offset) % 12));
      if (![...wanted].every((n) => held.has(n))) continue;
      const extra = held.size - wanted.size;
      found.push({ root, scale: shape.id, size: held.size, extra, exact: extra === 0 });
    }
  }
  found.sort((a, z) => a.extra - z.extra || PRIORITY.indexOf(a.scale) - PRIORITY.indexOf(z.scale) || a.root - z.root);
  return found.slice(0, limit);
}
