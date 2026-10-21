import { describe, expect, it } from 'vitest';
import { seededRng } from '../core/rng';
import { generateMelody, melodyTokens, type Contour, type MelodyOptions } from '../generator/melody';
import { generateProgression } from '../generator/progression';
import { METERS, METER_IDS, rhythmBar, UNIT_TOKEN, type Density, type RhythmFeel } from '../generator/rhythmCells';
import { buildDraft } from '../songs/songMaker';
import { parseNoteName, parsePitch, pianoMidi } from '../theory/pitch';
import { SCALES } from '../theory/scaleCatalog';
import { spellScale } from '../theory/spell';

const cMajor = spellScale(0, 'major');
const DENSITIES: Density[] = ['sparse', 'medium', 'dense'];
const FEELS: RhythmFeel[] = ['straight', 'syncopated', 'dotted'];
const sum = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0);

const base = (overrides: Partial<MelodyOptions> = {}): MelodyOptions => ({
  scale: cMajor,
  bars: 8,
  meter: '4/4',
  density: 'medium',
  feel: 'straight',
  contour: 'arch',
  range: 'medium',
  octave: 4,
  seed: 1,
  ...overrides,
});

const keyOf = (pitch: string): number => pianoMidi(parsePitch(pitch)!);
const nameOf = (pitch: string): string => pitch.replace(/-?\d+$/, '');
const isQuarter = (pitch: string): boolean => /[ko]-?\d+$/.test(pitch);

describe('the meters', () => {
  it('are 2/4, 3/4, 4/4 and 6/8, counted in sixteenths', () => {
    expect(METER_IDS).toEqual(['2/4', '3/4', '4/4', '6/8']);
    expect(METERS['2/4']).toMatchObject({ beats: 2, beatType: 4, units: 8 });
    expect(METERS['3/4']).toMatchObject({ beats: 3, beatType: 4, units: 12 });
    expect(METERS['4/4']).toMatchObject({ beats: 4, beatType: 4, units: 16 });
    expect(METERS['6/8']).toMatchObject({ beats: 6, beatType: 8, units: 12 });
  });

  it('name every length they use with the notation of the songs', () => {
    expect(UNIT_TOKEN).toEqual({ 16: 'w', 12: 'h.', 8: 'h', 6: 'q.', 4: 'q', 3: 'e.', 2: 'e', 1: 's' });
  });
});

describe('rhythmBar', () => {
  it('fills a bar exactly, in every meter, density and feel', () => {
    for (const meter of METER_IDS) {
      for (const density of DENSITIES) {
        for (const feel of FEELS) {
          const rng = seededRng(7);
          for (let i = 0; i < 80; i++) {
            const bar = rhythmBar(meter, density, feel, rng);
            expect(sum(bar), `${meter} ${density} ${feel} ${bar}`).toBe(METERS[meter].units);
            for (const d of bar) expect(Object.keys(UNIT_TOKEN).map(Number)).toContain(d);
          }
        }
      }
    }
  });

  it('never lets a note cross the pulse unless it starts on a pulse and is a whole number of them', () => {
    for (const meter of METER_IDS) {
      const pulse = meter === '6/8' ? 6 : 4;
      const rng = seededRng(3);
      for (let i = 0; i < 200; i++) {
        let at = 0;
        const feel = FEELS[i % 3];
        for (const d of rhythmBar(meter, DENSITIES[i % 3], feel, rng)) {
          const inside = (at % pulse) + d <= pulse;
          const whole = at % pulse === 0 && d % pulse === 0;
          // the one other thing: a syncopation in a meter of quarters, an eighth, then a note over the beat
          const syncopation = feel === 'syncopated' && pulse === 4 && at % 4 === 2 && (d === 4 || d === 6);
          // and the dotted quarter on the beat, which the eighth after it completes
          const dotted = pulse === 4 && at % 4 === 0 && d === 6;
          expect(inside || whole || syncopation || dotted, `${meter} at ${at} length ${d}`).toBe(true);
          at += d;
        }
      }
    }
  });

  it('writes sixteenths in pairs, or one after a dotted eighth', () => {
    const rng = seededRng(9);
    for (let i = 0; i < 300; i++) {
      const bar = rhythmBar('4/4', 'dense', 'straight', rng);
      // a dotted eighth is always followed by its sixteenth, and the others come two at a time
      const sixteenths = bar.filter((d) => d === 1).length;
      const dotted = bar.filter((d) => d === 3).length;
      expect((sixteenths - dotted) % 2, `${bar}`).toBe(0);
      bar.forEach((d, k) => {
        if (d === 3) expect(bar[k + 1], `${bar}`).toBe(1);
      });
    }
  });

  it('has more notes when the density is higher', () => {
    const rng = seededRng(5);
    const count = (density: Density) => Array.from({ length: 200 }, () => rhythmBar('4/4', density, 'straight', rng).length).reduce((a, b) => a + b, 0);
    const sparse = count('sparse');
    const medium = count('medium');
    const dense = count('dense');
    expect(sparse).toBeLessThan(medium);
    expect(medium).toBeLessThan(dense);
  });

  it('makes a dotted feel dotted: dotted quarters and dotted eighths turn up', () => {
    const rng = seededRng(2);
    const bars = Array.from({ length: 200 }, () => rhythmBar('4/4', 'medium', 'dotted', rng));
    expect(bars.flat().filter((d) => d === 6 || d === 3).length).toBeGreaterThan(50);
    const straight = Array.from({ length: 200 }, () => rhythmBar('4/4', 'medium', 'straight', rng));
    expect(straight.flat().filter((d) => d === 3).length).toBeLessThan(bars.flat().filter((d) => d === 3).length);
  });

  it('is the same for the same seed', () => {
    expect(rhythmBar('3/4', 'medium', 'straight', seededRng(4))).toEqual(rhythmBar('3/4', 'medium', 'straight', seededRng(4)));
  });
});

describe('generateMelody: the bars', () => {
  it('has the bars asked for, each as long as the meter says', () => {
    for (const meter of METER_IDS) {
      for (const bars of [1, 2, 4, 8, 16]) {
        const melody = generateMelody(base({ meter, bars }));
        expect(melody.bars).toHaveLength(bars);
        melody.bars.forEach((bar, i) => expect(sum(bar.map((n) => n.units)), `${meter} bar ${i + 1}`).toBe(METERS[meter].units));
      }
    }
  });

  it('is the same for the same options, and different for another seed', () => {
    const a = melodyTokens(generateMelody(base({ seed: 5 })));
    expect(melodyTokens(generateMelody(base({ seed: 5 })))).toBe(a);
    const others = [1, 2, 3, 4, 6].map((seed) => melodyTokens(generateMelody(base({ seed }))));
    expect(new Set(others).size).toBeGreaterThan(3);
  });

  it('ends on the tonic, held through the whole last bar', () => {
    for (const meter of METER_IDS) {
      for (let seed = 1; seed <= 20; seed++) {
        const last = generateMelody(base({ meter, seed })).bars.at(-1)!;
        expect(last, `${meter} ${seed}`).toHaveLength(1);
        expect(nameOf(last[0].pitch!)).toBe('C');
        expect(last[0].units).toBe(METERS[meter].units);
      }
    }
  });

  it('starts with a note, never a rest', () => {
    for (let seed = 1; seed <= 30; seed++) expect(generateMelody(base({ seed })).bars[0][0].pitch).not.toBeNull();
  });

  it('leads into the end: the last note before the tonic is a step or two away from it', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const melody = generateMelody(base({ seed, bars: 4 }));
      const penultimate = melody.bars.at(-2)!.at(-1)!;
      expect(penultimate.pitch).not.toBeNull();
      const distance = Math.abs(keyOf(penultimate.pitch!) - keyOf(melody.bars.at(-1)![0].pitch!));
      expect(distance, `${seed}`).toBeGreaterThan(0);
      expect(distance).toBeLessThanOrEqual(4);
    }
  });
});

describe('generateMelody: the pitches', () => {
  it('uses only the notes of the scale, from the octave asked for', () => {
    for (const octave of [3, 4, 5] as const) {
      const melody = generateMelody(base({ octave, seed: 8 }));
      for (const note of melody.bars.flat()) {
        if (note.pitch === null) continue;
        expect(cMajor.names).toContain(nameOf(note.pitch));
        expect(keyOf(note.pitch)).toBeGreaterThanOrEqual(12 * (octave + 1));
      }
    }
  });

  it('keeps inside the range: an octave when narrow, two when wide', () => {
    const spread = (range: 'narrow' | 'wide') => {
      let widest = 0;
      for (let seed = 1; seed <= 20; seed++) {
        const keys = generateMelody(base({ range, seed })).bars.flat().filter((n) => n.pitch).map((n) => keyOf(n.pitch!));
        widest = Math.max(widest, Math.max(...keys) - Math.min(...keys));
      }
      return widest;
    };
    expect(spread('narrow')).toBeLessThanOrEqual(12);
    expect(spread('wide')).toBeLessThanOrEqual(24);
    expect(spread('wide')).toBeGreaterThan(12);
  });

  it('follows the contour: it climbs when rising and comes down when falling', () => {
    const half = (contour: Contour, seed: number) => {
      const keys = generateMelody(base({ contour, seed, bars: 8, range: 'wide' })).bars.slice(0, -1).map((bar) => {
        const ks = bar.filter((n) => n.pitch).map((n) => keyOf(n.pitch!));
        return sum(ks) / ks.length;
      });
      const mid = Math.floor(keys.length / 2);
      return sum(keys.slice(mid)) / (keys.length - mid) - sum(keys.slice(0, mid)) / mid;
    };
    let rising = 0;
    let falling = 0;
    for (let seed = 1; seed <= 20; seed++) {
      rising += half('rising', seed);
      falling += half('falling', seed);
    }
    expect(rising / 20).toBeGreaterThan(2);
    expect(falling / 20).toBeLessThan(-2);
  });

  it('puts the first, third and fifth of the scale on the strong beats when there is no progression', () => {
    for (const meter of METER_IDS) {
      for (let seed = 1; seed <= 15; seed++) {
        const melody = generateMelody(base({ meter, seed }));
        // the last two bars are the ending: a step to the tonic, then the tonic
        melody.bars.slice(0, -2).forEach((bar) => {
          for (const note of bar) {
            if (!note.pitch || !METERS[meter].strong.includes(note.start)) continue;
            expect([0, 2, 4], `${meter} ${seed} ${note.pitch}`).toContain(cMajor.names.indexOf(nameOf(note.pitch)));
          }
        });
      }
    }
  });

  it('puts a note of the sounding chord on the strong beats when there is a progression', () => {
    const progression = generateProgression({ scale: cMajor, style: 'pop', bars: 8, seed: 3 });
    for (let seed = 1; seed <= 15; seed++) {
      const melody = generateMelody(base({ seed, progression }));
      melody.bars.forEach((bar, barIndex) => {
        for (const note of bar) {
          if (!note.pitch || !METERS['4/4'].strong.includes(note.start)) continue;
          const beat = note.start / 4;
          const chord = progression.chords.find((c) => c.bar === barIndex && c.beat <= beat && beat < c.beat + c.beats)!;
          const names = chord.chord.notes.map((n) => keyOf(`${n}4`) % 12);
          expect(names, `${seed} bar ${barIndex + 1} ${note.pitch} over ${chord.chord.symbol}`).toContain(keyOf(note.pitch) % 12);
        }
      });
    }
  });

  it('only puts a progression under 4/4', () => {
    const progression = generateProgression({ scale: cMajor, style: 'pop', bars: 4, seed: 1 });
    expect(() => generateMelody(base({ meter: '3/4', bars: 4, progression }))).toThrow();
    expect(() => generateMelody(base({ bars: 8, progression }))).toThrow();
  });
});

describe('generateMelody: the quarter tones of a Persian mode', () => {
  it('uses them, but never on a strong beat', () => {
    const shur = spellScale('D', 'shur');
    let quarter = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const melody = generateMelody(base({ scale: shur, seed, density: 'dense' }));
      for (const bar of melody.bars) {
        for (const note of bar) {
          if (!note.pitch) continue;
          if (isQuarter(note.pitch)) {
            quarter++;
            expect(METERS['4/4'].strong.includes(note.start), `${note.pitch} at ${note.start}`).toBe(false);
          }
        }
      }
    }
    expect(quarter).toBeGreaterThan(0);
  });
});

describe('melodyTokens: the notation of the songs', () => {
  const grammar = /^(?:(?:[A-G](?:##|bb|[#bnko])?\d(?:\+[A-G](?:##|bb|[#bnko])?\d)*|r)[whqes]\.?)$/;

  it('writes a note and its length, bars between bars', () => {
    const text = melodyTokens(generateMelody(base({ bars: 3 })));
    const bars = text.split(' | ');
    expect(bars).toHaveLength(3);
    for (const token of bars.flatMap((bar) => bar.split(' '))) expect(token).toMatch(grammar);
    expect(bars[2]).toMatch(/^C\dw$/);
  });

  it('is a song the song maker accepts for every scale of the catalog, every meter and many seeds', () => {
    for (const def of SCALES) {
      const roots = def.persian ? [def.persian.defaultRoot] : [0, 1, 6, 10];
      for (const root of roots) {
        let scale;
        try {
          scale = spellScale(root, def.id);
        } catch {
          continue; // a root that needs a triple sign
        }
        for (const meter of METER_IDS) {
          for (const seed of [1, 2, 3]) {
            const melody = generateMelody(base({ scale, meter, seed, bars: 8, density: DENSITIES[seed % 3] }));
            const m = METERS[meter];
            const result = buildDraft({ title: 'Test', fifths: scale.fifths ?? 0, beats: m.beats, ...(m.beatType === 8 ? { beatType: 8 as const } : {}), melody: melodyTokens(melody) });
            expect(result.ok, `${def.id} on ${root} in ${meter}, seed ${seed}: ${JSON.stringify(result)}`).toBe(true);
          }
        }
      }
    }
  });

  it('writes a natural where a sign still in force is cancelled: the chromatic scale has F sharp and F', () => {
    const chromatic = spellScale(0, 'chromatic');
    let natural = false;
    for (let seed = 1; seed <= 80 && !natural; seed++) {
      natural = /[A-G]n\d/.test(melodyTokens(generateMelody(base({ scale: chromatic, seed, bars: 8, density: 'dense' }))));
    }
    expect(natural).toBe(true);
  });
});

describe('parsePitch is the grammar of the notes it makes', () => {
  it('reads every note the generator writes', () => {
    const melody = generateMelody(base({ scale: spellScale('Ek', 'segah'), seed: 4, density: 'dense' }));
    for (const note of melody.bars.flat()) if (note.pitch) expect(parsePitch(note.pitch), note.pitch).not.toBeNull();
    expect(parseNoteName('Ek')).not.toBeNull();
  });
});
