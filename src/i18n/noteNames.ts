import { getLocale, onLocaleChange, t, type Locale } from './index';
import { EventEmitter } from '../core/events';
import { parseNoteName, type Alter } from '../theory/pitch';

export type NoteNameSystem = 'letters' | 'solfege' | 'solfege-fa';
export const NOTE_NAME_SYSTEMS: readonly NoteNameSystem[] = ['letters', 'solfege', 'solfege-fa'];

const STORAGE_KEY = 'ui.noteNames';

const STEP_NAMES: Record<NoteNameSystem, Record<string, string>> = {
  letters: { C: 'C', D: 'D', E: 'E', F: 'F', G: 'G', A: 'A', B: 'B' },
  solfege: { C: 'Do', D: 'Re', E: 'Mi', F: 'Fa', G: 'Sol', A: 'La', B: 'Si' },
  'solfege-fa': { C: 'دو', D: 'ر', E: 'می', F: 'فا', G: 'سل', A: 'لا', B: 'سی' },
};

// What follows the letter for each alteration. Double signs are written ♯♯ and ♭♭ (the single-symbol
// double sharp and flat are missing from most fonts). Koron and sori are the Persian quarter tones.
const LATIN_SIGNS: Readonly<Record<Alter, string>> = { [-2]: '♭♭', [-1]: '♭', [-0.5]: ' koron', [0]: '', [0.5]: ' sori', [1]: '♯', [2]: '♯♯' };
const SIGNS: Record<NoteNameSystem, Readonly<Record<Alter, string>>> = {
  letters: LATIN_SIGNS,
  solfege: LATIN_SIGNS,
  'solfege-fa': { [-2]: ' دوبل بمل', [-1]: ' بمل', [-0.5]: ' کرن', [0]: '', [0.5]: ' سری', [1]: ' دیز', [2]: ' دوبل دیز' },
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
  const trimmed = note.trim();
  // the letter may be lower case ("c#")
  const parsed = parseNoteName(trimmed.charAt(0).toUpperCase() + trimmed.slice(1));
  if (!parsed) return note;
  let name = STEP_NAMES[system][parsed.step] + SIGNS[system][parsed.alter];
  if (options.octave && parsed.octave !== null) name += parsed.octave;
  return name;
}

export function formatKeyName(keyId: string, system: NoteNameSystem = getNoteNameSystem()): string {
  return t('key.major', { tonic: formatNoteName(keyId, system) });
}
