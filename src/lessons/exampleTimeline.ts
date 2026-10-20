import { parseMelody, type ParsedNote } from '../songs/songBuilder';
import type { StaffExample } from './exampleXml';

/** One sound of a lesson picture, in beats from its start. */
export interface TimelineEvent {
  pitch: string;
  start: number;
  length: number;
}

/** The notes of one staff with their start times. A chord is several sounds at once; tied notes become one long sound. */
function staffEvents(measures: ParsedNote[][]): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  let time = 0;
  let open = new Map<string, TimelineEvent>(); // the sounds a tie is still adding to, by pitch
  for (const note of measures.flat()) {
    const length = note.duration / 4;
    if (note.rest) {
      open = new Map();
    } else {
      const next = new Map<string, TimelineEvent>();
      for (const pitch of [note.pitch, ...note.chord.map((c) => c.pitch)]) {
        const sounding = open.get(pitch);
        if (sounding) sounding.length += length;
        const event = sounding ?? { pitch, start: time, length };
        if (!sounding) events.push(event);
        if (note.tie) next.set(pitch, event);
      }
      open = next;
    }
    time += length;
  }
  return events;
}

/** What a lesson picture sounds like, for the Play button. */
export function exampleTimeline(spec: StaffExample): TimelineEvent[] {
  const beats = spec.beats ?? 4;
  const beatType = spec.beatType ?? 4;
  const strict = !spec.free;
  const events = staffEvents(parseMelody(spec.notes, beats, beatType, strict));
  if (spec.clef === 'grand' && spec.lower) events.push(...staffEvents(parseMelody(spec.lower, beats, beatType, strict)));
  return events.sort((a, b) => a.start - b.start);
}

/** How long the whole example lasts in beats (quarter notes), trailing rests included. */
export function exampleLength(spec: StaffExample): number {
  const beats = spec.beats ?? 4;
  const beatType = spec.beatType ?? 4;
  const strict = !spec.free;
  const total = (text: string) => parseMelody(text, beats, beatType, strict).flat().reduce((sum, note) => sum + note.duration / 4, 0);
  return Math.max(total(spec.notes), spec.clef === 'grand' && spec.lower ? total(spec.lower) : 0);
}
