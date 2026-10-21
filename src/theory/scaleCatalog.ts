/**
 * The scales of the dictionary: 32 of them, each a formula of degrees against the major scale on its root, so that
 * `1 2 b3 4 5 b6 b7` is the natural minor scale and `1 k2 b3 4 5 b6 b7` is Shur. The pitches are data here, the
 * spelling is `spell.ts`, the names a student reads are in the translations (`scale.name.<id>`).
 */

export const SCALE_CATEGORIES = ['major', 'minor', 'church', 'persian', 'pentatonic', 'blues', 'chromatic', 'wholetone', 'diminished'] as const;
export type ScaleCategory = (typeof SCALE_CATEGORIES)[number];

export const SCALE_IDS = [
  'major', 'harmonic-major', 'double-harmonic-major',
  'natural-minor', 'harmonic-minor', 'melodic-minor', 'hungarian-minor', 'neapolitan-minor',
  'dorian', 'phrygian', 'lydian', 'mixolydian', 'locrian',
  'shur', 'mahur', 'homayun', 'segah', 'chahargah', 'nava', 'rast-panjgah',
  'abu-ata', 'bayat-tork', 'afshari', 'dashti', 'bayat-esfahan',
  'pentatonic-major', 'pentatonic-minor', 'chromatic', 'blues', 'whole-tone', 'diminished-wh', 'diminished-hw',
] as const;
export type ScaleId = (typeof SCALE_IDS)[number];

/** What is special about a Persian mode. */
export interface PersianInfo {
  /** A dastgah is a main mode; an avaz is a branch of one. */
  family: 'dastgah' | 'avaz';
  /** The dastgah an avaz belongs to. */
  parent?: ScaleId;
  /** The root the dictionary shows first: a note name, with k or o for a quarter tone (`Ek`). */
  defaultRoot: string;
  /**
   * Whether an expert has checked the pitches. They follow an approximate teaching model (a quarter tone is
   * exactly half a semitone), and the sources disagree on some avazes: see docs/persian-scales-review.md.
   */
  reviewed: boolean;
}

export interface ScaleDef {
  id: ScaleId;
  category: ScaleCategory;
  /** Degrees against the major scale on the root, with the signs b # bb ## and k (koron) o (sori): `1 2 b3 4 5 b6 b7`. */
  formula: string;
  /** True for the scales that are modes of the major scale and so have a key signature (D dorian has none, C lydian one sharp). */
  keySignature: boolean;
  /** Words the search finds the scale by, lower case, besides what the translations call it. */
  aliases: { en: readonly string[]; fa: readonly string[] };
  persian?: PersianInfo;
}

const MODES_WITH_SIGNATURE: ReadonlySet<string> = new Set(['major', 'natural-minor', 'dorian', 'phrygian', 'lydian', 'mixolydian', 'locrian']);

function scale(
  id: ScaleId,
  category: ScaleCategory,
  formula: string,
  en: readonly string[],
  fa: readonly string[],
  persian?: Omit<PersianInfo, 'reviewed'>,
): ScaleDef {
  return { id, category, formula, keySignature: MODES_WITH_SIGNATURE.has(id), aliases: { en, fa }, ...(persian ? { persian: { ...persian, reviewed: false } } : {}) };
}

export const SCALES: readonly ScaleDef[] = [
  scale('major', 'major', '1 2 3 4 5 6 7', ['major', 'ionian'], ['ماژور', 'ایونین']),
  scale('harmonic-major', 'major', '1 2 3 4 5 b6 7', ['harmonic major'], ['ماژور هارمونیک']),
  scale('double-harmonic-major', 'major', '1 b2 3 4 5 b6 7', ['double harmonic major', 'double harmonic', 'byzantine'], ['ماژور هارمونیک دوگانه']),

  scale('natural-minor', 'minor', '1 2 b3 4 5 b6 b7', ['minor', 'natural minor', 'aeolian'], ['مینور', 'مینور طبیعی', 'آیولین']),
  scale('harmonic-minor', 'minor', '1 2 b3 4 5 b6 7', ['harmonic minor'], ['مینور هارمونیک']),
  scale('melodic-minor', 'minor', '1 2 b3 4 5 6 7', ['melodic minor', 'jazz minor'], ['مینور ملودیک']),
  scale('hungarian-minor', 'minor', '1 2 b3 #4 5 b6 7', ['hungarian minor', 'gypsy minor'], ['مینور مجارستانی']),
  scale('neapolitan-minor', 'minor', '1 b2 b3 4 5 b6 7', ['neapolitan minor'], ['مینور ناپلی']),

  scale('dorian', 'church', '1 2 b3 4 5 6 b7', ['dorian'], ['دورین']),
  scale('phrygian', 'church', '1 b2 b3 4 5 b6 b7', ['phrygian'], ['فریژین']),
  scale('lydian', 'church', '1 2 3 #4 5 6 7', ['lydian'], ['لیدین']),
  scale('mixolydian', 'church', '1 2 3 4 5 6 b7', ['mixolydian'], ['میکسولیدین']),
  scale('locrian', 'church', '1 b2 b3 4 b5 b6 b7', ['locrian'], ['لوکرین']),

  // The seven dastgahs and five avazes. Roots and pitches: docs/persian-scales-review.md (draft, to be reviewed).
  scale('shur', 'persian', '1 k2 b3 4 5 b6 b7', ['shur', 'shour'], ['شور'], { family: 'dastgah', defaultRoot: 'D' }),
  scale('mahur', 'persian', '1 2 3 4 5 6 7', ['mahur', 'mahoor'], ['ماهور'], { family: 'dastgah', defaultRoot: 'C' }),
  scale('homayun', 'persian', '1 k2 3 4 5 b6 b7', ['homayun', 'homayoun'], ['همایون'], { family: 'dastgah', defaultRoot: 'D' }),
  scale('segah', 'persian', '1 k2 k3 4 k5 k6 k7', ['segah', 'sehgah', 'sikah'], ['سه‌گاه', 'سهگاه', 'سه گاه'], { family: 'dastgah', defaultRoot: 'Ek' }),
  scale('chahargah', 'persian', '1 k2 3 4 5 k6 7', ['chahargah', 'chaharghah', 'chahar gah'], ['چهارگاه', 'چهار گاه'], { family: 'dastgah', defaultRoot: 'C' }),
  scale('nava', 'persian', '1 2 b3 4 5 k6 b7', ['nava', 'nawa'], ['نوا'], { family: 'dastgah', defaultRoot: 'G' }),
  scale('rast-panjgah', 'persian', '1 2 3 4 5 6 7', ['rast panjgah', 'rast-panjgah', 'rast'], ['راست پنجگاه', 'راست‌پنجگاه', 'راستپنجگاه'], { family: 'dastgah', defaultRoot: 'F' }),
  scale('abu-ata', 'persian', '1 b2 b3 4 k5 b6 b7', ['abu ata', "abu'ata", 'abuata', 'abu-ata'], ['ابوعطا'], { family: 'avaz', parent: 'shur', defaultRoot: 'D' }),
  scale('bayat-tork', 'persian', '1 2 3 4 5 6 k7', ['bayat tork', 'bayat-e tork', 'bayat turk'], ['بیات ترک'], { family: 'avaz', parent: 'shur', defaultRoot: 'F' }),
  scale('afshari', 'persian', '1 2 b3 4 5 k6 b7', ['afshari'], ['افشاری'], { family: 'avaz', parent: 'shur', defaultRoot: 'C' }),
  scale('dashti', 'persian', '1 b2 b3 4 5 b6 b7', ['dashti'], ['دشتی'], { family: 'avaz', parent: 'shur', defaultRoot: 'D' }),
  scale('bayat-esfahan', 'persian', '1 2 b3 4 5 k6 7', ['bayat esfahan', 'bayat-e esfahan', 'bayat isfahan', 'esfahan', 'isfahan'], ['بیات اصفهان', 'اصفهان'], {
    family: 'avaz',
    parent: 'homayun',
    defaultRoot: 'G',
  }),

  scale('pentatonic-major', 'pentatonic', '1 2 3 5 6', ['pentatonic major', 'major pentatonic', 'pentatonic'], ['پنتاتونیک ماژور', 'پنتاتونیک']),
  scale('pentatonic-minor', 'pentatonic', '1 b3 4 5 b7', ['pentatonic minor', 'minor pentatonic'], ['پنتاتونیک مینور']),
  scale('chromatic', 'chromatic', '1 b2 2 b3 3 4 #4 5 b6 6 b7 7', ['chromatic'], ['کروماتیک']),
  scale('blues', 'blues', '1 b3 4 b5 5 b7', ['blues', 'blues scale'], ['بلوز']),
  scale('whole-tone', 'wholetone', '1 2 3 #4 #5 b7', ['whole tone', 'whole-tone'], ['تمام پرده', 'تمام‌پرده']),
  scale('diminished-wh', 'diminished', '1 2 b3 4 b5 b6 6 7', ['whole half diminished', 'whole-half diminished', 'diminished', 'octatonic'], ['دیمینیشد پرده و نیم‌پرده', 'دیمینیشد']),
  scale('diminished-hw', 'diminished', '1 b2 b3 3 #4 5 6 b7', ['half whole diminished', 'half-whole diminished', 'dominant diminished'], ['دیمینیشد نیم‌پرده و پرده']),
];

const BY_ID: ReadonlyMap<string, ScaleDef> = new Map(SCALES.map((s) => [s.id, s]));

export function getScale(id: ScaleId): ScaleDef {
  const found = BY_ID.get(id);
  if (!found) throw new Error(`Unknown scale "${id}"`);
  return found;
}

export function scalesOfCategory(category: ScaleCategory): ScaleDef[] {
  return SCALES.filter((s) => s.category === category);
}

/** A note of a scale: its degree (1 to 7, which fixes its letter) and its distance from the root in semitones (a quarter tone is .5). */
export interface FormulaNote {
  degree: number;
  offset: number;
}

const MAJOR_OFFSET = [0, 2, 4, 5, 7, 9, 11] as const;
const SIGN_OFFSET: Readonly<Record<string, number>> = { '': 0, b: -1, '#': 1, bb: -2, '##': 2, k: -0.5, o: 0.5 };
const TOKEN = /^(bb|##|[b#ko])?([1-7])$/;

/** Reads a formula such as `1 k2 b3 4 5 b6 b7`; throws for anything that is not one. */
export function parseFormula(formula: string): FormulaNote[] {
  const tokens = formula.trim().split(/\s+/);
  return tokens.map((token) => {
    const match = TOKEN.exec(token);
    if (!match) throw new Error(`Cannot read "${token}" in the scale formula "${formula}"`);
    const degree = Number(match[2]);
    return { degree, offset: MAJOR_OFFSET[degree - 1] + SIGN_OFFSET[match[1] ?? ''] };
  });
}
