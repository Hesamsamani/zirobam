import { describe, it, expect } from 'vitest';
import { SCALES } from '../theory/scaleCatalog';
import { searchScales } from '../theory/search';

const first = (query: string) => searchScales(query)[0];
const ids = (query: string) => searchScales(query).map((hit) => hit.id);

describe('searchScales: English', () => {
  it('finds a scale by its name, with or without a root', () => {
    expect(first('C Dorian')).toMatchObject({ id: 'dorian', rootName: 'C', rootPc: 0 });
    expect(first('dorian')).toMatchObject({ id: 'dorian', rootName: null, rootPc: null });
    expect(first('DORIAN')).toMatchObject({ id: 'dorian' });
  });

  it('reads the root as a letter with a sign, a sharp or flat sign, or a word, wherever it stands', () => {
    expect(first('D# harmonic minor')).toMatchObject({ id: 'harmonic-minor', rootName: 'D#', rootPc: 3 });
    expect(first('bb blues')).toMatchObject({ id: 'blues', rootName: 'Bb', rootPc: 10 });
    expect(first('F♯ major')).toMatchObject({ id: 'major', rootName: 'F#', rootPc: 6 });
    expect(first('e flat major')).toMatchObject({ id: 'major', rootName: 'Eb', rootPc: 3 });
    expect(first('c sharp minor')).toMatchObject({ id: 'natural-minor', rootName: 'C#', rootPc: 1 });
    expect(first('major A')).toMatchObject({ id: 'major', rootName: 'A', rootPc: 9 });
    expect(first('b minor')).toMatchObject({ rootName: 'B', rootPc: 11 }); // a lone b is B, not B flat
  });

  it('reads a root in solfège', () => {
    expect(first('do minor')).toMatchObject({ id: 'natural-minor', rootName: 'C', rootPc: 0 });
    expect(first('sol dorian')).toMatchObject({ id: 'dorian', rootName: 'G', rootPc: 7 });
    expect(first('Fa# lydian')).toMatchObject({ id: 'lydian', rootName: 'F#', rootPc: 6 });
  });

  it('reads a quarter-tone root: k for koron, o for sori', () => {
    expect(first('Ek segah')).toMatchObject({ id: 'segah', rootName: 'Ek', rootPc: null });
    expect(first('mi koron segah')).toMatchObject({ id: 'segah', rootName: 'Ek', rootPc: null });
    expect(first('co shur')).toMatchObject({ id: 'shur', rootName: 'Co' });
  });

  it('puts an exact name before the scales that merely contain it', () => {
    const hits = ids('minor');
    expect(hits[0]).toBe('natural-minor');
    expect(hits).toEqual(expect.arrayContaining(['harmonic-minor', 'melodic-minor', 'pentatonic-minor']));
    expect(first('pentatonic')).toMatchObject({ id: 'pentatonic-major' });
    expect(ids('pentatonic')).toEqual(expect.arrayContaining(['pentatonic-major', 'pentatonic-minor']));
  });

  it('finds the start of a name', () => {
    expect(ids('harm')).toEqual(expect.arrayContaining(['harmonic-minor', 'harmonic-major']));
    expect(first('mixo')).toMatchObject({ id: 'mixolydian' });
  });

  it('knows other ways of writing a name', () => {
    expect(first('aeolian')).toMatchObject({ id: 'natural-minor' });
    expect(first('double harmonic')).toMatchObject({ id: 'double-harmonic-major' });
    expect(first('half whole diminished')).toMatchObject({ id: 'diminished-hw' });
    expect(first('whole-tone')).toMatchObject({ id: 'whole-tone' });
    expect(first('bayat-e esfahan')).toMatchObject({ id: 'bayat-esfahan' });
    expect(first("abu'ata")).toMatchObject({ id: 'abu-ata' });
  });

  it('leaves out the words that only say what it is', () => {
    expect(first('shur scale')).toMatchObject({ id: 'shur' });
    expect(first('dastgah shur')).toMatchObject({ id: 'shur' });
    expect(first('major mode')).toMatchObject({ id: 'major' });
  });
});

describe('searchScales: Persian', () => {
  it('finds a mode by its Persian name, with the word dastgah or without it', () => {
    expect(first('دستگاه شور')).toMatchObject({ id: 'shur', rootName: null });
    expect(first('شور')).toMatchObject({ id: 'shur' });
    expect(first('آواز دشتی')).toMatchObject({ id: 'dashti' });
    expect(first('گام ماژور')).toMatchObject({ id: 'major' });
    expect(first('بیات اصفهان')).toMatchObject({ id: 'bayat-esfahan' });
  });

  it('finds Segah however it is written: with the half-space, with a space, or with none', () => {
    for (const query of ['سه‌گاه', 'سه گاه', 'سهگاه']) expect(first(query), query).toMatchObject({ id: 'segah' });
    expect(first('راست‌پنجگاه')).toMatchObject({ id: 'rast-panjgah' });
  });

  it('reads a root in Persian solfège, wherever it stands in the words', () => {
    expect(first('ماهور ر')).toMatchObject({ id: 'mahur', rootName: 'D', rootPc: 2 });
    expect(first('ر ماهور')).toMatchObject({ id: 'mahur', rootName: 'D' });
    expect(first('دو مینور')).toMatchObject({ id: 'natural-minor', rootName: 'C', rootPc: 0 });
    expect(first('فا دیز مینور')).toMatchObject({ id: 'natural-minor', rootName: 'F#', rootPc: 6 });
    expect(first('سی بمل ماژور')).toMatchObject({ id: 'major', rootName: 'Bb', rootPc: 10 });
    expect(first('سل دورین')).toMatchObject({ id: 'dorian', rootName: 'G' });
  });

  it('reads a quarter-tone root in Persian', () => {
    expect(first('می کرن سه‌گاه')).toMatchObject({ id: 'segah', rootName: 'Ek', rootPc: null });
    expect(first('دو سری شور')).toMatchObject({ id: 'shur', rootName: 'Co' });
  });

  it('is not put off by the Arabic letters a keyboard may give: yeh and kaf', () => {
    expect(first('مينور')).toMatchObject({ id: 'natural-minor' }); // Arabic yeh
    expect(first('دشتي')).toMatchObject({ id: 'dashti' });
    expect(first('كروماتيك')).toMatchObject({ id: 'chromatic' }); // Arabic kaf and yeh
  });
});

describe('searchScales: the edges', () => {
  it('gives nothing for an empty query, words that are not a scale, or only filler words', () => {
    for (const query of ['', '   ', 'xyz', 'banana', 'scale', 'دستگاه', 'گام']) expect(searchScales(query), query).toEqual([]);
  });

  it('gives every scale on that root for a root alone, in the order of the catalog', () => {
    const hits = searchScales('D');
    expect(hits).toHaveLength(SCALES.length);
    expect(hits.map((h) => h.id)).toEqual(SCALES.map((s) => s.id));
    expect(hits.every((h) => h.rootName === 'D' && h.rootPc === 2)).toBe(true);
    expect(searchScales('ر')).toHaveLength(SCALES.length);
  });

  it('never gives the same scale twice', () => {
    for (const query of ['minor', 'harmonic', 'bayat', 'a', 'dastgah', 'pentatonic minor']) expect(new Set(ids(query)).size, query).toBe(ids(query).length);
  });

  it('ranks the best match first and keeps the catalog order among equals', () => {
    const hits = searchScales('minor');
    for (let i = 1; i < hits.length; i++) expect(hits[i].score).toBeLessThanOrEqual(hits[i - 1].score);
  });
});
