import { describe, it, expect } from 'vitest';
import { scaleOf, type ScaleType } from '../scales/scaleData';
import { parseNoteName, parsePitch, pianoMidi, pitchMidi } from '../theory/pitch';
import { SCALES, scalesOfCategory, type ScaleId } from '../theory/scaleCatalog';
import { ascendFrom, spellAbove, spellScale } from '../theory/spell';

describe('spellScale: the notes', () => {
  it('writes C major with no signs, from C4 up to C5', () => {
    const scale = spellScale(0, 'major');
    expect(scale.root).toBe('C');
    expect(scale.names).toEqual(['C', 'D', 'E', 'F', 'G', 'A', 'B']);
    expect(scale.pitches).toEqual(['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5']);
    expect(scale.offsets).toEqual([0, 2, 4, 5, 7, 9, 11]);
    expect(scale.fifths).toBe(0);
    expect(scale.hasQuarterTones).toBe(false);
  });

  it('starts in the octave it is given', () => {
    expect(spellScale(0, 'major', 3).pitches[0]).toBe('C3');
    expect(spellScale(0, 'major', 3).pitches.at(-1)).toBe('C4');
  });

  it('puts a note in the next octave when the letters come round again', () => {
    expect(spellScale(11, 'major').pitches).toEqual(['B4', 'C#5', 'D#5', 'E5', 'F#5', 'G#5', 'A#5', 'B5']);
  });

  it('chooses the spelling of the root with the fewest signs, and never a double sign when another will do', () => {
    expect(spellScale(1, 'major').root).toBe('Db'); // five flats, not seven sharps
    expect(spellScale(3, 'major').root).toBe('Eb');
    expect(spellScale(6, 'major').root).toBe('F#'); // six and six: the first one listed
    expect(spellScale(8, 'harmonic-minor').root).toBe('Ab'); // G sharp would need F double sharp
    expect(spellScale(8, 'harmonic-minor').names).toEqual(['Ab', 'Bb', 'Cb', 'Db', 'Eb', 'Fb', 'G']);
  });

  it('writes the scales that have more or fewer than seven notes', () => {
    expect(spellScale(0, 'pentatonic-major').names).toEqual(['C', 'D', 'E', 'G', 'A']);
    expect(spellScale(0, 'pentatonic-minor').names).toEqual(['C', 'Eb', 'F', 'G', 'Bb']);
    expect(spellScale(0, 'blues').names).toEqual(['C', 'Eb', 'F', 'Gb', 'G', 'Bb']);
    expect(spellScale(0, 'whole-tone').names).toEqual(['C', 'D', 'E', 'F#', 'G#', 'Bb']);
    expect(spellScale(0, 'diminished-wh').names).toEqual(['C', 'D', 'Eb', 'F', 'Gb', 'Ab', 'A', 'B']);
    expect(spellScale(0, 'diminished-hw').names).toEqual(['C', 'Db', 'Eb', 'E', 'F#', 'G', 'A', 'Bb']);
    expect(spellScale(0, 'chromatic').names).toEqual(['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']);
    expect(spellScale(0, 'diminished-wh').pitches).toHaveLength(9); // the eight notes and the root again
  });

  it('keeps the pitches rising, a whole octave apart from end to end', () => {
    for (const scale of SCALES) {
      for (let pc = 0; pc < 12; pc++) {
        const spelled = spellScale(pc, scale.id);
        const midis = spelled.pitches.map((p) => pitchMidi(parsePitch(p)!));
        for (let i = 1; i < midis.length; i++) expect(midis[i], `${scale.id} ${spelled.root}`).toBeGreaterThan(midis[i - 1]);
        expect(midis.at(-1)! - midis[0], `${scale.id} ${spelled.root}`).toBe(12);
        expect(spelled.names, scale.id).toHaveLength(scale.formula.split(' ').length);
      }
    }
  });

  it('never needs more than a double sign, and a quarter tone only where the formula has one', () => {
    for (const scale of SCALES) {
      const quarterInFormula = /[ko]\d/.test(scale.formula);
      for (let pc = 0; pc < 12; pc++) {
        const spelled = spellScale(pc, scale.id);
        for (const name of spelled.names) expect(parseNoteName(name), `${scale.id} ${spelled.root}: ${name}`).not.toBeNull();
        expect(spelled.hasQuarterTones, scale.id).toBe(quarterInFormula);
      }
    }
  });

  it('writes a double sign only when no spelling of the root avoids one', () => {
    // the ways a root can be written, as the screen has always offered them
    const SPELLINGS: Record<number, string[]> = { 0: ['C', 'B#'], 1: ['C#', 'Db'], 2: ['D'], 3: ['D#', 'Eb'], 4: ['E', 'Fb'], 5: ['F', 'E#'], 6: ['F#', 'Gb'], 7: ['G'], 8: ['G#', 'Ab'], 9: ['A'], 10: ['A#', 'Bb'], 11: ['B', 'Cb'] };
    const doubles = (names: string[]) => names.some((n) => /##|bb/.test(n.slice(1)));
    const doublesOrImpossible = (root: string, id: ScaleId) => {
      try {
        return doubles(spellScale(root, id).names);
      } catch {
        return true; // it would need a triple sign
      }
    };
    for (const scale of scalesOfCategory('church').concat(scalesOfCategory('minor'), scalesOfCategory('major'))) {
      for (let pc = 0; pc < 12; pc++) {
        if (!doubles(spellScale(pc, scale.id).names)) continue;
        for (const root of SPELLINGS[pc]) expect(doublesOrImpossible(root, scale.id), `${scale.id} on ${root}`).toBe(true);
      }
    }
  });

  it('has one such case that cannot be helped: double harmonic major on G sharp or A flat', () => {
    expect(spellScale(8, 'double-harmonic-major').names.some((n) => /##|bb/.test(n.slice(1)))).toBe(true);
  });
});

describe('spellScale: key signatures', () => {
  it('gives the key signature of the modes of the major scale', () => {
    expect(spellScale(0, 'major').fifths).toBe(0);
    expect(spellScale(1, 'major').fifths).toBe(-5);
    expect(spellScale(7, 'major').fifths).toBe(1);
    expect(spellScale(9, 'natural-minor').fifths).toBe(0);
    expect(spellScale(4, 'natural-minor').fifths).toBe(1);
    expect(spellScale(2, 'dorian').fifths).toBe(0); // D dorian is the white keys
    expect(spellScale(7, 'mixolydian').fifths).toBe(0);
    expect(spellScale(0, 'lydian').fifths).toBe(1); // C lydian has the key signature of G major
    expect(spellScale(4, 'phrygian').fifths).toBe(0);
    expect(spellScale(11, 'locrian').fifths).toBe(0);
    expect(spellScale(2, 'phrygian').fifths).toBe(-2);
  });

  it('gives none for a scale that is not a mode of the major scale', () => {
    for (const id of ['harmonic-minor', 'melodic-minor', 'harmonic-major', 'pentatonic-major', 'blues', 'chromatic', 'whole-tone'] as ScaleId[]) {
      expect(spellScale(0, id).fifths, id).toBeNull();
    }
  });

  it('gives none for any Persian mode, even Mahur, which has the notes of the major scale', () => {
    for (const scale of scalesOfCategory('persian')) expect(spellScale(0, scale.id).fifths, scale.id).toBeNull();
    expect(spellScale('C', 'mahur').names).toEqual(['C', 'D', 'E', 'F', 'G', 'A', 'B']);
  });
});

describe('spellScale: the Persian modes', () => {
  it('writes Shur on D as D, E koron, F, G, A, B flat, C', () => {
    const shur = spellScale('D', 'shur');
    expect(shur.names).toEqual(['D', 'Ek', 'F', 'G', 'A', 'Bb', 'C']);
    expect(shur.pitches).toEqual(['D4', 'Ek4', 'F4', 'G4', 'A4', 'Bb4', 'C5', 'D5']);
    expect(shur.offsets).toEqual([0, 1.5, 3, 5, 7, 8, 10]);
    expect(shur.hasQuarterTones).toBe(true);
  });

  it('writes Segah on E koron, the way it is taught', () => {
    const segah = spellScale('Ek', 'segah');
    expect(segah.root).toBe('Ek');
    expect(segah.names).toEqual(['Ek', 'F', 'G', 'Ak', 'Bb', 'C', 'D']);
    expect(segah.pitches).toEqual(['Ek4', 'F4', 'G4', 'Ak4', 'Bb4', 'C5', 'D5', 'Ek5']);
    expect(segah.offsets).toEqual([0, 1.5, 3.5, 5, 6.5, 8.5, 10.5]);
  });

  it('writes Chahargah, Homayun and Nava as the table says', () => {
    expect(spellScale('C', 'chahargah').names).toEqual(['C', 'Dk', 'E', 'F', 'G', 'Ak', 'B']);
    expect(spellScale('G', 'homayun').names).toEqual(['G', 'Ak', 'B', 'C', 'D', 'Eb', 'F']);
    expect(spellScale('G', 'nava').names).toEqual(['G', 'A', 'Bb', 'C', 'D', 'Ek', 'F']);
  });

  it('can be built on any of the twelve notes, with a quarter tone where the mode has one', () => {
    expect(spellScale(0, 'shur').names).toEqual(['C', 'Dk', 'Eb', 'F', 'G', 'Ab', 'Bb']);
    expect(spellScale('E', 'segah').names).toEqual(['E', 'Fo', 'Go', 'A', 'Bk', 'Co', 'Do']);
  });

  it('can be built on its own first root, whatever the root is', () => {
    for (const scale of scalesOfCategory('persian')) {
      const spelled = spellScale(scale.persian!.defaultRoot, scale.id);
      expect(spelled.root).toBe(scale.persian!.defaultRoot);
      expect(spelled.names[0]).toBe(scale.persian!.defaultRoot);
    }
  });

  it('writes a note three quarter tones from its letter from the next letter, since there is no sign for that', () => {
    // On E flat the fifth of Segah is 1.5 below B (B flat koron): it is written A sori, the same pitch
    const segah = spellScale('Eb', 'segah');
    expect(segah.names).toEqual(['Eb', 'Fk', 'Gk', 'Ab', 'Ao', 'Ck', 'Dk']);
    const midis = segah.pitches.map((p) => pitchMidi(parsePitch(p)!));
    expect(midis).toEqual([63, 64.5, 66.5, 68, 69.5, 71.5, 73.5, 75]);
  });

  it('plays a quarter tone on the key of its own letter', () => {
    const keys = spellScale('Ek', 'segah').pitches.map((p) => pianoMidi(parsePitch(p)!));
    expect(keys).toEqual([64, 65, 67, 69, 70, 72, 74, 76]); // E F G A Bb C D E
  });
});

describe('spellScale: the root', () => {
  it('takes a root as it is written, without choosing another spelling', () => {
    expect(spellScale('C#', 'major').names).toEqual(['C#', 'D#', 'E#', 'F#', 'G#', 'A#', 'B#']);
    expect(spellScale('C#', 'major').fifths).toBe(7);
    expect(spellScale('Gb', 'major').fifths).toBe(-6);
  });

  it('refuses a root that is not a note name', () => {
    for (const bad of ['', 'H', 'C4', 'c', 'Cbbb', 'major']) expect(() => spellScale(bad, 'major'), bad).toThrow();
    expect(() => spellScale(12, 'major')).toThrow();
    expect(() => spellScale(-1, 'major')).toThrow();
    expect(() => spellScale(1.5, 'major')).toThrow();
  });

  it('writes a root that needs double signs throughout, and says so when it would need a triple sign', () => {
    expect(spellScale('F##', 'major').names).toEqual(['F##', 'G##', 'A##', 'B#', 'C##', 'D##', 'E##']);
    expect(() => spellScale('G##', 'major')).toThrow(/G##/); // its seventh would be F triple sharp
  });
});

describe('spellScale: the six scales the screen has always had', () => {
  const LEGACY: ReadonlyArray<readonly [ScaleType, ScaleId]> = [
    ['major', 'major'],
    ['minor', 'natural-minor'],
    ['harmonic', 'harmonic-minor'],
    ['melodic', 'melodic-minor'],
    ['pentaMajor', 'pentatonic-major'],
    ['pentaMinor', 'pentatonic-minor'],
  ];

  it.each(LEGACY)('%s is written as before, on every note', (legacyType, id) => {
    for (let pc = 0; pc < 12; pc++) {
      const old = scaleOf(pc, legacyType);
      const spelled = spellScale(pc, id);
      expect(spelled.root, `${id} ${pc}`).toBe(old.root);
      expect(spelled.pitches, `${id} ${pc}`).toEqual(old.notes);
      expect(spelled.fifths, `${id} ${pc}`).toBe(old.fifths);
    }
  });
});

describe('ascendFrom', () => {
  it('puts each note in the first octave that lies above the one before', () => {
    expect(ascendFrom(['C', 'E', 'G'])).toEqual(['C4', 'E4', 'G4']);
    expect(ascendFrom(['A', 'C', 'E'])).toEqual(['A4', 'C5', 'E5']);
    expect(ascendFrom(['G', 'B', 'D', 'F', 'A'], 3)).toEqual(['G3', 'B3', 'D4', 'F4', 'A4']);
  });

  it('counts a flat C as the key below, and a quarter tone as it sounds', () => {
    expect(ascendFrom(['Ab', 'Cb', 'Eb'])).toEqual(['Ab4', 'Cb5', 'Eb5']);
    expect(ascendFrom(['Dk', 'F', 'Ao'])).toEqual(['Dk4', 'F4', 'Ao4']);
  });

  it('is empty for nothing', () => {
    expect(ascendFrom([])).toEqual([]);
  });
});

describe('spellAbove', () => {
  it('names the notes that lie above a root by so many letters and semitones', () => {
    expect(spellAbove('C', [{ letterSteps: 0, semitones: 0 }, { letterSteps: 2, semitones: 4 }, { letterSteps: 4, semitones: 7 }])).toEqual(['C', 'E', 'G']);
    expect(spellAbove('Bb', [{ letterSteps: 2, semitones: 4 }])).toEqual(['D']);
    expect(spellAbove('Eb', [{ letterSteps: 2, semitones: 3 }, { letterSteps: 4, semitones: 7 }])).toEqual(['Gb', 'Bb']);
    expect(spellAbove('B', [{ letterSteps: 6, semitones: 9 }])).toEqual(['Ab']); // a diminished seventh
    expect(spellAbove('Ek', [{ letterSteps: 1, semitones: 1.5 }])).toEqual(['F']);
  });

  it('counts steps beyond the octave, for ninths and thirteenths', () => {
    expect(spellAbove('C', [{ letterSteps: 8, semitones: 14 }, { letterSteps: 12, semitones: 21 }])).toEqual(['D', 'A']);
  });

  it('gives nothing when a note would need more than a double sign', () => {
    expect(spellAbove('G##', [{ letterSteps: 6, semitones: 11 }])).toBeNull(); // F triple sharp
    expect(spellAbove('G##', [{ letterSteps: 2, semitones: 4 }])).toEqual(['B##']); // two signs are still fine
  });

  it('refuses a root with an octave or that is not a note', () => {
    expect(() => spellAbove('C4', [])).toThrow();
    expect(() => spellAbove('x', [])).toThrow();
  });
});
