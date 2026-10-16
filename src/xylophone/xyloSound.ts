import * as Tone from 'tone';

/**
 * The sound of a wooden xylophone bar, made by a synthesizer so it needs no download and works offline.
 * A struck bar rings with a strong overtone about a twelfth above the note and dies away quickly, which a
 * small FM synth with a short envelope reproduces well enough to tell the bars apart.
 */
export class XyloSound {
  private synth: Tone.PolySynth<Tone.FMSynth> | null = null;

  play(noteName: string): void {
    // Browsers keep audio locked until a key press or click; this unlocks it
    void Tone.start();
    if (!this.synth) {
      this.synth = new Tone.PolySynth(Tone.FMSynth, {
        harmonicity: 3,
        modulationIndex: 1.2,
        oscillator: { type: 'sine' },
        envelope: { attack: 0.001, decay: 0.3, sustain: 0, release: 0.2 },
        modulation: { type: 'sine' },
        modulationEnvelope: { attack: 0.001, decay: 0.12, sustain: 0, release: 0.1 },
      }).toDestination();
      this.synth.maxPolyphony = 12;
      this.synth.volume.value = -6;
    }
    this.synth.triggerAttackRelease(noteName, '8n', undefined, 0.9);
  }

  dispose(): void {
    this.synth?.dispose();
    this.synth = null;
  }
}
