// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { packIco } from './ico.mjs';

const fakePng = (length: number, fill: number) => Buffer.alloc(length, fill);

/** Reads a packed .ico back: the entries of its directory and the bytes each one points at. */
function readIco(file: Buffer) {
  expect(file.readUInt16LE(0)).toBe(0); // reserved
  expect(file.readUInt16LE(2)).toBe(1); // type: icon
  const count = file.readUInt16LE(4);
  const entries = [];
  for (let i = 0; i < count; i++) {
    const at = 6 + i * 16;
    const size = file.readUInt32LE(at + 8);
    const offset = file.readUInt32LE(at + 12);
    entries.push({
      width: file[at] === 0 ? 256 : file[at],
      height: file[at + 1] === 0 ? 256 : file[at + 1],
      colors: file[at + 2],
      reserved: file[at + 3],
      planes: file.readUInt16LE(at + 4),
      bits: file.readUInt16LE(at + 6),
      size,
      offset,
      data: file.subarray(offset, offset + size),
    });
  }
  return entries;
}

describe('packIco', () => {
  it('writes the header, one 16-byte entry for each picture, and then the pictures', () => {
    const images = [
      { size: 16, png: fakePng(40, 1) },
      { size: 32, png: fakePng(70, 2) },
      { size: 48, png: fakePng(90, 3) },
    ];
    const file = packIco(images);
    expect(file.length).toBe(6 + 3 * 16 + 40 + 70 + 90);
    const entries = readIco(file);
    expect(entries.map((e) => [e.width, e.height])).toEqual([
      [16, 16],
      [32, 32],
      [48, 48],
    ]);
    expect(entries.map((e) => e.offset)).toEqual([54, 94, 164]);
    expect(entries.map((e) => e.size)).toEqual([40, 70, 90]);
    expect(entries.every((e) => e.colors === 0 && e.reserved === 0 && e.planes === 1 && e.bits === 32)).toBe(true);
    expect(entries.map((e) => [...new Set(e.data)])).toEqual([[1], [2], [3]]);
  });

  it('writes 256 as 0, which is how the format says it', () => {
    const file = packIco([{ size: 256, png: fakePng(10, 9) }]);
    expect(file[6]).toBe(0);
    expect(file[7]).toBe(0);
    expect(readIco(file)[0].width).toBe(256);
  });

  it('refuses a size the format cannot hold, and an empty list', () => {
    expect(() => packIco([{ size: 300, png: fakePng(1, 0) }])).toThrow();
    expect(() => packIco([{ size: 0, png: fakePng(1, 0) }])).toThrow();
    expect(() => packIco([])).toThrow();
  });
});
