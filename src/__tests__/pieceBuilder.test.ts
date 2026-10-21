import { describe, expect, it } from 'vitest';
import { DEFAULT_STATE, type GeneratorState } from '../generator/generatorState';
import { buildPiece, buildPieceFor } from '../generator/pieceBuilder';
import { planPlayback } from '../generator/playPlan';
import { barsOfSpec, pieceSpec } from '../generator/scoreXml';
import { STYLES } from '../generator/styles';
import { spellScale } from '../theory/spell';

const state = (overrides: Partial<GeneratorState> = {}): GeneratorState => ({ ...DEFAULT_STATE, ...overrides });
const must = (result: ReturnType<typeof buildPiece>) => {
  if (!result.ok) throw new Error('no piece');
  return result.piece;
};

describe('buildPiece', () => {
  it('makes a progression on the Progression tab, and no melody', () => {
    const piece = must(buildPiece(state({ seed: 3 }), 'C Major'));
    expect(piece.title).toBe('C Major');
    expect(piece.progression?.bars).toBe(8);
    expect(piece.melody).toBeNull();
    expect(piece.meter).toBe('4/4');
  });

  it('makes a melody over the scale on the Melody tab, and no chords', () => {
    const piece = must(buildPiece(state({ tab: 'melody', meter: '3/4', over: 'scale' }), 'x'));
    expect(piece.progression).toBeNull();
    expect(piece.melody?.bars).toHaveLength(8);
    expect(piece.meter).toBe('3/4');
  });

  it('makes a melody over the progression when asked, with the same seed, bars and style', () => {
    const piece = must(buildPiece(state({ tab: 'melody', over: 'progression', seed: 9, bars: 12, style: 'jazz' }), 'x'));
    expect(piece.progression?.bars).toBe(12);
    expect(piece.melody?.bars).toHaveLength(12);
    expect(piece.progression?.style).toBe('jazz');
  });

  it('takes the tempo that was chosen, or the style\'s own', () => {
    expect(must(buildPiece(state({ bpm: 77 }), 'x')).bpm).toBe(77);
    const auto = must(buildPiece(state({ style: 'ballad', seed: 4 }), 'x')).bpm;
    expect(auto).toBeGreaterThanOrEqual(STYLES.ballad.tempo[0]);
    expect(auto).toBeLessThanOrEqual(STYLES.ballad.tempo[1]);
    // the melody alone has the tempo of the style too
    const tune = must(buildPiece(state({ tab: 'melody', style: 'ballad', seed: 4 }), 'x')).bpm;
    expect(tune).toBe(auto);
  });

  it('gives the same piece for the same state', () => {
    const a = must(buildPiece(state({ seed: 21, tab: 'melody', over: 'progression' }), 'x'));
    const b = must(buildPiece(state({ seed: 21, tab: 'melody', over: 'progression' }), 'x'));
    expect(b).toEqual(a);
  });

  it('works on a Persian mode written as it is taught', () => {
    const piece = must(buildPiece(state({ root: 'Ek', scale: 'segah', tab: 'melody', over: 'scale', seed: 2 }), 'x'));
    expect(piece.scale.root).toBe('Ek');
    expect(piece.melody).not.toBeNull();
  });

  it('tells when a progression cannot be made', () => {
    const none = { ...spellScale(0, 'major'), names: [], offsets: [], pitches: [] };
    expect(buildPieceFor(none, state(), 'x')).toEqual({ ok: false, reason: 'noChords' });
    expect(buildPieceFor(none, state({ tab: 'melody', over: 'progression' }), 'x')).toEqual({ ok: false, reason: 'noChords' });
  });
});

describe('planPlayback', () => {
  it('sounds every note of the chords, the bass and the tune, at the time the tempo gives', () => {
    const piece = must(buildPiece(state({ tab: 'melody', over: 'progression', bpm: 120, bars: 4, seed: 5 }), 'x'));
    const plan = planPlayback(piece);
    const chordNotes = piece.progression!.chords.reduce((sum, c) => sum + c.voicing.length + 1, 0);
    const tuneNotes = piece.melody!.bars.flat().filter((n) => n.pitch !== null).length;
    expect(plan.notes).toHaveLength(chordNotes + tuneNotes);
    // 120 beats a minute: a beat is half a second, a bar two seconds
    expect(plan.total).toBe(8);
    expect(plan.barStarts).toEqual([0, 2, 4, 6]);
    expect([...plan.notes].sort((a, b) => a.at - b.at)).toEqual(plan.notes);
    for (const note of plan.notes) {
      expect(note.at).toBeGreaterThanOrEqual(0);
      expect(note.at).toBeLessThan(plan.total);
      expect(note.seconds).toBeGreaterThan(0);
      expect(note.at + note.seconds).toBeLessThanOrEqual(plan.total + 1e-9);
    }
  });

  it('counts a bar of 6/8 as three beats', () => {
    const piece = must(buildPiece(state({ tab: 'melody', meter: '6/8', bpm: 60, bars: 4, seed: 1 }), 'x'));
    const plan = planPlayback(piece);
    expect(plan.barStarts).toEqual([0, 3, 6, 9]);
    expect(plan.total).toBe(12);
  });

  it('starts the last tonic at the start of the last bar and holds it for the bar', () => {
    const piece = must(buildPiece(state({ tab: 'melody', bpm: 120, bars: 4, seed: 6 }), 'x'));
    const last = planPlayback(piece).notes.at(-1)!;
    expect(last.at).toBe(6);
    expect(last.seconds).toBeGreaterThan(1.5);
  });
});

describe('pieceSpec and barsOfSpec', () => {
  it('cuts a long piece into lines of a few bars, in both hands', () => {
    const piece = must(buildPiece(state({ tab: 'melody', over: 'progression', bars: 8, seed: 2 }), 'x'));
    const spec = pieceSpec(piece);
    expect(spec.notes.split(' | ')).toHaveLength(8);
    expect(spec.lower!.split(' | ')).toHaveLength(8);
    const first = barsOfSpec(spec, 0, 4);
    const second = barsOfSpec(spec, 4, 4);
    expect(first.notes.split(' | ')).toHaveLength(4);
    expect(second.lower!.split(' | ')).toHaveLength(4);
    expect(`${first.notes} | ${second.notes}`).toBe(spec.notes);
    expect(second.beats).toBe(spec.beats);
  });

  it('leaves the lower staff alone when there is none', () => {
    expect(barsOfSpec({ clef: 'treble', notes: 'C4w | D4w | E4w' }, 1, 2)).toEqual({ clef: 'treble', notes: 'D4w | E4w', lower: undefined });
  });
});
