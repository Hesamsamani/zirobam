import type { BuiltInSong } from '../songs';

export interface MelodyNote {
  pitch: string;
  /** Length in quarter-note beats. */
  beats: number;
}

function childText(parent: Element, name: string): string | null {
  return parent.getElementsByTagName(name)[0]?.textContent ?? null;
}

/**
 * The tune of a MusicXML song: the pitched notes of the upper staff of the first part, in order.
 * Rests, the lower staff, the lower notes of chords and the second half of a tie are left out.
 */
export function extractMelody(xml: string): MelodyNote[] {
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  if (doc.getElementsByTagName('parsererror').length > 0) return [];
  const part = doc.getElementsByTagName('part')[0];
  if (!part) return [];

  const melody: MelodyNote[] = [];
  let divisions = 1;
  for (const measure of Array.from(part.getElementsByTagName('measure'))) {
    const fromAttributes = Number(childText(measure, 'divisions'));
    if (fromAttributes > 0) divisions = fromAttributes;
    for (const note of Array.from(measure.getElementsByTagName('note'))) {
      if (note.getElementsByTagName('rest').length > 0) continue;
      if (note.getElementsByTagName('chord').length > 0) continue;
      const staff = childText(note, 'staff');
      if (staff !== null && staff !== '1') continue;
      const tieStop = Array.from(note.getElementsByTagName('tie')).some((tie) => tie.getAttribute('type') === 'stop');
      if (tieStop) continue;
      const step = childText(note, 'step');
      const octave = childText(note, 'octave');
      if (!step || octave === null) continue;
      const alter = Number(childText(note, 'alter') ?? 0);
      const accidental = alter > 0 ? '#'.repeat(alter) : alter < 0 ? 'b'.repeat(-alter) : '';
      melody.push({ pitch: `${step}${accidental}${octave}`, beats: Number(childText(note, 'duration') ?? divisions) / divisions });
    }
  }
  return melody;
}

function shiftOctave(pitch: string, shift: number): string {
  const match = /^([A-G][#b]*)(-?\d+)$/.exec(pitch);
  return match ? `${match[1]}${Number(match[2]) + shift}` : pitch;
}

/**
 * The melody moved by whole octaves (as little as possible) so that every note has a bar,
 * or null if it cannot be played on these bars (a sharp, or a range wider than the bars).
 */
export function fitMelody(melody: readonly MelodyNote[], barNames: readonly string[]): MelodyNote[] | null {
  if (melody.length === 0) return null;
  const available = new Set(barNames);
  for (const shift of [0, -1, 1, -2, 2]) {
    const shifted = melody.map((note) => ({ ...note, pitch: shiftOctave(note.pitch, shift) }));
    if (shifted.every((note) => available.has(note.pitch))) return shifted;
  }
  return null;
}

export interface PlayableSong {
  song: BuiltInSong;
  notes: string[];
}

/** The built-in songs that can be played on these bars, with their notes. */
export function playableSongs(songs: readonly BuiltInSong[], barNames: readonly string[]): PlayableSong[] {
  const result: PlayableSong[] = [];
  for (const song of songs) {
    const fitted = fitMelody(extractMelody(song.xml), barNames);
    if (fitted) result.push({ song, notes: fitted.map((note) => note.pitch) });
  }
  return result;
}
