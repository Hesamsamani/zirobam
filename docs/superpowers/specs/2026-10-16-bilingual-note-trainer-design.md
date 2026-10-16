# Bilingual note trainer: design

Date: 2026-10-16. Base: `ftrain/sightreading` at commit `05158c5` (LGPL-3.0). Owner decisions are listed first; the rest follows from them.

## Goal
A web app in which the owner learns to read music notes, with the interface in **English and Persian**, that works with an on-screen keyboard, the computer keyboard, a MIDI/USB piano and (milestone 2) a microphone.

## Decisions
- Base app: `ftrain/sightreading`. Reason: it is the only candidate with an open license that teaches reading notes on the staff (see `research/candidates.md`).
- Persian note names: solfège and letters, switchable. No quarter-tones in this version.
- Practice inputs: on-screen piano and computer keyboard, MIDI, microphone. The microphone arrives in milestone 2.
- Code stays local. No fork, push or published repo.

## Non-goals
Persian quarter-tones (کرن/سری), offline PWA, GitHub Pages deploy, a rewrite of `main.ts`, accounts or any server.

## Starting point (checked)
- `npm ci`, `npm test` (190 tests), `npm run build` all pass on the untouched upstream.
- 0 vulnerabilities in shipped dependencies; 15 flagged in dev tooling (Vite, Vitest, gh-pages), fixable later.
- `main.ts` (2,290 lines) still holds its own MIDI code (`setupMIDI`, `handleMIDIMessage`, `checkNoteMatch`); the tidy modules in `src/input/` are not used by it. New input sources plug into `main.ts`.
- UI text lives in `index.html` (about 60 strings), `main.ts` (about 40, built dynamically), `musicGenerator.ts` (`getLessonDescription()`, key names) and `songs/index.ts` (6 titles).
- The app loads fonts from Google Fonts; there is no localisation of any kind.

## Architecture

New modules (each has one purpose and its own tests); existing files change only where listed.

```
src/i18n/
  index.ts            t(key, params), getLocale(), setLocale(), onLocaleChange(), applyTranslations(root)
  locales/en.ts       source of truth for all keys
  locales/fa.ts       must define every key of en.ts (enforced by the type system and a test)
  noteNames.ts        formatNoteName(note, system), NoteNameSystem, default per locale
  digits.ts           toPersianDigits() / formatNumber(n, locale)
src/input/
  noteInput.ts        tiny typed hub: onNoteOn / onNoteOff (name like "C#4"); sources emit into it
  computerKeyboard.ts physical-key map (KeyboardEvent.code), octave shift
  onScreenPiano.ts    DOM piano (pointer events), highlights keys, labels via noteNames
src/learn/
  noteScheduler.ts    pure: picks the next note to ask using per-pitch history
  noteStats.ts        per-pitch correct/seen counts, saved in localStorage
  nameTheNote.ts      the quiz: question, answer check, stages
  lessons.ts          5 short bilingual explanation screens
```

Existing files touched: `index.html` (data attributes, language and note-name selectors, piano dock, "Learn the notes" entry), `src/main.ts` (extract `handleNoteOn/Off`, call `t()` for dynamic text, mount the new modules), `src/musicGenerator.ts` (lesson descriptions become translation keys), `src/songs/index.ts` (title keys), `src/style.css` (RTL rules, piano, quiz).

## i18n
- **API:** `t('options.title')`, `t('progress.moreToAdvance', { n: 3 })` with `{n}` placeholders. Static HTML uses `data-i18n="key"` for text and `data-i18n-attr="aria-label:key"` for attributes; `applyTranslations()` fills them and runs again when the language changes.
- **Parity:** `fa.ts` is typed `Record<EnKey, string>`, so a missing key fails the build. A test also checks that placeholders (`{n}`) match in both languages.
- **Language:** English default; choice saved in `localStorage` (`ui.locale`). Sets `<html lang>` and `dir`.
- **RTL rule:** only text and panels flip. The score, the staff, and the piano keyboard stay left-to-right (`dir="ltr"` on `#notation` and the piano), because notation and piano pitch always run left to right.
- **Font:** Vazirmatn, self-hosted in `public/fonts/` (OFL), used when the language is Persian. No new network requests for it.
- **Digits:** an option to show Persian digits (۱۲۳) for levels, counts and tempo labels; the BPM input stays numeric.
- **Persian text** is written in a natural, polite-but-plain register with correct ZWNJ (نیم‌فاصله) and «guillemets», using the persian-writing skill. The owner reviews wording.

## Note-name systems
| System | Example (C D E F G A B) | Default for |
|---|---|---|
| Letters | C D E F G A B | English |
| Solfège (fixed do) | Do Re Mi Fa Sol La Si | — |
| Persian solfège | دو ر می فا سل لا سی | Persian |

Accidentals display as ♯ and ♭ (internal names stay `C#`, `Bb`). Persian: «فا دیز», «سی بمل» (to be confirmed by the owner). Changing the system relabels note names on the staff (new "show note names" learning aid), the keys, and the quiz answers. Internal comparison logic keeps using the existing letter names; naming is display only.

## Input
- **Hub:** `handleMIDIMessage` in `main.ts` becomes a thin wrapper over `handleNoteOn(name)` and `handleNoteOff(name)`, which keep today's logic (`activeNotes`, `checkNoteMatch`). The on-screen piano and computer keyboard call the same functions, so scoring, highlighting and levels behave identically for every source.
- **Computer keyboard:** by physical key (`KeyboardEvent.code`), so it works with a Persian keyboard layout. White keys A S D F G H J K L ; ' = C4…F5, black keys W E T Y U O P; Z and X shift the octave. Ignored while typing in a field or with Ctrl/Alt/Meta held. Space keeps its play/stop meaning.
- **On-screen piano:** a collapsible dock above the control bar, three octaves (C3 to C6) with horizontal scroll on narrow screens, pointer events for mouse and touch. Key labels follow the selected note-name system. Pressing a key also plays the sample through the app's existing sampler.
- **Microphone (milestone 2):** emits into the same hub.

## "Name the note" mode
- Entry: a "Learn the notes" button in the control bar (and Options). It is the on-ramp before level 1.
- Question: one note on a single staff (rendered with the existing Verovio path and the MusicXML builder). Answer by tapping one of seven name buttons in the chosen naming system, or by pressing the note on any input.
- Feedback: green for correct, red for wrong plus the right name; the correct key lights up on the piano.
- Stages: 1) treble C4 to G4, 2) treble staff lines and spaces (E4 to F5), 3) bass staff (G2 to A3), 4) both clefs, 5) ledger lines. A stage unlocks at 90% accuracy over the last 20 answers; the learner can also pick any unlocked stage.
- Scheduling: `noteScheduler` weights each candidate pitch by `1 + 4 × (1 − accuracy)`, new pitches count as accuracy 0.5, the same pitch never repeats twice in a row; the random source is injectable for tests.
- Persistence: `noteStats` (pitch → seen, correct, lastSeen) in `localStorage`, versioned so it can be migrated.

## Lessons
Five one-screen explanations shown before the first quiz and reachable from a help button: the staff; treble and bass clefs; where Middle C is; ledger lines; note names and the keyboard. Each has a small notation example and text in both languages.

## Error handling
- Missing translation key: fall back to English and log once in development. Missing key in `fa.ts` cannot compile.
- Web MIDI unavailable or denied: the on-screen piano and computer keyboard keep working; the MIDI selector shows an explanation instead of failing silently.
- `localStorage` unavailable or corrupt: defaults are used, nothing throws.
- Audio blocked by the browser: start audio on the first user gesture (the code already does this on play).

## Testing
- Vitest (TDD): `t()` lookup, placeholders and fallback; locale switch sets `lang/dir`; en/fa key and placeholder parity; note-name formatting for all three systems; Persian digits; computer-key to note mapping and octave shift; `noteScheduler` (weights, no immediate repeat, determinism with a seed); `noteStats` round trip and corrupt data; quiz answer checking.
- Playwright: upstream test stays green; new tests switch to Persian (`dir=rtl`, notation still `ltr`), finish a "Name the note" round by clicking, and play level 1a with the on-screen piano.
- Manual: screenshots of English and Persian views in Chrome; Persian text checked in Vazirmatn.

## Milestones
1. Language switch and note names → on-screen piano and computer keyboard → "Name the note" and lessons. One commit per feature on branch `bilingual`.
2. Microphone input: monophonic pitch detection (YIN or McLeod) from a small permissively-licensed library, calibration screen (noise gate, A4 = 440 Hz), tested with recorded clips.

## Risks
- `main.ts` is large. Mitigation: only extract what is needed (`handleNoteOn/Off`), put new code in new modules, keep upstream tests green after every step.
- Persian music terms (دیز, بمل and the solfège names) need the owner's review.
- A fork by one person: upstream last changed in December 2025, so no upstream merges are expected; `upstream` remote stays for reference and its push URL is disabled.
- Large bundle (8.5 MB, mostly Verovio) loads slowly on a phone; out of scope for now.
