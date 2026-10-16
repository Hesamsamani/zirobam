import { getLocale, onLocaleChange, t, type Locale } from './index';
import { EventEmitter } from '../core/events';

export type NoteNameSystem = 'letters' | 'solfege' | 'solfege-fa';
export const NOTE_NAME_SYSTEMS: readonly NoteNameSystem[] = ['letters', 'solfege', 'solfege-fa'];

const STORAGE_KEY = 'ui.noteNames';

const STEP_NAMES: Record<NoteNameSystem, Record<string, string>> = {
  letters: { C: 'C', D: 'D', E: 'E', F: 'F', G: 'G', A: 'A', B: 'B' },
  solfege: { C: 'Do', D: 'Re', E: 'Mi', F: 'Fa', G: 'Sol', A: 'La', B: 'Si' },
  'solfege-fa': { C: 'دو', D: 'ر', E: 'می', F: 'فا', G: 'سل', A: 'لا', B: 'سی' },
};

const ACCIDENTALS: Record<NoteNameSystem, { sharp: string; flat: string }> = {
  letters: { sharp: '♯', flat: '♭' },
  solfege: { sharp: '♯', flat: '♭' },
  'solfege-fa': { sharp: ' دیز', flat: ' بمل' },
};

let chosen: NoteNameSystem | null = null;
const changes = new EventEmitter<NoteNameSystem>();

export function isNoteNameSystem(value: unknown): value is NoteNameSystem {
  return typeof value === 'string' && (NOTE_NAME_SYSTEMS as readonly string[]).includes(value);
}

export function defaultSystemFor(locale: Locale): NoteNameSystem {
  return locale === 'fa' ? 'solfege-fa' : 'letters';
}

export function getNoteNameSystem(): NoteNameSystem {
  return chosen ?? defaultSystemFor(getLocale());
}

export function setNoteNameSystem(system: NoteNameSystem | null): void {
  chosen = system;
  try {
    if (system) localStorage.setItem(STORAGE_KEY, system);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // storage unavailable
  }
  changes.emit(getNoteNameSystem());
}

export function loadNoteNameSystem(): void {
  let stored: string | null = null;
  try {
    stored = localStorage.getItem(STORAGE_KEY);
  } catch {
    stored = null;
  }
  chosen = isNoteNameSystem(stored) ? stored : null;
}

export function onNoteNamesChange(fn: (system: NoteNameSystem) => void): () => void {
  return changes.on(fn);
}

onLocaleChange(() => changes.emit(getNoteNameSystem()));

export function formatNoteName(
  note: string,
  system: NoteNameSystem,
  options: { octave?: boolean } = {}
): string {
  const match = /^([A-Ga-g])([#b♯♭]?)(-?\d+)?$/.exec(note.trim());
  if (!match) return note;
  const step = match[1].toUpperCase();
  const accidental = match[2];
  let name = STEP_NAMES[system][step];
  if (accidental === '#' || accidental === '♯') name += ACCIDENTALS[system].sharp;
  else if (accidental === 'b' || accidental === '♭') name += ACCIDENTALS[system].flat;
  if (options.octave && match[3] !== undefined) name += match[3];
  return name;
}

export function formatKeyName(keyId: string, system: NoteNameSystem = getNoteNameSystem()): string {
  return t('key.major', { tonic: formatNoteName(keyId, system) });
}
