import type { BandBackend } from '../band/bandPlayer';
import { ChordsView } from '../chords/chordsView';
import type { NoteInputHub } from '../input/noteInput';
import { NoteStats } from '../learn/noteStats';
import { GeneratorView } from '../generator/generatorView';
import type { NotationToolkit } from '../learn/noteCard';
import type { PianoVoice } from '../playback/pianoVoice';
import type { SongDraft } from '../songs/songMaker';
import type { View } from './router';

/** A screen made by a feature module. `main.ts` only loops over these: it knows nothing about what is inside. */
export interface FeatureView {
  readonly id: View;
  readonly element: HTMLElement;
  /** The screen is shown; `param` is the name after it in the address, or null. */
  activate(param: string | null): void;
  deactivate(): void;
  /** The address changed while the screen is open. */
  change(param: string | null): void;
  /** Draws the screen again, for a new language or a new way of writing the notes. */
  refresh(): void;
}

/** What the feature screens take from the app, in one place. */
export interface FeatureDeps {
  newToolkit(): NotationToolkit;
  voice: PianoVoice;
  /** A note name, with or without an octave, as the student has chosen to read it. */
  formatName(note: string): string;
  /** The backing band's sounds. */
  band: BandBackend;
  /** Where the notes the student plays come from. */
  hub: NoteInputHub;
  /** A chord of the chord quiz was answered (for the rewards). */
  onChordAnswer(correct: boolean): void;
  goHome(): void;
  /** Opens a score (MusicXML) on the practice stand. */
  practiseXml(xml: string, title: string): void;
  /** Saves a tune as a song of "Write a song" and opens it there; false when that did not work. */
  openInMaker(draft: SongDraft): Promise<boolean>;
}

/** Builds the feature screens. Each new feature adds a line here and nothing to `main.ts`. */
export function createFeatureViews(deps: FeatureDeps): FeatureView[] {
  return [
    new GeneratorView({
      toolkit: deps.newToolkit(),
      voice: deps.voice,
      band: deps.band,
      formatName: deps.formatName,
      onBack: deps.goHome,
      practise: deps.practiseXml,
      openInMaker: deps.openInMaker,
    }),
    new ChordsView({
      hub: deps.hub,
      formatName: deps.formatName,
      stats: new NoteStats(undefined, 'chords.stats.v1'),
      onBack: deps.goHome,
      onAnswer: (correct) => deps.onChordAnswer(correct),
    }),
  ];
}
