import type { Progression, ProgressionChord } from '../generator/progression';
import { parsePitch, pianoMidi } from '../theory/pitch';
import { PATTERNS, type BandPart, type BassTone, type DrumPiece } from './patterns';

/** One thing the band plays: a drum hit, a bass note or a chord. */
export interface BandEvent {
  part: BandPart;
  /** Beats (quarter notes) from the start of the arrangement, the count-in included. */
  at: number;
  /** How long it sounds, in beats. */
  length: number;
  /** 0 to 1. */
  velocity: number;
  /** The drum for a hit of the drums. */
  drum?: DrumPiece;
  /** The notes (MIDI numbers) of a bass note (one) or a chord (all its notes). */
  midis?: number[];
}

export interface BandOptions {
  /** Semitones up (or down) for the bass and the chords; the drums stay as they are. */
  transpose?: number;
  /** A bar of four clicks before the loop starts. */
  countIn?: boolean;
}

export interface Arrangement {
  events: BandEvent[];
  /** The count-in in beats: 0 or 4. The loop starts there. */
  countInBeats: number;
  /** The length of the loop in beats. */
  loopBeats: number;
}

const BAR_UNITS = 16;
const COUNT_IN_BEATS = 4;
const COUNT_IN_VELOCITY = [0.9, 0.6, 0.6, 0.6];

const midiOf = (pitch: string): number => pianoMidi(parsePitch(pitch)!);
const pitchClass = (name: string): number => midiOf(`${name}4`) % 12;

/** Where a place in the bar (in sixteenths) falls, in beats: a swung eighth is at two thirds of the beat. */
function beatOf(units: number, swing: boolean): number {
  const beat = Math.floor(units / 4);
  const within = units % 4;
  return beat + (swing && within === 2 ? 2 / 3 : within / 4);
}

/** The note of a chord that a bass note plays, above the root, as a MIDI number. */
function toneMidi(chord: ProgressionChord, tone: BassTone, rootMidi: number): number {
  const rootPc = pitchClass(chord.chord.root);
  const above = (name: string): number => rootMidi + ((pitchClass(name) - rootPc + 12) % 12);
  const notes = chord.chord.notes;
  switch (tone) {
    case 'root':
      return rootMidi;
    case 'octave':
      return rootMidi + 12;
    case 'third':
      return notes.length > 1 ? above(notes[1]) : rootMidi + 7;
    default:
      return notes.length > 2 ? above(notes[2]) : rootMidi + 7;
  }
}

/**
 * The band's part for a progression in a style: the drums bar by bar, a bass line that follows the chords, and the
 * chords played as the style plays them. Times are in beats; a shuffle puts the eighths between the beats late.
 */
export function arrangeBand(progression: Progression, options: BandOptions = {}): Arrangement {
  const pattern = PATTERNS[progression.style];
  const transpose = options.transpose ?? 0;
  const countInBeats = options.countIn ? COUNT_IN_BEATS : 0;
  const swing = pattern.swing;
  const events: BandEvent[] = [];
  const add = (event: BandEvent): void => void events.push({ ...event, at: event.at + countInBeats });

  if (countInBeats > 0) {
    for (let beat = 0; beat < COUNT_IN_BEATS; beat++) events.push({ part: 'drums', at: beat, length: 0.25, velocity: COUNT_IN_VELOCITY[beat], drum: 'hat' });
  }

  // ----- the drums, bar by bar -----
  for (let bar = 0; bar < progression.bars; bar++) {
    const last = bar === progression.bars - 1 && pattern.fill.length > 0;
    const hits = last ? [...pattern.drums.filter((hit) => hit.at < 12), ...pattern.fill] : pattern.drums;
    for (const hit of hits) add({ part: 'drums', at: bar * 4 + beatOf(hit.at, swing), length: 0.25, velocity: hit.velocity, drum: hit.piece });
  }

  // ----- the chords: bass and comping, chord by chord -----
  for (const chord of progression.chords) {
    const start = (chord.bar * 4 + chord.beat) * 4; // in sixteenths from the start of the loop
    const end = start + chord.beats * 4;
    const barStart = chord.bar * BAR_UNITS;
    const toBeats = (units: number): number => (barStart + beatOf(units - barStart, swing) * 4) / 4;
    const voicing = chord.voicing.map((pitch) => midiOf(pitch) + transpose);
    const rootMidi = midiOf(chord.bass) + transpose;

    // bass: the hits that fall inside the chord, and the root where the chord starts if the pattern has nothing there
    const bass = pattern.bass
      .map((hit) => ({ hit, at: barStart + hit.at }))
      .filter(({ at }) => at >= start && at < end)
      .sort((a, z) => a.at - z.at);
    if (bass.length === 0 || bass[0].at > start) {
      const next = bass.length > 0 ? bass[0].at : end;
      add({ part: 'bass', at: toBeats(start), length: toBeats(next) - toBeats(start), velocity: 0.8, midis: [rootMidi] });
    }
    for (const { hit, at } of bass) {
      const stop = Math.min(at + hit.length, end);
      // the first note of a chord is its root, whatever the pattern says: it is what tells the chord
      const tone = at === start ? 'root' : hit.tone;
      add({ part: 'bass', at: toBeats(at), length: toBeats(stop) - toBeats(at), velocity: hit.velocity, midis: [toneMidi(chord, tone, rootMidi)] });
    }

    // chords
    const comp = pattern.comp;
    if (comp.kind === 'hits') {
      for (const hit of comp.hits) {
        const at = barStart + hit.at;
        if (at < start || at >= end) continue;
        const stop = Math.min(at + hit.length, end);
        add({ part: 'chords', at: toBeats(at), length: toBeats(stop) - toBeats(at), velocity: hit.velocity, midis: voicing });
      }
      // a chord that begins between the places of the pattern is still struck where it begins
      if (!comp.hits.some((hit) => barStart + hit.at === start)) {
        const next = comp.hits.map((hit) => barStart + hit.at).filter((at) => at > start && at < end).sort((a, z) => a - z)[0] ?? end;
        add({ part: 'chords', at: toBeats(start), length: toBeats(next) - toBeats(start), velocity: 0.6, midis: voicing });
      }
    } else {
      // up and down the notes of the chord, a note every `step` sixteenths
      const order = voicing.length > 2 ? [...voicing.keys(), ...Array.from(voicing.keys()).slice(1, -1).reverse()] : [...voicing.keys()];
      for (let at = start, i = 0; at < end; at += comp.step, i++) {
        const stop = Math.min(at + comp.step * 3, end);
        add({ part: 'chords', at: toBeats(at), length: toBeats(stop) - toBeats(at), velocity: comp.velocity, midis: [voicing[order[i % order.length]]] });
      }
    }
  }

  events.sort((a, z) => a.at - z.at || a.part.localeCompare(z.part));
  return { events, countInBeats, loopBeats: progression.bars * 4 };
}

/** The chord that sounds `beat` beats into the loop (the loop goes round and round). */
export function chordAtBeat(progression: Progression, beat: number): ProgressionChord | null {
  const total = progression.bars * 4;
  if (total === 0 || progression.chords.length === 0) return null;
  const at = ((beat % total) + total) % total;
  return progression.chords.find((chord) => chord.bar * 4 + chord.beat <= at && at < chord.bar * 4 + chord.beat + chord.beats) ?? null;
}
