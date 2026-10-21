import { buildExampleXml, type StaffExample } from '../lessons/exampleXml';
import type { SongDraft } from '../songs/songMaker';
import type { MidiNote, MidiSongSpec, MidiTrackSpec } from '../theory/midiExport';
import { parsePitch, pianoMidi } from '../theory/pitch';
import type { SpelledScale } from '../theory/spell';
import { melodyTokens, type Melody } from './melody';
import type { Progression } from './progression';
import { METERS, UNIT_TOKEN, type MeterId } from './rhythmCells';

/** What the generator made: a progression, a melody, or both. */
export interface GeneratedPiece {
  title: string;
  scale: SpelledScale;
  meter: MeterId;
  bpm: number;
  progression: Progression | null;
  melody: Melody | null;
}

const MIDDLE_C = 60;
const BASS_PROGRAM = 33; // electric bass (finger), General MIDI

const midiOf = (pitch: string): number => pianoMidi(parsePitch(pitch)!);

/** The same note an octave lower: the chords go in the bass staff when a tune has the treble staff. */
function octaveDown(pitch: string): string {
  const p = parsePitch(pitch)!;
  return pitch.replace(/-?\d+$/, String(p.octave - 1));
}

/** A rest as long as `units` sixteenths. */
const rest = (units: number): string => `r${UNIT_TOKEN[units]}`;

/** One hand's notes for each chord, bar by bar: a chord token (or a rest when the hand has no note in the chord). */
function handTokens(progression: Progression, pick: (voicing: readonly string[]) => string[]): string {
  const bars: string[][] = Array.from({ length: progression.bars }, () => []);
  for (const chord of progression.chords) {
    const units = chord.beats * 4;
    const notes = pick(chord.voicing);
    bars[chord.bar].push(notes.length > 0 ? `${notes.join('+')}${UNIT_TOKEN[units]}` : rest(units));
  }
  return bars.map((bar) => bar.join(' ')).join(' | ');
}

/** A bar of rest for each bar of the piece. */
function restBars(meter: MeterId, bars: number): string {
  return Array.from({ length: bars }, () => rest(METERS[meter].units)).join(' | ');
}

/**
 * The score of a piece: the grand staff. A tune goes in the right hand, over chords that go in the left an octave down
 * (and over rests when there are no chords). Chords alone are shared between the hands the way a pianist reads them:
 * from middle C up in the right, the rest in the left.
 */
export function pieceSpec(piece: GeneratedPiece): StaffExample {
  const meter = METERS[piece.meter];
  const bars = piece.melody ? piece.melody.bars.length : (piece.progression?.bars ?? 0);
  let upper: string;
  let lower: string;
  if (piece.melody) {
    upper = melodyTokens(piece.melody);
    lower = piece.progression ? handTokens(piece.progression, (voicing) => voicing.map(octaveDown)) : restBars(piece.meter, bars);
  } else if (piece.progression) {
    upper = handTokens(piece.progression, (voicing) => voicing.filter((p) => midiOf(p) >= MIDDLE_C));
    lower = handTokens(piece.progression, (voicing) => voicing.filter((p) => midiOf(p) < MIDDLE_C));
  } else {
    throw new Error('Nothing to write: the piece has no melody and no progression');
  }
  return { clef: 'grand', notes: upper, lower, fifths: piece.scale.fifths ?? 0, beats: meter.beats, beatType: meter.beatType, showTime: true };
}

/** `count` bars of a score from bar `from` (counting from 0), as a score of its own: for drawing a long piece a few bars to a line. */
export function barsOfSpec(spec: StaffExample, from: number, count: number): StaffExample {
  const cut = (text: string | undefined): string | undefined => text?.split(' | ').slice(from, from + count).join(' | ');
  return { ...spec, notes: cut(spec.notes)!, lower: cut(spec.lower) };
}

/** The score of a piece as MusicXML, for the practice stand. */
export function pieceXml(piece: GeneratedPiece): string {
  return buildExampleXml(pieceSpec(piece));
}

/**
 * The piece as a MIDI file: the chords, a bass line on the roots, and the tune, each on a track of its own.
 * Beats are quarter notes, so a bar of 6/8 is three of them.
 */
export function pieceMidiSpec(piece: GeneratedPiece): MidiSongSpec {
  const meter = METERS[piece.meter];
  const tracks: MidiTrackSpec[] = [];
  if (piece.progression) {
    const chordNotes: MidiNote[] = [];
    const bassNotes: MidiNote[] = [];
    for (const chord of piece.progression.chords) {
      const start = chord.bar * 4 + chord.beat;
      for (const pitch of chord.voicing) chordNotes.push({ pitch, startBeat: start, beats: chord.beats, velocity: 0.7 });
      bassNotes.push({ pitch: chord.bass, startBeat: start, beats: chord.beats, velocity: 0.85 });
    }
    tracks.push({ name: 'Chords', program: 0, channel: 0, notes: chordNotes });
    tracks.push({ name: 'Bass', program: BASS_PROGRAM, channel: 1, notes: bassNotes });
  }
  if (piece.melody) {
    const tune: MidiNote[] = [];
    piece.melody.bars.forEach((bar, index) => {
      for (const note of bar) {
        if (note.pitch === null) continue;
        tune.push({ pitch: note.pitch, startBeat: (index * meter.units + note.start) / 4, beats: note.units / 4, velocity: 0.9 });
      }
    });
    tracks.push({ name: 'Melody', program: 0, channel: 2, notes: tune });
  }
  return { title: piece.title, bpm: piece.bpm, meter: [meter.beats, meter.beatType], tracks };
}

/** The tune as a draft of the song maker, to be opened and edited there; null when the piece has no tune. */
export function songDraftOf(piece: GeneratedPiece): SongDraft | null {
  if (!piece.melody) return null;
  const meter = METERS[piece.meter];
  const melody = melodyTokens(piece.melody);
  const fifths = piece.scale.fifths ?? 0;
  return meter.beatType === 8 ? { title: piece.title, fifths, beats: 6, beatType: 8, melody } : { title: piece.title, fifths, beats: meter.beats as 2 | 3 | 4, melody };
}
