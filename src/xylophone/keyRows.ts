export type RowId = 'number' | 'top' | 'home' | 'bottom';

export interface KeyRow {
  /** `KeyboardEvent.code` values from left to right, so any keyboard layout (Persian too) works. */
  codes: readonly string[];
  /** What is printed on the keys, for the labels under the bars. */
  labels: readonly string[];
}

export const ROW_IDS: readonly RowId[] = ['number', 'top', 'home', 'bottom'];

export const KEY_ROWS: Readonly<Record<RowId, KeyRow>> = {
  number: {
    codes: ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9', 'Digit0', 'Minus', 'Equal'],
    labels: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '='],
  },
  top: {
    codes: ['KeyQ', 'KeyW', 'KeyE', 'KeyR', 'KeyT', 'KeyY', 'KeyU', 'KeyI', 'KeyO', 'KeyP', 'BracketLeft', 'BracketRight'],
    labels: ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P', '[', ']'],
  },
  home: {
    codes: ['KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyG', 'KeyH', 'KeyJ', 'KeyK', 'KeyL', 'Semicolon', 'Quote'],
    labels: ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', ';', "'"],
  },
  bottom: {
    codes: ['KeyZ', 'KeyX', 'KeyC', 'KeyV', 'KeyB', 'KeyN', 'KeyM', 'Comma', 'Period', 'Slash'],
    labels: ['Z', 'X', 'C', 'V', 'B', 'N', 'M', ',', '.', '/'],
  },
};

export function isRowId(value: unknown): value is RowId {
  return typeof value === 'string' && (ROW_IDS as readonly string[]).includes(value);
}

export interface XyloBar {
  index: number;
  code: string;
  label: string;
  noteName: string;
  midi: number;
}

const STEPS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const STEP_SEMITONES = [0, 2, 4, 5, 7, 9, 11];

/** The bars of the xylophone: one C major note per key of the row, from the C of `startOctave` upward. */
export function barsForRow(row: RowId, startOctave: number): XyloBar[] {
  const { codes, labels } = KEY_ROWS[row];
  return codes.map((code, index) => {
    const octave = startOctave + Math.floor(index / 7);
    const step = index % 7;
    return {
      index,
      code,
      label: labels[index],
      noteName: `${STEPS[step]}${octave}`,
      midi: (octave + 1) * 12 + STEP_SEMITONES[step],
    };
  });
}
