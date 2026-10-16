import * as Tone from 'tone';

export interface ClickParams {
  pitch: string;
  volumeDb: number;
  velocity: number;
}

/** Subdivision clicks sit 18 dB below the beat click. */
const SUB_CLICK_VELOCITY = Math.pow(10, -18 / 20);

/** What one click sounds like: a high G on the beat, a quiet low C on the 16th-note subdivisions. */
export function clickParams(subdivisionInBeat: number, volumeDb: number): ClickParams {
  if (subdivisionInBeat === 0) return { pitch: 'G5', volumeDb: volumeDb - 6, velocity: 1 };
  return { pitch: 'C5', volumeDb: volumeDb - 6, velocity: SUB_CLICK_VELOCITY };
}

/**
 * The metronome sound. One synth is created on the first click and reused, instead of building and
 * disposing a synth for every 16th note. Clicks are scheduled at the time Tone.js hands to the
 * Transport callback, so they land on the beat even if the callback runs a little early or late.
 */
export class ClickVoice {
  private synth: Tone.PolySynth | null = null;

  play(subdivisionInBeat: number, volumeDb: number, time?: number): void {
    const params = clickParams(subdivisionInBeat, volumeDb);
    if (!this.synth) {
      this.synth = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'sine' },
        envelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.05 },
      }).toDestination();
      this.synth.maxPolyphony = 4;
    }
    this.synth.volume.value = params.volumeDb;
    this.synth.triggerAttackRelease(params.pitch, '32n', time, params.velocity);
  }

  dispose(): void {
    this.synth?.dispose();
    this.synth = null;
  }
}
