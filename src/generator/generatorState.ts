import { storageGet, storageSet } from '../core/safeStorage';
import { formatParam, parseParam, spellChoice, type CategoryChoice, type ChoiceStorage } from '../scales/dictionaryState';
import { parseNoteName } from '../theory/pitch';
import { SCALE_CATEGORIES, SCALE_IDS, getScale, type ScaleId } from '../theory/scaleCatalog';
import type { Contour, MelodyRange } from './melody';
import { METER_IDS, type Density, type MeterId, type RhythmFeel } from './rhythmCells';
import { STYLE_IDS, type StyleId } from './styles';

export type GenTab = 'prog' | 'melody' | 'band';
export type Over = 'scale' | 'progression';
export const BAR_CHOICES = [4, 8, 12, 16] as const;
export const OCTAVES = [3, 4, 5] as const;
export const DENSITIES: readonly Density[] = ['sparse', 'medium', 'dense'];
export const FEELS: readonly RhythmFeel[] = ['straight', 'syncopated', 'dotted'];
export const CONTOURS: readonly Contour[] = ['arch', 'rising', 'falling', 'wave', 'flat'];
export const RANGES: readonly MelodyRange[] = ['narrow', 'medium', 'wide'];
export const BPM_MIN = 40;
export const BPM_MAX = 220;
export const SEED_MAX = 999_999;

/** Everything the screen shows, and what an address of it says. */
export interface GeneratorState {
  tab: GenTab;
  /** One of the twelve notes (0 is C), or a name used as written (`Db`, `Ek`). */
  root: number | string;
  scale: ScaleId;
  /** The group of scales listed in the picker. */
  category: CategoryChoice;
  style: StyleId;
  bars: number;
  seed: number;
  /** Beats a minute; null leaves it to the style and the seed. */
  bpm: number | null;
  meter: MeterId;
  density: Density;
  feel: RhythmFeel;
  contour: Contour;
  range: MelodyRange;
  octave: (typeof OCTAVES)[number];
  over: Over;
}

export const DEFAULT_STATE: GeneratorState = {
  tab: 'prog',
  root: 0,
  scale: 'major',
  category: 'major',
  style: 'pop',
  bars: 8,
  seed: 1,
  bpm: null,
  meter: '4/4',
  density: 'medium',
  feel: 'straight',
  contour: 'arch',
  range: 'medium',
  octave: 4,
  over: 'scale',
};

const oneOf = <T>(options: readonly T[], value: unknown): T | null => (options.includes(value as T) ? (value as T) : null);

/** A meter in an address, without the slash: `44`, `68`. */
const meterToken = (meter: MeterId): string => meter.replace('/', '');
const meterOfToken = (token: string | null): MeterId | null => METER_IDS.find((meter) => meterToken(meter) === token) ?? null;

/** A whole number in a text, or null: `12abc`, `1.5` and the empty text are not one. */
function wholeNumber(text: string | null): number | null {
  return text !== null && /^\d+$/.test(text) ? Number(text) : null;
}

/** Brings together what cannot go together: a melody over a progression is in 4/4. */
export function keepConsistent(state: GeneratorState): GeneratorState {
  return state.meter !== '4/4' && state.over === 'progression' ? { ...state, over: 'scale' } : state;
}

/** The address of the screen: `t=prog&s=d-dorian&style=jazz&bars=8&seed=123`, and what only the melody uses when it is open. */
export function queryOf(state: GeneratorState): string {
  const scale = spellChoice(state.root, state.scale);
  const parts = [`t=${state.tab}`, `s=${formatParam(scale.root, state.scale)}`, `style=${state.style}`, `bars=${state.bars}`, `seed=${state.seed}`];
  if (state.bpm !== null) parts.push(`bpm=${state.bpm}`);
  if (state.tab === 'melody') {
    parts.push(`meter=${meterToken(state.meter)}`, `density=${state.density}`, `feel=${state.feel}`, `contour=${state.contour}`, `range=${state.range}`, `oct=${state.octave}`, `over=${state.over}`);
  }
  return parts.join('&');
}

/** What an address says, laid over a state: whatever it does not say, or says in a way that is not right, stays as it was. */
export function stateFromQuery(query: string, base: GeneratorState): GeneratorState {
  const params = new URLSearchParams(query.replace(/^[?#]+/, ''));
  const next: GeneratorState = { ...base };

  next.tab = oneOf<GenTab>(['prog', 'melody', 'band'], params.get('t')) ?? base.tab;
  const named = params.get('s') ? parseParam(params.get('s')!) : null;
  if (named) {
    next.root = named.root;
    next.scale = named.scale;
    next.category = getScale(named.scale).category;
  }
  next.style = oneOf(STYLE_IDS, params.get('style')) ?? base.style;
  const bars = wholeNumber(params.get('bars'));
  next.bars = bars !== null && (BAR_CHOICES as readonly number[]).includes(bars) ? bars : base.bars;
  const seed = wholeNumber(params.get('seed'));
  next.seed = seed !== null && seed >= 1 && seed <= SEED_MAX ? seed : base.seed;
  const bpm = wholeNumber(params.get('bpm'));
  next.bpm = bpm !== null && bpm >= BPM_MIN && bpm <= BPM_MAX ? bpm : params.has('bpm') ? null : base.bpm;
  next.meter = meterOfToken(params.get('meter')) ?? base.meter;
  next.density = oneOf(DENSITIES, params.get('density')) ?? base.density;
  next.feel = oneOf(FEELS, params.get('feel')) ?? base.feel;
  next.contour = oneOf(CONTOURS, params.get('contour')) ?? base.contour;
  next.range = oneOf(RANGES, params.get('range')) ?? base.range;
  const octave = wholeNumber(params.get('oct'));
  next.octave = octave !== null && (OCTAVES as readonly number[]).includes(octave) ? (octave as GeneratorState['octave']) : base.octave;
  next.over = oneOf<Over>(['scale', 'progression'], params.get('over')) ?? base.over;
  return keepConsistent(next);
}

// ----- the settings kept between visits -----

const KEY = 'generator.v1';
export type GeneratorSettings = Omit<GeneratorState, 'seed'>;
const browserStorage: ChoiceStorage = { getItem: storageGet, setItem: storageSet };
const { seed: _seed, ...DEFAULT_SETTINGS } = DEFAULT_STATE;

function validRoot(value: unknown): number | string | null {
  if (typeof value === 'number') return Number.isInteger(value) && value >= 0 && value <= 11 ? value : null;
  if (typeof value === 'string') {
    const name = parseNoteName(value);
    return name && name.octave === null ? value : null;
  }
  return null;
}

/** The settings kept in the browser, with a default for anything missing or not right. The seed is never kept: each visit starts a new piece. */
export function readSettings(storage: ChoiceStorage = browserStorage): GeneratorSettings {
  try {
    const text = storage.getItem(KEY);
    const data: unknown = text === null ? null : JSON.parse(text);
    if (typeof data !== 'object' || data === null || Array.isArray(data)) return { ...DEFAULT_SETTINGS };
    const d = data as Record<string, unknown>;
    const bars = typeof d.bars === 'number' && (BAR_CHOICES as readonly number[]).includes(d.bars) ? d.bars : DEFAULT_SETTINGS.bars;
    const bpm = typeof d.bpm === 'number' && Number.isInteger(d.bpm) && d.bpm >= BPM_MIN && d.bpm <= BPM_MAX ? d.bpm : null;
    const scale = oneOf(SCALE_IDS, d.scale) ?? DEFAULT_SETTINGS.scale;
    const settings: GeneratorSettings = {
      tab: oneOf<GenTab>(['prog', 'melody', 'band'], d.tab) ?? DEFAULT_SETTINGS.tab,
      root: validRoot(d.root) ?? DEFAULT_SETTINGS.root,
      scale,
      category: oneOf<CategoryChoice>(['all', ...SCALE_CATEGORIES], d.category) ?? getScale(scale).category,
      style: oneOf(STYLE_IDS, d.style) ?? DEFAULT_SETTINGS.style,
      bars,
      bpm,
      meter: oneOf(METER_IDS, d.meter) ?? DEFAULT_SETTINGS.meter,
      density: oneOf(DENSITIES, d.density) ?? DEFAULT_SETTINGS.density,
      feel: oneOf(FEELS, d.feel) ?? DEFAULT_SETTINGS.feel,
      contour: oneOf(CONTOURS, d.contour) ?? DEFAULT_SETTINGS.contour,
      range: oneOf(RANGES, d.range) ?? DEFAULT_SETTINGS.range,
      octave: (oneOf(OCTAVES, d.octave) ?? DEFAULT_SETTINGS.octave) as GeneratorState['octave'],
      over: oneOf<Over>(['scale', 'progression'], d.over) ?? DEFAULT_SETTINGS.over,
    };
    // a melody over a progression is in 4/4
    return { ...settings, over: settings.meter !== '4/4' && settings.over === 'progression' ? 'scale' : settings.over };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function writeSettings(state: GeneratorState, storage: ChoiceStorage = browserStorage): void {
  const { seed: _unused, ...settings } = state;
  try {
    storage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // not kept
  }
}
