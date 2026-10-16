/** The piano that the ear exercises and the scale screen listen with. */
export interface PianoVoice {
  /** Loads the sounds; false when they cannot be loaded. */
  ready(): Promise<boolean>;
  play(note: string, seconds: number, startsIn: number): void;
  stopAll(): void;
}
