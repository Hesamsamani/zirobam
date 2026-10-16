import { usesPersianDigits, type Locale } from '../i18n';
import { toPersianDigits } from '../i18n/digits';
import { formatNoteName, getNoteNameSystem, type NoteNameSystem } from '../i18n/noteNames';
import type { Bi } from './types';

/** {C}, {F#}, {Bb}, and with an octave number {C4}. */
const TOKEN = /\{([A-G][#b]?)(\d)?\}/g;

/** Replaces the note tokens with names in the student's note-name system. */
export function resolveNoteTokens(text: string, system: NoteNameSystem = getNoteNameSystem()): string {
  return text.replace(TOKEN, (_match, note: string, octave: string | undefined) => {
    if (octave === undefined) return formatNoteName(note, system);
    const name = formatNoteName(`${note}${octave}`, system, { octave: true });
    // Persian note names take Persian digits; letters keep the digit the notation uses (C4)
    return system === 'solfege-fa' && usesPersianDigits() ? toPersianDigits(name) : name;
  });
}

/** One text of a lesson in the chosen language, with the note names filled in. */
export function lessonText(text: Bi, locale: Locale, system?: NoteNameSystem): string {
  return resolveNoteTokens(text[locale], system);
}
