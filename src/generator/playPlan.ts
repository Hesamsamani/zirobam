import { METERS } from './rhythmCells';
import type { GeneratedPiece } from './scoreXml';

/** A note to sound: when it starts and how long it lasts, in seconds from the start of the piece. */
export interface PlannedNote {
  pitch: string;
  at: number;
  seconds: number;
}

export interface PlayPlan {
  notes: PlannedNote[];
  /** When each bar starts, in seconds. */
  barStarts: number[];
  /** How long the piece lasts, in seconds. */
  total: number;
}

/** A note is let go a little before the next begins, so that a repeated note is heard twice. */
const LET_GO = 0.92;
const SHORTEST = 0.15;

/** Everything a piece sounds, with its times: the chords, the bass line and the tune. */
export function planPlayback(piece: GeneratedPiece): PlayPlan {
  const beat = 60 / piece.bpm;
  const bars = piece.melody ? piece.melody.bars.length : (piece.progression?.bars ?? 0);
  const barBeats = METERS[piece.meter].units / 4;
  const notes: PlannedNote[] = [];
  const add = (pitch: string, startBeat: number, beats: number): void => {
    notes.push({ pitch, at: startBeat * beat, seconds: Math.max(SHORTEST, beats * beat * LET_GO) });
  };

  for (const chord of piece.progression?.chords ?? []) {
    const start = chord.bar * 4 + chord.beat;
    for (const pitch of chord.voicing) add(pitch, start, chord.beats);
    add(chord.bass, start, chord.beats);
  }
  piece.melody?.bars.forEach((bar, index) => {
    for (const note of bar) if (note.pitch !== null) add(note.pitch, index * barBeats + note.start / 4, note.units / 4);
  });
  notes.sort((a, b) => a.at - b.at);
  return { notes, barStarts: Array.from({ length: bars }, (_, i) => i * barBeats * beat), total: bars * barBeats * beat };
}
