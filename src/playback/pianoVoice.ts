/** The piano that the ear exercises and the scale screen listen with. */
export interface PianoVoice {
  /** Loads the sounds; false when they cannot be loaded. */
  ready(): Promise<boolean>;
  /** A note name as the app writes it (Bb4, Ek4), or a frequency in Hz. */
  play(note: string | number, seconds: number, startsIn: number): void;
  stopAll(): void;
}
