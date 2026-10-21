import { pickWeighted, type Rng } from '../core/rng';

export const METER_IDS = ['2/4', '3/4', '4/4', '6/8'] as const;
export type MeterId = (typeof METER_IDS)[number];

export interface MeterDef {
  /** Beats in a bar as the notation of the songs counts them: quarter notes, or eighth notes for 6/8. */
  beats: 2 | 3 | 4 | 6;
  beatType: 4 | 8;
  /** The length of a bar in sixteenth notes. */
  units: number;
  /** The length of the pulse in sixteenths: a quarter note, or the dotted quarter of 6/8. */
  pulse: number;
  /** Where the strong beats start, in sixteenths from the start of the bar. */
  strong: readonly number[];
}

export const METERS: Readonly<Record<MeterId, MeterDef>> = {
  '2/4': { beats: 2, beatType: 4, units: 8, pulse: 4, strong: [0] },
  '3/4': { beats: 3, beatType: 4, units: 12, pulse: 4, strong: [0] },
  '4/4': { beats: 4, beatType: 4, units: 16, pulse: 4, strong: [0, 8] },
  '6/8': { beats: 6, beatType: 8, units: 12, pulse: 6, strong: [0, 6] },
};

/** The letters of the notation of the songs for each length in sixteenths: whole, dotted half, half, dotted quarter, quarter, dotted eighth, eighth, sixteenth. */
export const UNIT_TOKEN: Readonly<Record<number, string>> = { 16: 'w', 12: 'h.', 8: 'h', 6: 'q.', 4: 'q', 3: 'e.', 2: 'e', 1: 's' };

export type Density = 'sparse' | 'medium' | 'dense';
export type RhythmFeel = 'straight' | 'syncopated' | 'dotted';

/** A group of notes laid down together: a dotted eighth is always followed by its sixteenth, sixteenths come two at a time. */
interface Cell {
  lengths: readonly number[];
  weight: number;
}

/** How likely each cell is for a density; 0 leaves it out. */
const WEIGHTS: Readonly<Record<Density, Readonly<Record<string, number>>>> = {
  sparse: { '16': 0.6, '12': 1, '8': 3, '6': 0.5, '4': 5, '2': 1, '3,1': 0, '1,1': 0 },
  medium: { '16': 0, '12': 0.3, '8': 1, '6': 1, '4': 5, '2': 5, '3,1': 0.3, '1,1': 0.2 },
  dense: { '16': 0, '12': 0, '8': 0.2, '6': 0.5, '4': 2, '2': 6, '3,1': 1, '1,1': 2 },
};

/** The cells that may start at a place in the bar, with the weight each has in that density and feel. */
function cellsAt(meter: MeterDef, position: number, left: number, density: Density, feel: RhythmFeel): Cell[] {
  const { pulse } = meter;
  const w = WEIGHTS[density];
  const cells: Cell[] = [];
  const add = (lengths: number[], weight: number): void => {
    if (weight > 0 && lengths.reduce((sum, l) => sum + l, 0) <= left) cells.push({ lengths, weight });
  };
  const onPulse = position % pulse === 0;
  const inPulse = position % pulse;

  if (position === 0) add([16], meter.units === 16 ? w['16'] : 0);
  // a note longer than the pulse starts on a pulse and is a whole number of them
  if (onPulse) add([12], pulse === 4 || pulse === 6 ? w['12'] * (position === 0 ? 1 : 0.4) : 0);
  if (onPulse && pulse === 4) add([8], w['8'] * (meter.strong.includes(position) ? 1 : 0.4));
  // the dotted quarter is followed by an eighth: a dotted feel makes it likely, a straight one rare
  const dottedQuarter = feel === 'dotted' ? 4 : feel === 'straight' ? 0.3 : 1;
  if (onPulse) add([6], w['6'] * dottedQuarter);
  // the quarter note stays inside its pulse; in a meter of quarters a syncopated feel lets it start on the off-beat eighth
  if (pulse === 4 ? onPulse || (feel === 'syncopated' && inPulse === 2) : inPulse + 4 <= pulse) {
    add([4], w['4'] * (feel === 'syncopated' && pulse === 4 && inPulse === 2 ? 3 : 1));
  }
  if (feel === 'syncopated' && pulse === 4 && inPulse === 2) add([6], w['6'] * 2);
  add([2], w['2']);
  if (pulse === 4 && onPulse) add([3, 1], w['3,1'] * (feel === 'dotted' ? 4 : 1));
  add([1, 1], w['1,1']);
  return cells;
}

/**
 * The lengths of the notes of one bar, in sixteenths. A bar is filled cell by cell with the chances of the density
 * and the feel; the same generator state always gives the same bar. Notes never run over a pulse unless they start
 * on one and are a whole number of pulses long (a syncopated feel also lets a quarter start on the off-beat eighth).
 */
export function rhythmBar(meterId: MeterId, density: Density, feel: RhythmFeel, rng: Rng): number[] {
  const meter = METERS[meterId];
  const bar: number[] = [];
  let position = 0;
  while (position < meter.units) {
    const cells = cellsAt(meter, position, meter.units - position, density, feel);
    // an even number of sixteenths always remains, so the eighth note is always there to finish with
    const cell = cells.length > 0 ? pickWeighted(rng, cells, cells.map((c) => c.weight)) : { lengths: [2], weight: 1 };
    bar.push(...cell.lengths);
    position += cell.lengths.reduce((sum, l) => sum + l, 0);
  }
  return bar;
}
