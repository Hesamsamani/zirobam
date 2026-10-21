export type TrackerEvent = { type: 'on'; midi: number } | { type: 'off'; midi: number };

export interface TrackerOptions {
  /** Frames of the same note before it starts (3). */
  minFrames?: number;
  /** Frames without a note before it stops (4). */
  releaseFrames?: number;
}

/**
 * Turns a stream of pitch frames into notes that start and stop. A frame is the nearest key (a MIDI number) or null for
 * no pitch. A note starts when it has been the same for a few frames, so a blip is no note; it stops after a few frames
 * of nothing, so a gap between two harmonics does not cut it; a new note stops the old one.
 */
export class NoteTracker {
  private readonly minFrames: number;
  private readonly releaseFrames: number;
  private current: number | null = null;
  private candidate: number | null = null;
  private candidateFrames = 0;
  private silent = 0;

  constructor(options: TrackerOptions = {}) {
    this.minFrames = options.minFrames ?? 3;
    this.releaseFrames = options.releaseFrames ?? 4;
  }

  push(midi: number | null): TrackerEvent[] {
    const events: TrackerEvent[] = [];
    if (midi === null) {
      this.candidate = null;
      this.candidateFrames = 0;
      this.silent++;
      if (this.current !== null && this.silent >= this.releaseFrames) {
        events.push({ type: 'off', midi: this.current });
        this.current = null;
      }
      return events;
    }
    this.silent = 0;
    if (midi === this.current) {
      this.candidate = null;
      this.candidateFrames = 0;
      return events;
    }
    if (midi === this.candidate) this.candidateFrames++;
    else {
      this.candidate = midi;
      this.candidateFrames = 1;
    }
    if (this.candidateFrames >= this.minFrames) {
      if (this.current !== null) events.push({ type: 'off', midi: this.current });
      events.push({ type: 'on', midi });
      this.current = midi;
      this.candidate = null;
      this.candidateFrames = 0;
    }
    return events;
  }

  /** Lets go of the note that sounds, if any. */
  reset(): TrackerEvent[] {
    const events: TrackerEvent[] = this.current === null ? [] : [{ type: 'off', midi: this.current }];
    this.current = null;
    this.candidate = null;
    this.candidateFrames = 0;
    this.silent = 0;
    return events;
  }
}
