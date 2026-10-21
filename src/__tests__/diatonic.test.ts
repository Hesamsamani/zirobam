import { describe, it, expect } from 'vitest';
import { CHORD_DEFS, getChord, type ChordFamily } from '../theory/chordCatalog';
import { chordsOfScale, inversionsOf, rootPositionOf } from '../theory/diatonic';
import { spellScale } from '../theory/spell';

const symbols = (scale: ReturnType<typeof spellScale>, filter?: Parameters<typeof chordsOfScale>[1]) => chordsOfScale(scale, filter).map((c) => c.symbol);

describe('chordsOfScale', () => {
  const cMajor = spellScale(0, 'major');

  it('finds the seven triads of C major, with their degrees and Roman numerals', () => {
    const triads = chordsOfScale(cMajor, { families: ['triad'] });
    expect(triads.map((c) => c.symbol)).toEqual(['C', 'Dm', 'Em', 'F', 'G', 'Am', 'Bdim']);
    expect(triads.map((c) => c.degree)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(triads.map((c) => c.roman)).toEqual(['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°']);
    expect(triads.map((c) => c.noteCount)).toEqual([3, 3, 3, 3, 3, 3, 3]);
    expect(triads[1]).toMatchObject({ root: 'D', notes: ['D', 'F', 'A'], inversion: 0 });
  });

  it('finds the sevenths of C major', () => {
    expect(symbols(cMajor, { families: ['seventh'] })).toEqual(['Cmaj7', 'Dm7', 'Em7', 'Fmaj7', 'G7', 'Am7', 'Bm7b5']);
  });

  it('only gives a chord whose notes are all in the scale', () => {
    expect(symbols(cMajor, { families: ['ninth'] })).toEqual(['Cmaj9', 'Dm9', 'Fmaj9', 'G9', 'Am9']); // no Em9: it needs F sharp
    const inScale = new Set(cMajor.names);
    for (const chord of chordsOfScale(cMajor)) for (const note of chord.notes) expect(inScale.has(note), `${chord.symbol}: ${note}`).toBe(true);
  });

  it('gives the 27 chords of C major in the families the dictionary website shows without a login', () => {
    // triads 7, sixths 4, power chords 6, quartal 5 and quintal 5
    const free: ChordFamily[] = ['triad', 'sixth', 'power', 'quartal'];
    const found = chordsOfScale(cMajor, { families: free });
    expect(found).toHaveLength(27);
    expect(found.filter((c) => c.def.family === 'triad')).toHaveLength(7);
    expect(found.filter((c) => c.def.family === 'sixth').map((c) => c.symbol)).toEqual(['C6', 'Dm6', 'F6', 'G6']);
    expect(found.filter((c) => c.def.family === 'power').map((c) => c.symbol)).toEqual(['C5', 'D5', 'E5', 'F5', 'G5', 'A5']);
    expect(found.filter((c) => c.def.id === 'quartal').map((c) => c.symbol)).toEqual(['D(4ths)', 'E(4ths)', 'G(4ths)', 'A(4ths)', 'B(4ths)']);
    expect(found.filter((c) => c.def.id === 'quintal').map((c) => c.symbol)).toEqual(['C(5ths)', 'D(5ths)', 'F(5ths)', 'G(5ths)', 'A(5ths)']);
  });

  it('orders the chords by degree, and within a degree as the catalog does', () => {
    const all = chordsOfScale(cMajor);
    const degrees = all.map((c) => c.degree);
    expect(degrees).toEqual([...degrees].sort((a, b) => a - b));
    const onC = all.filter((c) => c.degree === 1).map((c) => CHORD_DEFS.indexOf(c.def));
    expect(onC).toEqual([...onC].sort((a, b) => a - b));
  });

  it('keeps the chords of one degree, or of one family', () => {
    expect(symbols(cMajor, { degree: 5, families: ['triad'] })).toEqual(['G']);
    expect(symbols(cMajor, { degree: 5, families: ['triad', 'seventh'] })).toEqual(['G', 'G7']);
    expect(chordsOfScale(cMajor, { degree: 9 })).toEqual([]);
    expect(chordsOfScale(cMajor, { families: [] })).toEqual([]);
  });

  describe('the main chords', () => {
    it('are the triads on the first, fourth and fifth degrees: C, F and G in C major', () => {
      const main = chordsOfScale(cMajor, { primaryOnly: true });
      expect(main.map((c) => c.symbol)).toEqual(['C', 'F', 'G']);
      expect(main.every((c) => c.primary)).toBe(true);
      expect(chordsOfScale(cMajor).filter((c) => c.primary).map((c) => c.symbol)).toEqual(['C', 'F', 'G']);
    });

    it('are i, iv and v in natural minor, and i, iv and V in harmonic minor', () => {
      expect(symbols(spellScale(9, 'natural-minor'), { primaryOnly: true })).toEqual(['Am', 'Dm', 'Em']);
      expect(symbols(spellScale(9, 'harmonic-minor'), { primaryOnly: true })).toEqual(['Am', 'Dm', 'E']);
    });

    it('follow the mode: i, IV and v in Dorian', () => {
      expect(symbols(spellScale(2, 'dorian'), { primaryOnly: true })).toEqual(['Dm', 'G', 'Am']);
    });
  });

  describe('in the scales that are not major or minor', () => {
    it('finds the augmented triads of the whole tone scale, and only those', () => {
      const triads = chordsOfScale(spellScale(0, 'whole-tone'), { families: ['triad'] });
      expect(new Set(triads.map((c) => c.def.id))).toEqual(new Set(['aug']));
      expect(triads.length).toBeGreaterThan(0);
    });

    it('finds the diminished seventh chords of the diminished scale', () => {
      const chords = chordsOfScale(spellScale(0, 'diminished-wh'), { families: ['seventh'] });
      expect(chords.some((c) => c.def.id === 'dim7')).toBe(true);
    });

    it('works on a scale with five notes: a power chord needs the fifth to be in the scale too', () => {
      expect(symbols(spellScale(0, 'pentatonic-major'), { families: ['power'] })).toEqual(['C5', 'D5', 'G5', 'A5']); // no E5: B is not there
    });
  });

  describe('the Persian modes: chords are built only from notes of the piano', () => {
    it('leaves out the quarter-tone notes as roots, and every chord that would need one', () => {
      const shur = spellScale('D', 'shur'); // D Ek F G A Bb C
      const triads = chordsOfScale(shur, { families: ['triad'] });
      expect(triads.map((c) => c.symbol)).toEqual(['Dm', 'F', 'Gm', 'Bb']);
      expect(triads.map((c) => c.degree)).toEqual([1, 3, 4, 6]);
      expect(triads.map((c) => c.roman)).toEqual(['i', '♭III', 'iv', '♭VI']);
      for (const chord of chordsOfScale(shur)) for (const note of chord.notes) expect(note, chord.symbol).not.toMatch(/[ko]$/);
    });

    it('does the same when the root is itself a quarter tone', () => {
      const segah = spellScale('Ek', 'segah'); // Ek F G Ak Bb C D
      expect(symbols(segah, { families: ['triad'] })).toEqual(['Gm', 'Bb']);
      expect(chordsOfScale(segah, { families: ['triad'] }).map((c) => c.roman)).toEqual(['kiii', 'kV']);
    });

    it('has main chords where the root and the fourth or fifth above it are notes of the piano', () => {
      expect(symbols(spellScale('D', 'shur'), { primaryOnly: true })).toEqual(['Dm', 'Gm']);
    });

    it('gives a mode with no quarter tone in it chords like any other (Mahur is the major scale)', () => {
      expect(symbols(spellScale('C', 'mahur'), { families: ['triad'] })).toEqual(['C', 'Dm', 'Em', 'F', 'G', 'Am', 'Bdim']);
    });
  });

  it('writes the notes of a chord the way harmony does, which can differ from the scale', () => {
    // B diminished seventh is B D F A flat, though the C major scale has no A flat: the chord is not in the scale
    expect(symbols(cMajor, { families: ['seventh'] })).not.toContain('Bdim7');
    // A harmonic minor has G sharp, and a diminished seventh chord is the same four notes from each of them: B D F G sharp
    const dim7s = chordsOfScale(spellScale(9, 'harmonic-minor'), { families: ['seventh'] }).filter((c) => c.def.id === 'dim7');
    expect(dim7s.map((c) => c.symbol)).toEqual(['Bdim7', 'Ddim7', 'Fdim7', 'G#dim7']);
    expect(dim7s.find((c) => c.symbol === 'G#dim7')).toMatchObject({ notes: ['G#', 'B', 'D', 'F'], roman: 'vii°7' });
    // from B it is written B D F A flat: harmony spells a diminished seventh above its root, whatever the scale calls the note
    expect(dim7s.find((c) => c.symbol === 'Bdim7')).toMatchObject({ notes: ['B', 'D', 'F', 'Ab'], roman: 'ii°7' });
  });
});

describe('inversionsOf', () => {
  const [c] = chordsOfScale(spellScale(0, 'major'), { families: ['triad'] });

  it('gives each turn of a chord, with the lowest note named after a slash', () => {
    const [first, second] = inversionsOf(c);
    expect(first).toMatchObject({ symbol: 'C/E', notes: ['E', 'G', 'C'], inversion: 1, bass: 'E', root: 'C', degree: 1, roman: 'I' });
    expect(second).toMatchObject({ symbol: 'C/G', notes: ['G', 'C', 'E'], inversion: 2, bass: 'G' });
    expect(inversionsOf(c)).toHaveLength(2);
  });

  it('gives one inversion for each note but the root: three for a seventh chord, one for a power chord', () => {
    const seventh = chordsOfScale(spellScale(0, 'major'), { families: ['seventh'] })[0];
    expect(inversionsOf(seventh).map((i) => i.symbol)).toEqual(['Cmaj7/E', 'Cmaj7/G', 'Cmaj7/B']);
    const power = chordsOfScale(spellScale(0, 'major'), { families: ['power'] })[0];
    expect(inversionsOf(power).map((i) => i.symbol)).toEqual(['C5/G']);
  });

  it('keeps the chord it was made from, and is the root position again after as many turns as it has notes', () => {
    const [first] = inversionsOf(c);
    expect(first.def).toBe(getChord('major'));
    expect(c.inversion).toBe(0);
    expect(c.bass).toBeUndefined();
  });
});

describe('rootPositionOf', () => {
  const c = chordsOfScale(spellScale(0, 'major'), { families: ['triad'] })[0];

  it('gives a chord in root position back as it is', () => {
    expect(rootPositionOf(c)).toBe(c);
  });

  it('puts a turned chord back: C over G is C, E, G again', () => {
    const [, second] = inversionsOf(c);
    expect(rootPositionOf(second)).toMatchObject({ symbol: 'C', notes: ['C', 'E', 'G'], inversion: 0, bass: undefined });
  });

  it('lets any turn give every turn of the chord', () => {
    const seventh = chordsOfScale(spellScale(0, 'major'), { families: ['seventh'] })[0];
    const third = inversionsOf(seventh)[2];
    expect(inversionsOf(third).map((i) => i.symbol)).toEqual(['Cmaj7/E', 'Cmaj7/G', 'Cmaj7/B']);
  });
});
