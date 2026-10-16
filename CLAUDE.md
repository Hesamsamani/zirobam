# CLAUDE.md

This file provides guidance for Claude Code when working on this project.

## Project Overview

Sight Reading Practice is a web app for learning to read piano sheet music. It generates procedural exercises with a structured curriculum and provides real-time feedback via MIDI input.

## Build & Test Commands

```bash
npm install          # Install dependencies
npm run dev          # Start dev server (http://localhost:5173/sightreading/)
npm test             # Run unit tests (Vitest)
npx playwright test  # Run E2E tests
npm run build        # Production build
npm run deploy       # Deploy to GitHub Pages
```

## Architecture

See `docs/ARCHITECTURE.md` for detailed modular architecture documentation.

### Module Structure

```
src/
  core/           # Shared types, events, utilities
  music/          # Music generation and representation
    generators/   # Melody, pattern, scale generation
    sources/      # MusicSource implementations
    xml/          # MusicXML building
  playback/       # Audio playback engine
  rendering/      # Visual rendering (Verovio)
  curriculum/     # Lessons and progress tracking
    lessons/      # Lesson implementations
  input/          # MIDI and performance tracking
```

### Key Files (Legacy - still in use)

- `src/main.ts` - App initialization, UI controls, playback scheduling, MIDI handling
- `src/musicGenerator.ts` - Procedural music generation, level curriculum, progress tracking
- `src/scheduler.ts` - Pure utility functions for timing calculations
- `src/fingeringEngine.ts` - Piano fingering suggestions

### Data Flow (Timing)

The timing system uses the music generator as the single source of truth:

1. `musicGenerator.ts` creates `NoteData[]` with `duration` property for each note
2. `main.ts:buildTimingEvents()` merges RH/LH notes into `timingEvents[]`
3. `main.ts:scheduleMusic()` uses `timingEvents` for Tone.js scheduling
4. SVG elements in `visualGroups[]` are only used for visual highlighting

**Important**: Never extract timing/duration from SVG elements. The music generator is the source of truth.

### Level System

- **Levels 1-3**: C major whole notes (RH → LH → Both)
- **Levels 4-7**: C major rhythms (half notes, quarters, rests/3-4, dotted)
- **Levels 8-10**: C major advanced rhythms (eighths, dotted eighths, sixteenths)
- **Levels 11+**: New keys following circle of fifths (G, F, D, Bb, A, Eb, E, Ab...)
- Each level has 4 sub-levels (a, b, c, d)
- `handMode: 'right' | 'left' | 'both'` determines which staves have notes vs rests

### Music Generation

- Uses MusicXML format rendered by Verovio
- `generateMusicXML()` returns: xml, timeSignature, lessonDescription, rightHandNotes, leftHandNotes, etc.
- Notes are stored as `NoteData` with step, alter, octave, duration, isRest
- Durations: 4=whole, 2=half, 1=quarter, 0.5=eighth, 0.25=sixteenth, 0.75=dotted eighth

## Common Tasks

### Adding a New Level Feature

1. Update `LevelConfig` interface in `musicGenerator.ts`
2. Modify `getLevelConfig()` to use the new config
3. Update lesson descriptions in `getLessonDescription()`
4. Update dropdown in `index.html`
5. Add tests in `src/__tests__/musicGenerator.test.ts`

### Modifying Playback Timing

1. Only modify timing in `buildTimingEvents()` or `scheduleMusic()`
2. Never parse timing from SVG elements
3. Run timing tests: `npx playwright test --grep "Playback Timing"`

### Updating UI

1. HTML structure is in `index.html`
2. Styles in `src/style.css`
3. Control handlers in `setupControls()` in `main.ts`

## Testing

- Unit tests: `npm test` (105 tests in Vitest)
- E2E tests: `npx playwright test` (Chromium, includes timing verification)
- Key timing tests verify no duplicate notes and proper spacing

## Gotchas

- MusicXML uses `<part-name print-object="no">` to hide "Piano" label
- Countoff shows 4-3-2-1 on each beat (not before first beat)
- Level progress is saved to localStorage
- `visualGroups` is for SVG highlighting only, not timing
- Level cap is 20 (`MAX_LEVEL`: 10 C major levels + 10 key levels, G through Db)

## Fork notes (music-notes-trainer, bilingual)

This is the owner's personal fork. Design: `docs/superpowers/specs/2026-10-16-bilingual-note-trainer-design.md`.

- **Branch:** work happens on `bilingual`. The only remote is `upstream` and its push URL is set to `DISABLED-local-only`. Do not push or fork to GitHub unless the owner asks.
- **Two languages, always together:** every new user-visible string gets a key in `src/i18n/locales/en.ts` and the same key in `fa.ts`. No hard-coded UI text. Persian text follows the persian-writing skill (natural wording, ZWNJ, «guillemets»).
- **RTL rule:** only text and panels flip for Persian. The score (`#notation`), the staff and the piano keyboard stay `dir="ltr"`.
- **Keyboard input uses `KeyboardEvent.code`** (physical keys), so it works with a Persian layout.
- **Note names:** internal names stay letters (`C#4`, `Bb3`). Naming systems (letters / solfège / Persian solfège) are display only, via `src/i18n/noteNames.ts`.
- **Don't add network dependencies** (CDNs, analytics). Fonts are self-hosted.
- **Tests first:** new modules get Vitest tests before code; upstream tests must stay green (`npm test`); E2E with `npx playwright test`.
- **Persian terminology** (دیز, بمل, solfège names) is pending the owner's review.
- **No constructor parameter properties** (`constructor(private x: T)`): `tsconfig` has `erasableSyntaxOnly`. Declare the field and assign it in the constructor.
- **Don't use `innerHTML`** in new code (a security hook flags it). Build DOM with `createElement`, `textContent` and `replaceChildren()`; parse SVG strings with `DOMParser`.

### Module map (milestone 1, done 2026-10-16)

| Path | Purpose |
|---|---|
| `src/i18n/` | `t()`, locale state and `<html lang dir>`, digits, note-name systems (`noteNames.ts`), dictionaries in `locales/en.ts` and `fa.ts` |
| `src/lessonText.ts` | Translated level descriptions that follow the note-name system |
| `src/input/noteInput.ts` | The hub every note source emits into (`midi`, `screen`, `computer`, later `microphone`) |
| `src/input/computerKeyboard.ts`, `onScreenPiano.ts` | Keyboard by physical key, clickable piano |
| `src/rendering/noteLabels.ts` | Names under noteheads (spelling comes from Verovio's sounding pitch via `spellFromMidi`) |
| `src/learn/` | `noteStats`, `noteScheduler`, `nameTheNote` (pure logic); `noteCard`, `learnView`, `lessons` (screens) |
| `src/core/safeStorage.ts` | `storageGet/Set/Remove`: localStorage that never throws. Use it instead of `localStorage` in app code |
| `src/core/tempo.ts`, `volume.ts`, `passRules.ts` | `clampBpm`, slider-to-dB mapping, `didPassPiece` (a piece only counts if it was played) |
| `src/input/shortcuts.ts` | `isSpaceReserved`: where the global Space shortcut must stay out of the way |
| `src/metronome/clickVoice.ts` | The metronome click: one reusable synth, scheduled at the Transport time |
| `src/ui/notice.ts` | `showNotice(text)`: a polite status message (replaces `alert()`; never use blocking dialogs) |

`main.ts` only wires these together (`setupPiano`, `setupLearnMode`, the language block at the end of `setupControls`).

### Test hooks and commands

- `#learnView` carries `data-panel` (`quiz` or `lessons`), `data-pitch` (the note asked) and `data-result` (`correct` or `wrong`, absent between questions).
- `document` fires a `trainer:beat` CustomEvent for every beat that is played and highlighted. `detail` = `{ beatIndex, time, pitches, noteIds, audioTime }` (`audioTime` is on the audio clock, immune to a busy main thread). The end-to-end playback tests use it instead of console logs, which the app no longer prints.
- `#playPause` has `aria-busy="true"` while the piano sounds load; `#notice` is the status message element.
- Unit: `npm test` (340+ tests). End to end: `npx playwright test` (needs `npm run dev` or lets Playwright start it). All end-to-end tests pass on all three projects; the 13 failures seen at the start of the fork were stale tests (see `docs/bug-hunt-2026-10-16.md`).
- Close the options panel in tests with `#optionsClose`, not by clicking the score: on phones the panel covers it.
- Mobile control bar: at 820px and below it wraps onto two rows (end of `style.css`).
