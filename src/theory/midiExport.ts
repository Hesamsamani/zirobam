import { Midi } from '@tonejs/midi';
import { isQuarterTone, parsePitch, pianoMidi } from './pitch';

/** One note of a track. Time is counted in beats, which are quarter notes, from the start of the song. */
export interface MidiNote {
  /** A note name as the app writes it (Bb3, Ek4), or a MIDI number (for the drums, which have no pitch). */
  pitch: string | number;
  startBeat: number;
  beats: number;
  /** 0 to 1; 0.8 when left out. */
  velocity?: number;
}

export interface MidiTrackSpec {
  name: string;
  /** 0 to 15, written as 1 to 16 in a player. Percussion always uses channel 9 (10 in a player). */
  channel?: number;
  /** The General MIDI sound, 0 is the acoustic grand piano. */
  program?: number;
  percussion?: boolean;
  notes: MidiNote[];
}

export interface MidiSongSpec {
  title: string;
  bpm: number;
  /** The time signature, for the bar lines of the player: [6, 8]. */
  meter: [number, number];
  tracks: MidiTrackSpec[];
}

const PPQ = 480; // ticks to a quarter note: the library's default, written out here because the maths depends on it
const DEFAULT_VELOCITY = 0.8;
const PERCUSSION_CHANNEL = 9;
/** Players start with a bend range of two semitones either way, so a quarter tone is a quarter of the full bend. */
const BEND_RANGE_SEMITONES = 2;
/**
 * The file counts a bend as a number from -8192 to 8191 around 0. The library hands back that number divided by 8192
 * when it reads a file, but writes the number it is given as it is, so a bend has to be given in these units.
 */
const BEND_UNIT = 8192;

/**
 * The key to strike and the bend to put on it. A quarter tone is struck on the key of its own letter and bent
 * (Ek4 is E4 bent down). The bend is per channel, so a chord with a quarter tone in it would bend all its notes:
 * the app only writes quarter tones into melodies.
 */
function keyOf(pitch: string | number): { key: number; bend: number } {
  if (typeof pitch === 'number') return { key: pitch, bend: 0 };
  const parsed = parsePitch(pitch);
  if (!parsed) throw new Error(`Cannot read the note "${pitch}"`);
  return { key: pianoMidi(parsed), bend: isQuarterTone(parsed) ? Math.round((parsed.alter / BEND_RANGE_SEMITONES) * BEND_UNIT) : 0 };
}

/** The bytes of a standard MIDI file for a song. */
export function buildMidiFile(spec: MidiSongSpec): Uint8Array {
  const midi = new Midi();
  midi.header.name = spec.title;
  midi.header.setTempo(spec.bpm);
  midi.header.timeSignatures.push({ ticks: 0, timeSignature: [spec.meter[0], spec.meter[1]] });
  midi.header.update();

  for (const spec_ of spec.tracks) {
    const track = midi.addTrack();
    track.name = spec_.name;
    track.channel = spec_.percussion ? PERCUSSION_CHANNEL : (spec_.channel ?? 0);
    if (spec_.program !== undefined && !spec_.percussion) track.instrument.number = spec_.program;

    const bends = new Map<number, number>(); // tick -> bend, so that two events never share a tick
    const resets: number[] = [];
    for (const note of spec_.notes) {
      const ticks = Math.round(note.startBeat * PPQ);
      const durationTicks = Math.max(1, Math.round(note.beats * PPQ));
      const { key, bend } = keyOf(note.pitch);
      track.addNote({ midi: key, ticks, durationTicks, velocity: note.velocity ?? DEFAULT_VELOCITY });
      if (bend !== 0) {
        bends.set(ticks, bend);
        resets.push(ticks + durationTicks);
      }
    }
    // the bend goes back to normal when a quarter tone ends, unless another one starts right there
    for (const ticks of resets) if (!bends.has(ticks)) bends.set(ticks, 0);
    for (const [ticks, value] of [...bends].sort((a, b) => a[0] - b[0])) track.addPitchBend({ ticks, value });
  }
  return midi.toArray();
}

/** A file name for a MIDI file from a title: no characters a file system refuses, words joined by hyphens. */
export function midiFileName(title: string): string {
  const name = title
    .replace(/[\\/:*?"<>|\x00-\x1f]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
    .slice(0, 80);
  return `${name || 'music'}.mid`;
}
