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
| `src/learn/` | `noteStats`, `noteScheduler`, `nameTheNote` (pure logic); `noteCard`, `learnView` (the quiz only) |
| `src/core/safeStorage.ts` | `storageGet/Set/Remove`: localStorage that never throws. Use it instead of `localStorage` in app code |
| `src/core/tempo.ts`, `volume.ts`, `passRules.ts` | `clampBpm`, slider-to-dB mapping, `didPassPiece` (a piece only counts if it was played) |
| `src/input/shortcuts.ts` | `isSpaceReserved`: where the global Space shortcut must stay out of the way |
| `src/metronome/clickVoice.ts` | The metronome click: one reusable synth, scheduled at the Transport time |
| `src/ui/notice.ts` | `showNotice(text)`: a polite status message (replaces `alert()`; never use blocking dialogs) |

`main.ts` only wires these together (`setupPiano`, `setupLearnMode`, the language block at the end of `setupControls`).

### Test hooks and commands

- `#learnView` carries `data-panel` (always `quiz` now; the lessons have their own screen), `data-pitch` (the note asked) and `data-result` (`correct` or `wrong`, absent between questions).
- `document` fires a `trainer:beat` CustomEvent for every beat that is played and highlighted. `detail` = `{ beatIndex, time, pitches, noteIds, audioTime }` (`audioTime` is on the audio clock, immune to a busy main thread). The end-to-end playback tests use it instead of console logs, which the app no longer prints.
- `#playPause` has `aria-busy="true"` while the piano sounds load; `#notice` is the status message element.
- Unit: `npm test` (960+ tests). End to end: `npx playwright test` (needs `npm run dev` or lets Playwright start it). About 500 end-to-end tests pass on all three projects (desktop, Mobile Chrome, Mobile Chrome Landscape); the 13 failures seen at the start of the fork were stale tests (see `docs/bug-hunt-2026-10-16.md`).
- Close the options panel in tests with `#optionsClose`, not by clicking the score: on phones the panel covers it.
- Mobile control bar: at 820px and below it wraps onto two rows (end of `style.css`).

### Module map (milestone 2: menu, lessons, library, 2026-10-16)

| Path | Purpose |
|---|---|
| `src/app/router.ts`, `shell.ts` | Hash routes (`#/lessons/ID`, `#/catalog?filter`), `hashQuery()`; the shell shows the section whose `data-views` lists the current view and calls enter / leave / change hooks |
| `src/menu/` | `mainMenu.ts` (tiles), `songsView.ts`, `backButton.ts` |
| `src/practice/practicePanel.ts` | The song steps panel: measure map, jump buttons, "put it together" |
| `src/songs/` | `index.ts` built-in songs; `songBuilder.ts` (compact notation `E4q F#4e Bb3h. rq |`, `~` tie, `n` natural, 2/3/4 beats, accidentals outside the key get a drawn sign); `songMaker.ts` (pure: checks a draft, builds its MusicXML with the source stored in a `miscellaneous-field`, note buttons) and `songMakerView.ts` (route `#/maker/ID`, saved in the score store as kind `maker`); `library.ts` song specs, `libraryMore.ts` the public-domain tunes with their notes (read from Wikipedia LilyPond scores; a pickup is written as leading rests, 6/8 as 3/4; `songMelodies.test.ts` pins the opening notes of each); `songText.ts`; `songGroups.ts` |
| `src/backup/` | `backup.ts` (pure: whitelist of localStorage keys, `createBackup`, `checkBackup` that trims anything it does not trust, `applyBackup`), `backupView.ts` (the panel in Options and on the progress screen, asks before restoring), `download.ts`; the file is JSON `{ app, version, exportedAt, storage, scores }`, MIDI scores as base64 |
| `src/pwa/`, `public/sw.js`, `scripts/build-sw.mjs` | Offline and install. `sw.js` is a hand-written worker; `npm run build` runs `build-sw.mjs`, which writes the list of every built file and a version into `dist/sw.js` (cache first, `ignoreVary` because of `Vary: Origin`). Registered only in production (`import.meta.env.PROD`). `installPrompt.ts` keeps `beforeinstallprompt`, `pwaPanel.ts` is the group in Options. The piano samples are self-hosted in `public/samples/salamander/` and the fonts come from `@fontsource`: nothing may be fetched from another site (`e2e/offline.spec.ts`, project `offline`, runs on `vite preview` at port 4173) |
| `src/practice/` | `practicePanel.ts` (step panel; `addTool` puts a button in its button row), `timingEvents.ts` (pure: the moments of a piece, `buildTimingEventList(right, left, hand)` with the other hand as `accompaniment`, `effectiveHand`, `normalizeNote`), `waitMode.ts` (pure `WaitSession`: what a key press means while the piece waits), `practiceOptions.ts` (wait / loop / ladder / hand, saved as `practice.options.v1`; `slowedBpm`, `nextLadderBpm`), `practiceAids.ts` (the folded sliders button and its rows). `main.ts` wires them: `beginRound()` starts a timed round or `beginWaiting()`; `handleWaitPress()` is called from `checkNoteMatch()`; `tagHands()` marks the staves `data-hand` so the hand that is not practised is drawn faintly; `trainer:beat` events carry `waiting: true` in wait mode |
| `src/ear/`, `src/scales/` | Ear training: `questions.ts` (pure, seeded, five stages, `EarQuestion` with its `plan` of sounds), `earView.ts` (stages unlock like the quiz through `NoteStats` key `earStats.v1`; the question is kept in `window.__earQuestion` for the e2e tests; stage 5 is answered on a `buildKeysPicture` keyboard or MIDI through `WaitSession`). Scales and chords: `scaleData.ts` (pure, tonal: `scaleOf` / `chordOf` spell the root with the fewest signs and never with a double sign, `fingering` only for the agreed scales), `scalesView.ts` (staff through `renderStaffPicture` with the fingers as the labels, keys picture with marked keys, play along through `WaitSession`). Both take a `PianoVoice` (`playback/pianoVoice.ts`) built in `main.ts` from the Tone sampler. Game: `recordEarAnswer` (3 XP) and `recordScalePlayed` (5 XP), badges `ear-25` and `scales-5` (18 badges in all) |
| `src/xylophone/` | Keyboard-row xylophone: `keyRows`, `xylophoneInput`, `xyloSound`, `xyloGame`, `songMelody`, `xylophoneView` |
| `src/metronome/` | `tempoStore`, `metronomeEngine`, `metronomePanel`, `floatingWindow` (Document Picture-in-Picture with an in-page fallback), `clickVoice` |
| `src/game/` | XP, ranks, streak and badges: `gameStore`, `achievements`, `gameController`, `toastCenter`, `gameHud`, `progressView` |
| `src/lessons/` | The course. `unitNotes.ts`, `unitRhythm.ts`, `unitPiano.ts` hold every lesson with its English and Persian text side by side (`Bi`); `curriculum.ts` joins them; `lessonsView.ts` and `lessonBlocks.ts` draw them; `staffPicture`, `keysPicture`, `fingersPicture` are the pictures; `exampleXml.ts` builds the MusicXML of a picture; `exampleTimeline.ts` and `lessonPlayer.ts` make the Play buttons sound; `lessonProgress.ts` remembers what was read; `courseText.ts` fills in note tokens |
| `src/catalog/` | The song library: `types`, `parse` (compact lists), `filter` (search, artist, level, kind, sort, address query), `links` (IMSLP, MuseScore, YouTube searches), `catalogView`; the lists are in `data/*.ts` and load lazily with `loadCatalog()` |

### Writing lessons and catalog data

- **Lessons:** edit a unit file. Write each text once in English and once in Persian (`p(en, fa)`). Note names in text are tokens: `{C}`, `{F#}`, `{Bb}`, `{C4}`; they follow the student's note-name system. Staff examples use the song notation (`C4q D4q E4h | G4w`), must fill their measures (or set `free`) and the tests build every one. Persian text must start with a Persian letter, use Persian digits and no dashes (`curriculum.test.ts` checks).
- **Library:** a line `@ Artist | Artist in Persian | default level` starts an artist; songs are `Title | year | level | Title in Persian | built-in song id`. Only add songs you are sure of; leave the year out when unsure. `catalogData.test.ts` checks counts, duplicates, years, Persian letters and built-in links. Never add notes of copyrighted songs; link to sheet music instead.
- **Addresses:** `#/lessons/ID` is a screen with a name (`router.ts` `NAMED_VIEWS`); the library keeps its filter in the query and writes it with `history.replaceState`, so filtering does not add history steps.

### Tooling notes

- Vite's dev server can serve stale CSS after quick edits; restart it if a rule seems missing.
- Source files use CRLF on this machine; patch scripts must preserve it (scratch `patchlib` approach), and long `node -e` / heredoc one-liners lose backslashes in Git Bash. Write scripts to a file instead.
