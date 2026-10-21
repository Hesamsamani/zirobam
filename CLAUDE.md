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
| `src/ui/dialog.ts` | `openDialog({ title, body, className?, onClose? })`: a modal `<dialog>` (native `showModal()`, `open` attribute where there is none, as in jsdom) that traps Tab, closes on Escape, Close or the backdrop, calls `onClose` once and returns the focus to its opener. Styles in `src/styles/dialog.css` |
| `src/styles/` | `tokens.css` is the one place for design tokens (colours, `--surface-1..3`, `--line-*`, `--radius-*`, `--shadow-1..3`, `--tap-min`, `--focus-ring`, and `--quarter`, a teal reserved for koron and sori); it loads before `style.css`. Feature sheets (`dialog.css`, later one per feature) load after it and use logical properties only. `--text-subtle` is 2.4:1 on `--bg`: decoration, never words that matter. `--text-soft` (5.3:1 or better on every surface) is for small text on cards; `--text-muted` fails AA on `--surface-3` |
| `src/theory/pitch.ts` | The one reading of a note. Grammar `^[A-G](##\|bb\|#\|b\|k\|o)?-?\d+$`: `k` koron (a quarter tone down), `o` sori (up); `C#4` and `Bb3` read as always. `parsePitch` / `parseNoteName` (octave optional), `formatPitch`, `noteString(step, alter, octave)` for the loose parts a parsed score keeps, `pitchMidi` (float: Ek4 is 63.5), `pianoMidi` (the key struck: a quarter tone is struck on its own letter, Ek4 on E4), `keyName` (sharp name of the key: Cb5 is B4), `frequencyOf`, `soundOf` (a sharp name for the sampler, a frequency in Hz for a quarter tone), `MUSICXML_ACCIDENTAL` (Verovio draws `koron` as SMuFL E460 and `sori` as E461). The old text-replacing normalizers in `timingEvents.ts` and `core/noteUtils.ts` now call `keyName` |
| `src/theory/midiExport.ts` | `buildMidiFile(spec): Uint8Array` over `@tonejs/midi` (480 ticks to a quarter note, beats counted in quarter notes, a drum track by MIDI number on channel 9) and `midiFileName`. A quarter tone is its letter's key plus a pitch bend of a quarter of the 2-semitone range. **The library writes a bend as given but reads it divided by 8192**, so a bend must be given in 14-bit units (-2048); `midiExport.test.ts` reads the bytes back to catch a slip. `backup/download.ts` has `downloadBytes` for the file |
| `src/theory/` (the dictionary's logic, all pure) | `scaleCatalog.ts`: the 32 scales as formulas of degrees against the major scale (`1 k2 b3 4 5 b6 b7`; `b # bb ##`, `k` koron, `o` sori), with category, search aliases in both languages, and for the 12 Persian modes their family, parent dastgah, default root and `reviewed: false` (the table is a draft, `docs/persian-scales-review.md`; `scaleCatalog.test.ts` pins it). `spell.ts`: `spellScale(root, id)` (a number 0 to 11 picks the spelling with the fewest signs and no double sign if another exists, exactly as the old screen did; a text such as `Ek` is used as written) and `spellAbove(root, degrees)`; a note three quarter tones off its letter is written from the next letter (B flat koron is A sori). `fifths` only for modes of the major scale; Persian modes carry their signs on the notes. `chordCatalog.ts`: 37 chords in 11 families with `tonal` interval names, `spellChord` (harmonic spelling). `diatonic.ts`: `chordsOfScale(scale, { families, degree, primaryOnly })` keeps a chord only if every tone is a piano note of the scale (quarter tones are no root and no chord tone) and `inversionsOf`; C major gives 27 chords in the free families of the reference site, which `diatonic.test.ts` pins. `roman.ts`, `search.ts` (`searchScales("C Dorian" / "ماهور ر")`, a root anywhere, English and Persian, Arabic yeh and kaf normalised). `keySignature.ts`: `keyAlter`, `fifthsOfNames`. Names shown to the student are in `locales/parts/theory.*` (`scale.name.<id>`, `chord.name.<id>`, `scale.cat.*`, `chord.family.*`), checked by `theoryNames.test.ts` |
| `src/core/timeSignature.ts` | `beatsPerMeasure(sig)` (quarter notes in a bar: 6/8 is 3) and `countInBeats(sig)`. The stand's transport counts quarter notes, so its count-in and measure maths use these, never `timeSig.beats` |
| `src/songs/songBuilder.ts` (notation) | Besides `E4q F#4e Bb3h.`: `##` `bb` `k` `o`, chord tokens `C4+E4+G4h` (the lowest pitch is the main note, the rest are in `ParsedNote.chord`), and `beats: 6, beatType: 8` for 6/8 (the left hand gets a whole-measure rest). `measuresXml(measures, { fifths, staff, kind })` is shared by the song builder (`kind: 'song'`: refuses a plain letter where a sign is in force, indented) and the lesson pictures (`'picture'`) |
| `src/stats/` | What the student knows and misses. `days.ts` (`dayString`, `addDays` counted in UTC, `isDay`); `mistakeLog.ts` (`mistakes.v1`: per day, how often each written note and chord was asked and missed, plus rhythm verdicts; keeps 182 days, 300 entries a day, names up to 24 characters, and drops the oldest days if the text passes 1.5 MB, under the 2 MB a backup takes; a day's notes feed the heat map by `keyName`); `srs.ts` (`srs.v1`, Leitner: new items start in box 1, a right answer climbs a box, a wrong one returns to box 1, due after 1, 2, 4, 7 or 14 days; at most 3000 items, the best known go first); `practiceMemory.ts` (`PracticeMemory`: `noteAnswered`, `keyPressed(expected, played, right)`, `earAnswered`; `answersFromPress` credits a pressed A sharp to a written B flat). `main.ts` calls it from the quiz, ear training, and the stand in wait mode and in timed mode. Both stores take an injected storage and clock, never throw, and read a damaged blob as empty |
| `src/i18n/locales/parts/` | Per-feature strings: `<feature>.en.ts` (`as const`) and `<feature>.fa.ts` (typed `Record<keyof typeof part, string>`), spread into `en.ts` and `fa.ts`, so the parity tests cover them. `ui.*` holds `dialog.close` |

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
| `src/ear/`, `src/scales/` | Ear training: `questions.ts` (pure, seeded, five stages, `EarQuestion` with its `plan` of sounds), `earView.ts` (stages unlock like the quiz through `NoteStats` key `earStats.v1`; the question is kept in `window.__earQuestion` for the e2e tests; stage 5 is answered on a `buildKeysPicture` keyboard or MIDI through `WaitSession`). The scale and chord dictionary (route `#/scales`, deep link `#/scales/d-shur`): `scalesView.ts` is the shell (aside with the picker, tabs Scales and Chords; on a phone the picker folds behind `.dict-toggle`) around `scalePicker.ts` (search in both languages, category chips, 12 root chips, a koron toggle), `scalePanel.ts` (the interval stairs, `stairs.ts`; staff through `renderStaffPicture` with the fingers from `fingering.ts` as the labels; keys picture with the root and the quarter tones marked; Persian disclaimer; play along through `WaitSession`) and `chordSection.ts` (family chips, degree, main chords only, inversions, paper cards, optional `onOpen` for the chord dialog). `dictionaryState.ts` keeps the choice (`scales.v2`, migrates `scales.v1`) and the address token (`rootToken`, `formatParam`, `parseParam`). `scaleData.ts` is only kept for the fingering parity tests. A third tab, Find (`Tab` is `scales`, `chords` or `find`), holds `finderPanel.ts` (twelve note chips or MIDI keys; `theory/scaleFinder.ts` `findScales(pcs, limit)` lists the scales that contain every note, exact fits and fewest extra notes first, scales with a quarter tone left out) and `circleOfFifths.ts` (24 real buttons on a decorative SVG ring, `theory/circle.ts` `circleKeys()`; the six-sharp key is F sharp); strings in `parts/finder.*.ts`.  A card opens `chordDialog.ts` (`openChordDialog(chord, { toolkit, voice, formatName, download?, notify? })` over `openDialog`): the chord on the staff (a chord token) and on the keys, every turn of it as chips (`rootPositionOf` and `inversionsOf` from `theory/diatonic.ts`), Play, Arpeggio and Download MIDI (`theory/chordMidi.ts`: the notes one after the other, then together; the file name is made from the letters of the chord, never the student's names), and the guitar shapes: `theory/guitar.ts` `guitarShapes(def, rootPc, { bassPc?, limit? })` searches every hand position on the first 15 frets (only chord tones, root or bass lowest, mutes only at the edges, a window of four frets, at most four fingers; a chord of five or six notes may drop its fifth and ninth) and labels each shape `open`, `barre` (with the bar) or `movable`; `fretboardPicture.ts` draws one as an SVG chord box (`dir=ltr`, ink on the paper card). `chordSymbol.ts` is the one place a chord's written name is made. Strings in `i18n/locales/parts/chordDialog.*.ts` (keys `cd.*`), styles in `src/styles/chordDialog.css`. Styles in `src/styles/dictionary.css`, strings in `i18n/locales/parts/dictionary.*.ts` (keys `dict.*`). Both take a `PianoVoice` (`playback/pianoVoice.ts`) built in `main.ts` from the Tone sampler. Game: `recordEarAnswer` (3 XP) and `recordScalePlayed` (5 XP), badges `ear-25` and `scales-5` (18 badges in all) |
| `src/xylophone/` | Keyboard-row xylophone: `keyRows`, `xylophoneInput`, `xyloSound`, `xyloGame`, `songMelody`, `xylophoneView` |
| `src/metronome/` | `tempoStore`, `metronomeEngine`, `metronomePanel`, `floatingWindow` (Document Picture-in-Picture with an in-page fallback), `clickVoice` |
| `src/game/` | XP, ranks, streak and badges: `gameStore`, `achievements`, `gameController`, `toastCenter`, `gameHud`, `progressView` |
| `src/lessons/` | The course. `unitNotes.ts`, `unitRhythm.ts`, `unitPiano.ts` hold every lesson with its English and Persian text side by side (`Bi`); `curriculum.ts` joins them; `lessonsView.ts` and `lessonBlocks.ts` draw them; `staffPicture`, `keysPicture`, `fingersPicture` are the pictures; `exampleXml.ts` builds the MusicXML of a picture; `exampleTimeline.ts` and `lessonPlayer.ts` make the Play buttons sound; `lessonProgress.ts` remembers what was read; `courseText.ts` fills in note tokens |
| `src/catalog/` | The song library: `types`, `parse` (compact lists), `filter` (search, artist, level, kind, sort, address query), `links` (IMSLP, MuseScore, YouTube searches), `catalogView`; the lists are in `data/*.ts` and load lazily with `loadCatalog()` |
| `src/generator/`, `src/app/featureViews.ts` | The music maker (route `#/generator?t=prog&s=d-dorian&style=jazz&bars=8&seed=123&bpm=100`, the melody tab adds `meter=44&density=&feel=&contour=&range=&oct=&over=`). Pure and seeded (`core/rng.ts`: `seededRng`, `pickWeighted`, `freshSeed`; the same options always give the same piece): `styles.ts` (13 styles: chord ids a style likes, four-bar `phrases` of degrees, `endings` that end on degree 1, a tempo range; degrees are those of the chosen scale), `progression.ts` (`generateProgression({ scale: SpelledScale, style, bars, seed, bpm? })`: phrases then an ending, a chord for each degree from `chordsOfScale`, a Persian mode only gets open chords, each chord voiced with the least movement between C3 and E5, a bass root in octave 2), `rhythmCells.ts` (meters 2/4 3/4 4/4 6/8 in sixteenths, `rhythmBar`, `UNIT_TOKEN`), `melody.ts` (`generateMelody`: a rhythm for each bar, a walk along the scale that follows the contour; stable notes (chord tones, or degrees 1 3 5) on strong beats and never a quarter tone there; the last bar is the held tonic; `melodyTokens` writes the notation of the songs and adds `n` where a sign is still in force), `scoreXml.ts` (`pieceSpec` / `pieceXml` for the stand: tune in the right hand over the chords an octave down, chords alone split at middle C; `barsOfSpec` cuts four bars to a line; `pieceMidiSpec`: Chords, Bass and Melody tracks; `songDraftOf` for "Write a song"), `pieceBuilder.ts` (`buildPiece(state, title)`; `noChords` when a scale has no chord), `playPlan.ts` (every note with its time), `generatorState.ts` (state, address query, settings `generator.v1` without the seed), `generatorView.ts` (reuses `ScalePicker` and the `dict-*` layout; Play marks the bar with `data-current`). `featureViews.ts`: `FeatureView` and `createFeatureViews(deps)`; `main.ts` only loops over them (`featureOf(view)`), so a new feature screen adds a line there and nothing to `main.ts`. `src/band/` is the backing band of the Band tab (`t=band`): `patterns.ts` (a groove for each style: drums, bass tones, comping, swing in blues and jazz, a fill in the last bar), `arrange.ts` (`arrangeBand(progression, { transpose, countIn })` gives timed events; the first bass note of a chord is its root; `chordAtBeat`), `bandPlayer.ts` (`BandPlayer`: play, stop, loop, count-in, transpose, mutes, beat and state listeners, over a `BandBackend`), `toneBackend.ts` (`createToneBackend(Tone, piano)`: synthesised kick, snare, hats, ride, toms and a `MonoSynth` bass, the sampler for the chords, a looping `Tone.Part` on the transport, which the band gives back on stop). `practice/noteMatch.ts` `noteheadMatchesKey` marks a flat's notehead when the sharp key is pressed (B flat is drawn on B and played on A sharp). Strings in `parts/generator.*.ts` (`gen.*`), styles in `generator.css` |

### Writing lessons and catalog data

- **Lessons:** edit a unit file. Write each text once in English and once in Persian (`p(en, fa)`). Note names in text are tokens: `{C}`, `{F#}`, `{Bb}`, `{C4}`; they follow the student's note-name system. Staff examples use the song notation (`C4q D4q E4h | G4w`), must fill their measures (or set `free`) and the tests build every one. Persian text must start with a Persian letter, use Persian digits and no dashes (`curriculum.test.ts` checks).
- **Library:** a line `@ Artist | Artist in Persian | default level` starts an artist; songs are `Title | year | level | Title in Persian | built-in song id`. Only add songs you are sure of; leave the year out when unsure. `catalogData.test.ts` checks counts, duplicates, years, Persian letters and built-in links. Never add notes of copyrighted songs; link to sheet music instead.
- **Addresses:** `#/lessons/ID` is a screen with a name (`router.ts` `NAMED_VIEWS`); the library keeps its filter in the query and writes it with `history.replaceState`, so filtering does not add history steps.

### Tooling notes

- Vite's dev server can serve stale CSS after quick edits; restart it if a rule seems missing.
- Line endings (checked 2026-10-20 by counting bytes): only `src/style.css` is CRLF; every other file is LF. Patch scripts for `style.css` must preserve CRLF. `grep` and `od` in Git Bash hide or mangle carriage returns, so count bytes with Node instead.
- Heredoc and `node -e` scripts lose backslashes in Git Bash (`\\(` becomes `(`, so a regex silently matches nothing). Write scripts with the Write tool, use regex literals, and check the match count before replacing.
- Visual guard: `npx playwright test --project=visual` compares six screens pixel for pixel (zero tolerance, desktop Chrome, `e2e/visual.spec.ts-snapshots/`). It is not part of the default run. Run it after any CSS refactor; accept a deliberate change with `--update-snapshots`. Re-measure geometry only after `document.getAnimations()` has finished.
