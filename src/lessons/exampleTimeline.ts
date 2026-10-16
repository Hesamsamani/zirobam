import { parseMelody, type ParsedNote } from '../songs/songBuilder';
import type { StaffExample } from './exampleXml';

/** One sound of a lesson picture, in beats from its start. */
export interface TimelineEvent {
  pitch: string;
  start: number;
  length: number;
}

/** The notes of one staff with their start times. Tied notes become one long sound. */
function staffEvents(measures: ParsedNote[][]): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  let time = 0;
  let open: TimelineEvent | null = null; // the sound a tie is still adding to
  for (const note of measures.flat()) {
    const length = note.duration / 4;
    if (!note.rest) {
      if (open && open.pitch === note.pitch) {
        open.length += length;
      } else {
        open = { pitch: note.pitch, start: time, length };
        events.push(open);
      }
      if (!note.tie) open = null;
    } else {
      open = null;
    }
    time += length;
  }
  return events;
}

/** What a lesson picture sounds like, for the Play button. */
export function exampleTimeline(spec: StaffExample): TimelineEvent[] {
  const beats = spec.beats ?? 4;
  const strict = !spec.free;
  const events = staffEvents(parseMelody(spec.notes, beats, 4, strict));
  if (spec.clef === 'grand' && spec.lower) events.push(...staffEvents(parseMelody(spec.lower, beats, 4, strict)));
  return events.sort((a, b) => a.start - b.start);
}

/** How long the whole example lasts in beats, trailing rests included. */
export function exampleLength(spec: StaffExample): number {
  const beats = spec.beats ?? 4;
  const strict = !spec.free;
  const total = (text: string) => parseMelody(text, beats, 4, strict).flat().reduce((sum, note) => sum + note.duration / 4, 0);
  return Math.max(total(spec.notes), spec.clef === 'grand' && spec.lower ? total(spec.lower) : 0);
}
