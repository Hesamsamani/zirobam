export const STYLE_IDS = ['pop', 'rock', 'folk', 'ballad', 'blues', 'jazz', 'bossa', 'latin', 'funk', 'gospel', 'classical', 'lofi', 'cinematic'] as const;
export type StyleId = (typeof STYLE_IDS)[number];

/**
 * One bar of a progression: the degrees of the scale that sound in it (1 is the first note). One degree fills the bar,
 * two take two beats each, four take one beat each.
 */
export type Bar = readonly number[];
/** Four bars. */
export type Phrase = readonly [Bar, Bar, Bar, Bar];

export interface StyleDef {
  id: StyleId;
  /** The chords the style likes, best first, by their id in the chord catalog. A degree where none of them fits takes any chord of the scale. */
  chords: readonly string[];
  /** Four-bar phrases the progression is made of. */
  phrases: readonly Phrase[];
  /** The last four bars of a piece: each ends on the first degree, and the bar before it leads into it. */
  endings: readonly Phrase[];
  /** The slowest and the fastest tempo in beats a minute. */
  tempo: readonly [number, number];
}

const style = (def: StyleDef): StyleDef => def;

/**
 * The thirteen styles. The degrees are those of whatever scale is chosen, so a pop progression in Dorian is the pop
 * progression with Dorian's chords. A rhythm and a bass line for each style are in the band (src/band).
 */
export const STYLES: Readonly<Record<StyleId, StyleDef>> = {
  pop: style({
    id: 'pop',
    chords: ['major', 'minor', 'dim'],
    phrases: [
      [[1], [5], [6], [4]],
      [[6], [4], [1], [5]],
      [[1], [6], [4], [5]],
      [[1], [3], [4], [5]],
      [[4], [1], [5], [6]],
    ],
    endings: [
      [[1], [4], [5], [1]],
      [[6], [4], [5], [1]],
      [[1], [6], [5], [1]],
    ],
    tempo: [96, 124],
  }),
  rock: style({
    id: 'rock',
    chords: ['power', 'major', 'minor'],
    phrases: [
      [[1], [4], [1], [5]],
      [[1], [7], [4], [1]],
      [[1], [4], [5], [4]],
      [[6], [7], [1], [1]],
    ],
    endings: [
      [[1], [4], [5], [1]],
      [[1], [7], [5], [1]],
    ],
    tempo: [110, 140],
  }),
  folk: style({
    id: 'folk',
    chords: ['major', 'minor', 'dim'],
    phrases: [
      [[1], [4], [1], [5]],
      [[1], [1], [4], [5]],
      [[1], [6], [4], [5]],
      [[1], [4], [1], [1]],
    ],
    endings: [
      [[1], [4], [5], [1]],
      [[1], [1], [5], [1]],
    ],
    tempo: [84, 110],
  }),
  ballad: style({
    id: 'ballad',
    chords: ['major', 'minor', 'add9', 'madd9', 'sus2'],
    phrases: [
      [[1], [3], [6], [4]],
      [[1], [5], [6], [3]],
      [[6], [4], [1], [5]],
      [[4], [1], [3], [6]],
    ],
    endings: [
      [[1], [3], [4], [1]],
      [[6], [4], [5], [1]],
      [[1], [6], [4], [1]],
    ],
    tempo: [60, 76],
  }),
  blues: style({
    id: 'blues',
    chords: ['dom7', 'dom9', 'm7', 'major', 'minor'],
    phrases: [
      [[1], [1], [1], [1]],
      [[4], [4], [1], [1]],
      [[5], [4], [1], [1]],
      [[1], [4], [1], [5]],
    ],
    endings: [
      [[5], [4], [1], [1]],
      [[1], [4], [5], [1]],
    ],
    tempo: [76, 110],
  }),
  jazz: style({
    id: 'jazz',
    chords: ['maj7', 'm7', 'dom7', 'm7b5', 'dim7', 'mMaj7'],
    phrases: [
      [[2], [5], [1], [1]],
      [[2, 5], [1], [2, 5], [1]],
      [[1, 6], [2, 5], [1, 6], [2, 5]],
      [[1], [6], [2], [5]],
      [[3, 6], [2, 5], [1], [1]],
    ],
    endings: [
      [[2], [5], [5], [1]],
      [[1, 6], [2, 5], [2, 5], [1]],
      [[6], [2], [5], [1]],
    ],
    tempo: [90, 160],
  }),
  bossa: style({
    id: 'bossa',
    chords: ['maj7', 'm7', 'dom7', 'm7b5', 'maj9', 'm9', 'dom9'],
    phrases: [
      [[1], [6], [2], [5]],
      [[1], [3], [6], [2]],
      [[2, 5], [1], [2, 5], [1]],
      [[1], [4], [3], [6]],
    ],
    endings: [
      [[1], [6], [2, 5], [1]],
      [[2], [5], [2, 5], [1]],
    ],
    tempo: [100, 130],
  }),
  latin: style({
    id: 'latin',
    chords: ['minor', 'major', 'dom7', 'm7', 'sus4'],
    phrases: [
      [[1], [7], [6], [5]],
      [[1], [4], [5], [1]],
      [[6], [4], [5], [6]],
      [[1], [4], [7], [3]],
    ],
    endings: [
      [[1], [7], [5], [1]],
      [[1], [4], [5], [1]],
    ],
    tempo: [96, 126],
  }),
  funk: style({
    id: 'funk',
    chords: ['dom9', 'm9', 'dom7', 'm7', 'dom13', 'major'],
    phrases: [
      [[1], [1], [4], [4]],
      [[1], [4], [1], [5]],
      [[1], [1], [1], [4]],
      [[2], [5], [1], [1]],
    ],
    endings: [
      [[1], [4], [5], [1]],
      [[4], [4], [5], [1]],
    ],
    tempo: [92, 112],
  }),
  gospel: style({
    id: 'gospel',
    chords: ['maj7', 'dom7', 'add9', 'm7', 'major', 'minor', 'sus4'],
    phrases: [
      [[1], [4], [1], [5]],
      [[1], [3], [4], [1]],
      [[4], [1], [5], [6]],
      [[1], [6], [2], [5]],
    ],
    endings: [
      [[4], [1], [5], [1]],
      [[1], [4], [5], [1]],
      [[6], [2], [5], [1]],
    ],
    tempo: [70, 96],
  }),
  classical: style({
    id: 'classical',
    chords: ['major', 'minor', 'dim'],
    phrases: [
      [[1], [4], [5], [1]],
      [[1], [6], [4], [5]],
      [[1], [5], [6], [3]],
      [[4], [1], [4], [5]],
      [[1], [2], [5], [1]],
    ],
    endings: [
      [[1], [4], [5], [1]],
      [[1], [2], [5], [1]],
      [[6], [4], [5], [1]],
    ],
    tempo: [72, 108],
  }),
  lofi: style({
    id: 'lofi',
    chords: ['maj9', 'm9', 'dom9', 'maj7', 'm7', 'dom7', 'm7b5'],
    phrases: [
      [[2], [5], [1], [6]],
      [[1], [6], [2], [5]],
      [[4], [3], [2], [1]],
      [[3], [6], [2], [5]],
    ],
    endings: [
      [[2], [5], [2, 5], [1]],
      [[6], [2], [5], [1]],
    ],
    tempo: [70, 86],
  }),
  cinematic: style({
    id: 'cinematic',
    chords: ['add9', 'sus2', 'major', 'minor', 'madd9', 'sus4', 'dim'],
    phrases: [
      [[1], [6], [3], [7]],
      [[6], [4], [1], [5]],
      [[1], [4], [6], [5]],
      [[1], [3], [4], [6]],
    ],
    endings: [
      [[6], [4], [5], [1]],
      [[1], [6], [4], [1]],
    ],
    tempo: [60, 90],
  }),
};
