import type { MidiNote, MidiSongSpec } from './midiExport';

const DEFAULT_BPM = 90;

/**
 * A chord as a small MIDI file: its notes one after the other from the bottom up, a beat each, and then all together
 * for a whole bar. `pitches` are note names with their octave (`Bb3`), the lowest first.
 */
export function chordMidiSpec(title: string, pitches: readonly string[], bpm = DEFAULT_BPM): MidiSongSpec {
  const notes: MidiNote[] = pitches.map((pitch, i) => ({ pitch, startBeat: i, beats: 1 }));
  const together = pitches.length;
  for (const pitch of pitches) notes.push({ pitch, startBeat: together, beats: 4 });
  return { title, bpm, meter: [4, 4], tracks: [{ name: title, program: 0, channel: 0, notes }] };
}
