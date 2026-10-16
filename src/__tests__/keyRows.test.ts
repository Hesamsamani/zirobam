import { describe, it, expect } from 'vitest';
import { KEY_ROWS, ROW_IDS, barsForRow, isRowId } from '../xylophone/keyRows';

describe('KEY_ROWS', () => {
  it('has the four letter and number rows with matching codes and labels', () => {
    expect(ROW_IDS).toEqual(['number', 'top', 'home', 'bottom']);
    for (const id of ROW_IDS) {
      expect(KEY_ROWS[id].codes.length, id).toBe(KEY_ROWS[id].labels.length);
    }
  });

  it('lists each row from left to right as printed on the keyboard', () => {
    expect(KEY_ROWS.number.labels.join('')).toBe('1234567890-=');
    expect(KEY_ROWS.top.labels.join('')).toBe('QWERTYUIOP[]');
    expect(KEY_ROWS.home.labels.join('')).toBe("ASDFGHJKL;'");
    expect(KEY_ROWS.bottom.labels.join('')).toBe('ZXCVBNM,./');
  });

  it('identifies keys by physical position (KeyboardEvent.code), not by the typed letter', () => {
    expect(KEY_ROWS.home.codes.slice(0, 3)).toEqual(['KeyA', 'KeyS', 'KeyD']);
    expect(KEY_ROWS.home.codes.slice(9)).toEqual(['Semicolon', 'Quote']);
    expect(KEY_ROWS.number.codes[0]).toBe('Digit1');
    expect(KEY_ROWS.number.codes[9]).toBe('Digit0');
    expect(KEY_ROWS.top.codes.slice(10)).toEqual(['BracketLeft', 'BracketRight']);
    expect(KEY_ROWS.bottom.codes.slice(7)).toEqual(['Comma', 'Period', 'Slash']);
  });

  it('never uses one key in two rows', () => {
    const all = ROW_IDS.flatMap((id) => KEY_ROWS[id].codes);
    expect(new Set(all).size).toBe(all.length);
  });
});

describe('barsForRow', () => {
  it('puts C major notes on the keys from left to right, starting at C', () => {
    const bars = barsForRow('home', 4);
    expect(bars.map((b) => b.noteName)).toEqual(['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5', 'D5', 'E5', 'F5']);
    expect(bars.map((b) => b.label).join('')).toBe("ASDFGHJKL;'");
    expect(bars[0].code).toBe('KeyA');
  });

  it('gives each row as many bars as it has keys', () => {
    expect(barsForRow('number', 4)).toHaveLength(12);
    expect(barsForRow('top', 4)).toHaveLength(12);
    expect(barsForRow('home', 4)).toHaveLength(11);
    expect(barsForRow('bottom', 4)).toHaveLength(10);
  });

  it('starts every row at the C of the chosen octave', () => {
    for (const id of ROW_IDS) {
      expect(barsForRow(id, 5)[0].noteName).toBe('C5');
      expect(barsForRow(id, 4)[0].noteName).toBe('C4');
    }
  });

  it('continues into the next octave after B', () => {
    const bars = barsForRow('number', 4);
    expect(bars[6].noteName).toBe('B4');
    expect(bars[7].noteName).toBe('C5');
    expect(bars[11].noteName).toBe('G5');
  });

  it('numbers the bars by position and gives the sounding pitch', () => {
    const bars = barsForRow('bottom', 4);
    expect(bars.map((b) => b.index)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(bars[0].midi).toBe(60);
    expect(bars[1].midi).toBe(62);
    expect(bars[9].midi).toBe(76); // E5
  });
});

describe('isRowId', () => {
  it('accepts only the four row names', () => {
    expect(isRowId('home')).toBe(true);
    expect(isRowId('middle')).toBe(false);
    expect(isRowId(null)).toBe(false);
  });
});
