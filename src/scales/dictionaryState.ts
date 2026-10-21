import { storageGet, storageSet } from '../core/safeStorage';
import { CHORD_FAMILIES, type ChordFamily } from '../theory/chordCatalog';
import { STEP_SEMITONES, parseNoteName, type Alter } from '../theory/pitch';
import { SCALE_CATEGORIES, SCALE_IDS, getScale, type ScaleCategory, type ScaleId } from '../theory/scaleCatalog';
import { spellScale, type SpelledScale } from '../theory/spell';

export type Tab = 'scales' | 'chords';
export type Labels = 'names' | 'right' | 'left';
/** A group of scales, or all of them. */
export type CategoryChoice = ScaleCategory | 'all';
const CATEGORY_CHOICES: readonly CategoryChoice[] = ['all', ...SCALE_CATEGORIES];

/** What the dictionary screen shows, and what is kept between visits. */
export interface Choice {
  tab: Tab;
  /** One of the twelve notes (0 is C), which is written with the fewest signs, or a name that is used as written (`Db`, `Ek`). */
  root: number | string;
  scale: ScaleId;
  /** The group of scales whose names are listed; the scale itself may be from another group until a new one is picked. */
  category: CategoryChoice;
  labels: Labels;
  family: ChordFamily | 'all';
  /** Only the chords on this degree of the scale. */
  degree: number | null;
  primaryOnly: boolean;
}

export const DEFAULT_CHOICE: Choice = { tab: 'scales', root: 0, scale: 'major', category: 'major', labels: 'names', family: 'all', degree: null, primaryOnly: false };

/** The part of the browser storage the screen uses; it never throws (see `core/safeStorage`). */
export interface ChoiceStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const browserStorage: ChoiceStorage = { getItem: storageGet, setItem: storageSet };
const KEY = 'scales.v2';
const FIRST_VERSION_KEY = 'scales.v1';

/** The kinds of scale the first version of the screen had, by their new ids. */
const FIRST_VERSION_SCALES: Readonly<Record<string, ScaleId>> = {
  major: 'major',
  minor: 'natural-minor',
  harmonic: 'harmonic-minor',
  melodic: 'melodic-minor',
  pentaMajor: 'pentatonic-major',
  pentaMinor: 'pentatonic-minor',
};

const isPlain = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const oneOf = <T extends string>(options: readonly T[], value: unknown): T | null => (options.includes(value as T) ? (value as T) : null);

/** A root that can be shown: one of the twelve notes, or a note name without an octave; null for anything else. */
function validRoot(value: unknown): number | string | null {
  if (typeof value === 'number') return Number.isInteger(value) && value >= 0 && value <= 11 ? value : null;
  if (typeof value === 'string') {
    const name = parseNoteName(value);
    return name && name.octave === null ? value : null;
  }
  return null;
}

function fromRecord(data: Record<string, unknown>): Choice {
  const degree = data.degree;
  return {
    tab: data.tab === 'chords' ? 'chords' : 'scales',
    root: validRoot(data.root) ?? DEFAULT_CHOICE.root,
    scale: oneOf(SCALE_IDS, data.scale) ?? DEFAULT_CHOICE.scale,
    category: oneOf(CATEGORY_CHOICES, data.category) ?? DEFAULT_CHOICE.category,
    labels: data.labels === 'right' || data.labels === 'left' ? data.labels : 'names',
    family: oneOf(CHORD_FAMILIES, data.family) ?? 'all',
    degree: typeof degree === 'number' && Number.isInteger(degree) && degree >= 1 && degree <= 12 ? degree : null,
    primaryOnly: data.primaryOnly === true,
  };
}

/** The choice of the first version of the screen (`scales.v1`) as a choice of this one. */
function fromFirstVersion(data: Record<string, unknown>): Choice {
  const scale = typeof data.scale === 'string' ? FIRST_VERSION_SCALES[data.scale] : undefined;
  return {
    ...DEFAULT_CHOICE,
    tab: data.tab === 'chords' ? 'chords' : 'scales',
    root: typeof data.root === 'number' ? (validRoot(data.root) ?? DEFAULT_CHOICE.root) : DEFAULT_CHOICE.root,
    ...(scale ? { scale, category: getScale(scale).category } : {}),
    labels: data.labels === 'right' || data.labels === 'left' ? data.labels : 'names',
  };
}

function parse(text: string | null): unknown {
  try {
    return text === null ? undefined : JSON.parse(text);
  } catch {
    return null;
  }
}

/** The choice kept in the browser; the one of an older version is taken over, and the default stands in for anything that is not right. */
export function readChoice(storage: ChoiceStorage = browserStorage): Choice {
  try {
    const current = parse(storage.getItem(KEY));
    if (current !== undefined) return isPlain(current) ? fromRecord(current) : { ...DEFAULT_CHOICE };
    const first = parse(storage.getItem(FIRST_VERSION_KEY));
    return isPlain(first) ? fromFirstVersion(first) : { ...DEFAULT_CHOICE };
  } catch {
    return { ...DEFAULT_CHOICE };
  }
}

export function writeChoice(choice: Choice, storage: ChoiceStorage = browserStorage): void {
  try {
    storage.setItem(KEY, JSON.stringify(choice));
  } catch {
    // not kept
  }
}

/** The root as one of the twelve notes (0 is C); null for a quarter tone. */
export function rootPcOf(root: number | string): number | null {
  if (typeof root === 'number') return root;
  const name = parseNoteName(root);
  if (!name || !Number.isInteger(name.alter)) return null;
  return (((STEP_SEMITONES[name.step] + name.alter) % 12) + 12) % 12;
}

/** The root chip that stands for the root: a quarter-tone root such as `Ek` stands on the chip of its letter. */
export function rootChipPc(root: number | string): number {
  if (typeof root === 'number') return root;
  const name = parseNoteName(root);
  if (!name) return 0;
  const alter = Number.isInteger(name.alter) ? name.alter : 0;
  return (((STEP_SEMITONES[name.step] + alter) % 12) + 12) % 12;
}

const TOKEN_SUFFIX: Readonly<Record<Alter, string>> = { [-2]: 'bb', [-1]: 'b', [-0.5]: 'k', [0]: '', [0.5]: 'o', [1]: 's', [2]: 'ss' };
const SUFFIX_SIGN: Readonly<Record<string, string>> = { '': '', s: '#', ss: '##', b: 'b', bb: 'bb', k: 'k', o: 'o' };

/** A root name as it goes into an address: lower case, `s` for a sharp (`fs`), `b` for a flat, `k` koron, `o` sori. */
export function rootToken(name: string): string {
  const parsed = parseNoteName(name);
  if (!parsed) throw new Error(`"${name}" is not a note name`);
  return `${parsed.step.toLowerCase()}${TOKEN_SUFFIX[parsed.alter]}`;
}

/** The address of a scale on a root: `d-shur`, `fs-dorian`, `ek-segah`. */
export function formatParam(root: string, scale: ScaleId): string {
  return `${rootToken(root)}-${scale}`;
}

/** The root and the scale in an address such as `d-shur`; null when it is not one. */
export function parseParam(param: string): { root: string; scale: ScaleId } | null {
  const match = /^([a-g])(ss|s|bb|b|k|o)?-([a-z0-9-]+)$/.exec(param);
  if (!match) return null;
  const scale = oneOf(SCALE_IDS, match[3]);
  return scale ? { root: `${match[1].toUpperCase()}${SUFFIX_SIGN[match[2] ?? '']}`, scale } : null;
}

/** The scale of a root and an id. A root that cannot be written (it would need a triple sign) is taken as its note of the piano. */
export function spellChoice(root: number | string, scale: ScaleId): SpelledScale {
  try {
    return spellScale(root, scale);
  } catch {
    return spellScale(rootChipPc(root), scale);
  }
}
