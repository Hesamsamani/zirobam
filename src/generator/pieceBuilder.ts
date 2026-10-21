import { spellChoice } from '../scales/dictionaryState';
import type { SpelledScale } from '../theory/spell';
import type { GeneratorState } from './generatorState';
import { generateMelody } from './melody';
import { generateProgression } from './progression';
import type { GeneratedPiece } from './scoreXml';

export type BuildResult = { ok: true; piece: GeneratedPiece } | { ok: false; reason: 'noChords' };

/**
 * The piece a state asks for, on a scale: the progression on the Progression tab, the melody on the Melody tab (over
 * the progression, or over the scale alone). The tempo is the one chosen, or the style's, which the seed picks.
 * A progression on a scale that cannot make a chord is a problem to tell the student, not a silent empty piece.
 */
export function buildPieceFor(scale: SpelledScale, state: GeneratorState, title: string): BuildResult {
  const progression = generateProgression({ scale, style: state.style, bars: state.bars, seed: state.seed, bpm: state.bpm ?? undefined });
  const withChords = state.tab !== 'melody' || state.over === 'progression';
  if (withChords && progression.chords.length === 0) return { ok: false, reason: 'noChords' };
  const melody =
    state.tab === 'melody'
      ? generateMelody({
          scale,
          bars: state.bars,
          meter: state.meter,
          density: state.density,
          feel: state.feel,
          contour: state.contour,
          range: state.range,
          octave: state.octave,
          seed: state.seed,
          progression: state.over === 'progression' ? progression : undefined,
        })
      : null;
  return { ok: true, piece: { title, scale, meter: state.tab === 'melody' ? state.meter : '4/4', bpm: progression.bpm, progression: withChords ? progression : null, melody } };
}

/** The piece a state asks for. */
export function buildPiece(state: GeneratorState, title: string): BuildResult {
  return buildPieceFor(spellChoice(state.root, state.scale), state, title);
}
