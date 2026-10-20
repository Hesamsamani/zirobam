# Plan: scale & chord dictionary (honareseda parity, nothing locked) + 8 new features

## Status (update at each milestone commit)

- **M0 done** (`72f16d9`): tokens, dialog, visual guard.
- **M1 done**: pitch core and notation grammar (`src/theory/`), shared note-to-XML builder, 6/8, chord tokens, MIDI writer. Deviations from the plan: double signs are displayed `♯♯` and `♭♭` (the single-symbol glyphs are missing from most fonts); `keysPicture` still takes only `from`/`to` (its `rootNotes`, `quarter` and `heat` options come with the screens that use them, M4 and M13); the stand's count-in and measure maths now use `core/timeSignature.ts`, because a 6/8 song counted in six beats. Known and left for M6: the stand compares a played note with the staff by letter and octave, which is wrong for flat keys.
- **M2 waits for the owner's review** of the Persian scale table: `docs/persian-scales-review.md`.
- **M3 in progress**: `src/stats/` (`days`, `mistakeLog`, `srs`) is written and tested; the backup whitelist and the hooks are next. `MistakeLog` keeps `notes`, `chords` and `rhythm`, not a separate `keys` map: the keyboard heat map is derived from the notes with `keyName`.

## Context

The owner wants every feature of honareseda.com/scale/ ("smart scale and chord dictionary") in this app, including the parts the site locks behind a paid account. He also approved eight more ideas: microphone input, a daily practice plan, a chord reader and detector, a rhythm trainer, a backing band, a scale finder with a circle of fifths, a Persian music path, and a mistake heatmap. The design choice was **new screens in the app's current dark "music stand" look**, with the style sheet tidied into tokens. There will be no full redesign and no light theme.

We build everything ourselves from general music theory, using `tonal`, Verovio, Tone.js and `@tonejs/midi`. We copy no code, text or data from the site. This reverses one decision in the 2026-10-16 design doc, "no Persian quarter tones": koron and sori now become part of the core.

### What the site has (checked live in the browser on 2026-10-20)

| Area | Free on the site | Locked on the site (all free here) |
|---|---|---|
| Scales (32 types × keys; search such as "C Dorian" or Persian names; category chips) | major, natural/harmonic minor, Dorian, major/minor pentatonic | harmonic major, double harmonic major, melodic/Hungarian/Neapolitan minor, Phrygian, Lydian, Mixolydian, Locrian, chromatic, blues, whole tone, both diminished scales, **all 12 Persian modes** (dastgahs Shur, Mahur, Homayun, Segah, Chahargah, Nava, Rast-Panjgah; avazes Abu'ata, Bayat-e Tork, Afshari, Dashti, Bayat-e Esfahan) |
| Scale panel | name, semitone pattern, degree buttons, play, 2-octave piano | **staff notation** |
| Chords of the scale (degree filter, "primary only") | triad, sixth, power, quartal/quintal | seventh, suspended, 9th, 11th, 13th, add, altered, **inversions** |
| Chord dialog | notes, guitar fretboard with about 18 positions (open, barre), play, arpeggio, chord MIDI download | inversions |
| Progression generator (32 modes × 13 styles × bars, MIDI) | — | **whole tool** |
| Melody maker (bars, meter 2/4 3/4 4/4 6/8, density, contour, rhythm, range, octave, tempo; works over the scale or over the progression) | — | **whole tool** |

## Key decisions

- **Note grammar** (strings at every boundary, `Pitch {step, alter, octave}` inside the theory code): `^[A-G](##|bb|#|b|k|o)?-?\d+$`.
  - `k` = koron (−½ semitone) and `o` = sori (+½ semitone). Existing `C#4` and `Bb3` parse unchanged.
  - Piano keys and matching use the letter's own key for quarter tones (`Ek4` → E4).
  - Sound goes through `soundOf(note)`, which returns a frequency for quarter tones (the Tone Sampler repitches; checked in the code).
  - Staff: MusicXML `<alter>-0.5</alter><accidental>koron</accidental>`. Verovio 5.7 draws koron and sori; checked.
  - Persian modes are written **with no key signature** and every sign at the note. They follow an approximate 50-cent teaching model and show a disclaimer, as the site does.
- **`#/scales` becomes the dictionary.** It keeps the same view id, tile, `scales.` storage prefix, `scales-5` badge and `.sc-*` classes, so few tests change.
  - Deep links: `#/scales/d-shur`.
  - Tabs: Scales | Chords | Find.
  - New routes: `#/generator?t=prog&root=2&mode=dorian&style=jazz&bars=8&seed=123` (tabs Progression | Melody | Band), `#/chords`, `#/tuner`, `#/rhythm`, `#/persian`, `#/today`.
- **Chords for Persian modes** are built only from the mode's 12-TET notes. A quarter-tone degree shows "no chord" with a short explanation. The progression generator gives Persian modes open-fifth, sus or power voicings.
- **6/8:** `songBuilder` and `exampleXml` gain `beats: 2|3|4|6` and `beatType: 4|8`. Progressions and the band stay in 4/4.
- **Keep `main.ts` from growing:** a new `src/app/featureViews.ts` builds all the new views from one `FeatureDeps` object, and `setupNavigation` loops over it. That adds about 30 lines to `main.ts`.
- **i18n stays manageable:** about 500 new keys go in per-feature part files, `src/i18n/locales/parts/<feature>.en.ts` and `<feature>.fa.ts`. These are spread into `en.ts` and `fa.ts`, so the parity typing and tests are unchanged.
- **CSS:** `:root` tokens move to `src/styles/tokens.css`. Each feature gets its own file, `src/styles/<feature>.css`, imported after `style.css`. New CSS uses logical properties only. Staff, keys, fretboard and circle stay `dir="ltr"`.
- **Menu:** 11 tiles become 17. Home gets a "Today" card at the top. The tiles stay in the existing two groups, Path and Tools.

## Design direction (new screens, current look)

- **Palette:** the existing tokens.
  - Dark wood for screen surfaces (`--bg`, `--bg-warm`, `--surface`).
  - Cream **paper** (`--paper`, `--ink`) only for things that are music: staves, chord flashcards, the fretboard.
  - Brass (`--current #c9a227`) means "selected / now".
  - `--accent #8b7355` is the secondary accent.
  - One new hue, `--quarter`, a muted teal (contrast checked at 4.5:1 on `--bg`), is used **only** for koron and sori. It is never the only signal, because the glyph is always there too.
- **Type:**
  - Crimson Pro for scale names, chord symbols and Roman numerals (an engraved, musical feel).
  - Inter for controls; Vazirmatn in Persian.
  - Tabular figures for degree numbers and BPM.
  - No all-caps eyebrows, and no 01/02 section numbers.
- **The one bold element: the "interval stairs".** The scale is a strip of steps, each as wide as its interval (½, 1, 1½, and ¾ for Persian). The tonic has a brass edge and koron/sori degrees are teal. The steps are also the degree buttons (click to hear a degree, number plus name below). This makes quarter tones visible at a glance. Everything around it stays quiet.
- **Dictionary layout:**
  ```
  desktop ≥ 900px                                   phone (single column)
  [←] Scale & chord dictionary  [Scales|Chords|Find]   [←] D Shur  [Change ▾]
  +-------------------+------------------------------+  interval stairs
  | search [C Dorian] | D Shur        [Play][Along]  |  paper staff
  | category chips    | ▁▁▁▁ interval stairs ▁▁▁▁▁▁ |  keys (h-scroll)
  | scale chips       | [paper staff, koron marks]   |  chords: family chips
  | roots C C# D …    | [keys C4–C6, root in brass]  |  (scroll row)
  +-------------------+------------------------------+  cards, 2 per row
  | Chords: [triad][6][7][sus][5][4ths][9][11][13][add][alt]  degree ▾ □ I-IV-V
  | [paper flashcards; primary chords larger, brass edge]
  ```
  On phones the picker becomes a "Change scale" sheet. The chord dialog is a native `<dialog>` with a focus trap, Escape, and focus returned to the card that opened it.
- **Quality floor:**
  - 44px targets, visible focus ring token, `aria-pressed` chips.
  - Reduced motion: the tuner needle snaps and the band's chord highlight doesn't animate.
  - RTL flips panels only, never staves or keys.
  - Checked at 375px, landscape, and in English and Persian.

## Milestones (one commit each on `bilingual`; each ends green on `npm test`, `npx playwright test` and `npm run build`; tests first)

### Part 1: site parity

**M0. Tokens, CSS split, dialog.**
- First, record screenshot baselines (`e2e/visual.spec.ts`, a separate `visual` project).
- Then move tokens into `src/styles/tokens.css`. Add `--radius-*`, `--shadow-1..3`, `--surface-1..3`, `--focus-ring`, `--tap-min` and `--quarter`. Replace only exact-match values in `style.css`.
- Add `src/ui/dialog.ts` with `openDialog({title, body, onClose})`: native `<dialog>`, with an `open`-attribute fallback for jsdom.

**M1. Pitch core and notation grammar.**
- New `src/theory/pitch.ts`: `parsePitch`, `formatPitch`, `pitchMidi` (float), `pianoMidi`, `keyName`, `frequencyOf`, `soundOf`, `nearestQuarterName`, `MUSICXML_ACCIDENTAL`.
- New `src/theory/midiExport.ts`: `buildMidiFile(spec): Uint8Array` over `@tonejs/midi`. Quarter tones become ±0.25 pitch bends.
- Changes that route note handling through the new module:
  - `practice/timingEvents.ts` `normalizeNote` (fixes `Cb5` → B4, E#, B#, double signs), `core/noteUtils`.
  - `lessons/keysPicture.ts` `midiOf`, plus new `rootNotes`, `quarter` and `heat` options.
  - `i18n/noteNames.ts`: double signs, koron and sori in all three systems.
  - `songs/songBuilder.ts`: `## bb k o`, chord tokens `C4+E4+G4h`, 6/8.
  - `lessons/exampleXml.ts`, `exampleTimeline.ts`, `lessons/courseText.ts` tokens.
  - `songMaker` gets a 6/8 chip.
  - `backup/download.ts` gets `downloadBytes`.
  - The `main.ts` sampler calls go through `soundOf`.
  - The stand's `checkNoteMatch` compares by `pianoMidi`.

**M2. Theory catalog (pure).** All in `src/theory/`:
- `scaleCatalog.ts`: 32 `ScaleDef`. Each has a degree formula such as `"1 2 b3 4 5 6 b7"` or `"1 k2 b3 4 5 b6 b7"`, a category, a tonal name, en/fa search aliases, and Persian metadata (dastgah/avaz, shahed, ist).
- `spell.ts`: `spellScale` and `spellChord`. They reuse the existing root chooser: fewest signs, no doubles, key signature for church modes.
- `chordCatalog.ts`: about 45 `ChordDef` across 11 families.
- `diatonic.ts`: `chordsOfScale(spelled, {families, degree, primaryOnly, inversions})`.
- `roman.ts`.
- `search.ts`: handles both languages, removes ZWNJ, maps Arabic ي/ك to Persian ی/ک, and finds the root anywhere in the query.
- **Owner gate:** the Persian pitch table and the Persian terms are reviewed before this commit.

**M3. Practice memory (no UI).**
- `src/stats/mistakeLog.ts` (`mistakes.v1`): daily per-note, per-key, per-chord and rhythm counts. Keeps 182 days and is capped.
- `src/stats/srs.ts` (`srs.v1`): Leitner boxes 1–5 at 1/2/4/7/14 days, capped at 3,000 items.
- Wire them into the quiz, ear, stand and play-along answers.
- Whitelist every future storage prefix in `backup.ts` now.

**M4. Dictionary UI.** `scalesView.ts` becomes a shell around:
- `dictionaryState.ts` (v1 choice migrates)
- `scalePicker.ts` (search, categories, roots)
- `scalePanel.ts` (stairs, staff, keys, play, the existing fingering and play-along, Persian disclaimer)
- `chordCards.ts` (family/degree/primary filters, Roman numerals)

Deep links go through `router.ts` `NAMED_VIEWS` and `history.replaceState`. `scaleData.ts` shrinks to `fingering()`.

**M5. Chord dialog, guitar, chord MIDI.**
- `src/theory/voicing.ts`: inversions and piano voicing.
- `src/theory/guitar.ts` `guitarShapes()`: a fret-window search in standard tuning, scored on span, fingers, omissions and open strings, labelled open/barre/movable.
- `src/scales/fretboardPicture.ts`: SVG via `createElementNS`.
- `src/scales/chordDialog.ts`: notes, inversions, stacked staff, piano voicing, positions, Play / Arpeggio / Download MIDI.

**M6. Progression and melody generator** (`src/generator/`):
- `styles.ts`: 13 styles, each with templates, chord-weight policy, voicing and tempo range.
- `progression.ts`: seeded, using `seededRng`, which moves to `src/core/rng.ts`. Fills bars, applies the cadence, uses quarter-tone degree substitutes, and voice-leads in C3–C5.
- `rhythmCells.ts` and `melody.ts`: contour targets; step/leap weights; chord tones on strong beats; ends on the tonic. `toSongTokens()` turns the result into `songBuilder` notation.
- `scoreXml.ts`.
- `generatorView.ts`: controls synced to the query, Play, MIDI download, "Practise this" (stand), "Open in Song maker".

### Part 2: the approved ideas

**M7. Backing band** (`src/band/`):
- `patterns.ts`: drum, bass and comping grids per style.
- `arrange.ts`.
- `bandEngine.ts`: a `BandBackend` interface with a Tone implementation (looping `Tone.Part`, synthesized kick, snare and hat, `MonoSynth` bass, piano via the new `PianoVoice.playAt`). No new samples and nothing from the network.
- A Band tab with tempo, transpose, loop, part mutes, and chord-tone hints on the keys.

**M8. Scale finder and circle of fifths:**
- `src/theory/scaleFinder.ts` `findScales(pcs)`: keeps only scales that contain every input note, then ranks them.
- `scales/finderPanel.ts`: note chips with koron/sori toggles and MIDI/hub input.
- `scales/circleOfFifths.ts`: 24 HTML buttons on a decorative SVG ring; each opens the dictionary.

**M9. Chord reader and detector** (`src/chords/`):
- `chordDetect.ts` `nameChord()`: `Chord.detect`, preferring the reading whose root is the bass note, then respelling.
- `heldNotes.ts`: 80 ms settle.
- `chordQuiz.ts`: 5 stages, stored in `chords.stats.v1`.
- `chordsView.ts`: Detector and Quiz tabs.
- New badge `chords-25`.

**M10. Microphone and tuner** (`src/audio/`):
- `yin.ts`: YIN with parabolic interpolation.
- `noteTracker.ts`: stable frames, gate, re-attack.
- `tuning.ts`: A4 between 415 and 466 Hz; cents.
- `micInput.ts`: getUserMedia with echo, noise and gain processing off; `AnalyserNode` polled every 25 ms; mic notes dropped while the app's own voice is sounding.
- `micSettings.ts` (`mic.v1`, measure-silence calibration).
- `tuner/tunerView.ts`: note, cents needle, 12-TET or Persian snapping that shows koron and sori.
- An options switch sends mic notes into the hub as `'microphone'`.

**M11. Rhythm trainer** (`src/rhythm/`):
- `levels.ts`: 10 levels, from quarters to mixed 6/8.
- `rhythmGen.ts`: seeded.
- `tapScoring.ts`: perfect ≤35 ms, good ≤80 ms, otherwise early or late.
- `latency.ts`: median offset after dropping outliers.
- `rhythmView.ts`: Space, MIDI or pad taps timed on the audio clock, a `ClickVoice` count-in, and early/late colours on the staff.
- New badge `rhythm-5`.

**M12. Persian music path:**
- `lessons/unitPersian.ts`: about 12 bilingual lessons covering dastgah, radif and gusheh; koron and sori; each dastgah and avaz; shahed, ist and moteghayyer; Persian music on the piano. The wording stays careful and calls the model approximate.
- `persian/quarterEar.ts`: koron vs natural, koron vs flat, sori vs sharp, and finding the koron note in a motif.
- `persian/persianView.ts`: cards that link into the dictionary.
- New badge `persian-10`.
- **Owner gate:** the lesson text and terms are reviewed before this commit.

**M13. Mistake heatmap:**
- `stats/heatmap.ts`: by note, by key, rhythm summary, 8-week trend.
- `stats/heatmapView.ts`, mounted in Progress: Verovio notes with `heat-1..5` classes, a key heat map, an early/late bar, a trend SVG, and an empty state.

**M14. Today plan:**
- `today/planner.ts` `buildTodayPlan()` fits a 10-minute budget. Items due in the SRS come first, lowest box first. The old stats seed items that have no SRS history yet. At most 5 blocks, each with a plain reason.
- `today/todayStore.ts` (`today.v1`, frozen per day).
- `today/todayView.ts`.
- A home card reading "Today: n of m".
- `recordTodayDone` gives +15 XP and the badge `today-first`.

### Existing tests that change (on purpose)

- `e2e/menu.spec.ts`: 11 → 17 tiles.
- `mainMenu.test`: the tile id list.
- `e2e/game.spec.ts`: 18 → 22 badges.
- `backup.test.ts`: the new keys.
- `router.test`: the new views and parameters.
- `scaleData.test`, `scalesView.test`, `e2e/scales.spec.ts`: new kind ids and chip counts. The 8-note staff and the play-along tests stay.
- `curriculum.test`: four units.

### Reused, not rewritten

`WaitSession` (`practice/waitMode.ts`), `renderStaffPicture`, `buildKeysPicture`, `LessonPlayer`/`exampleTimeline`, `NoteStats`, `seededRng`, `ClickVoice`, `tempoStore`, the song maker and `scoreStore`, `practiseStoredScore`, `showNotice`, `createBackButton`, `safeStorage`, `gameController`, and `tonal` (`Scale`, `Chord`, `Chord.detect`, `Key`).

## Risks

- **Persian pitch sets and terms:** they live in data, carry a disclaimer and go through the owner gates in M2 and M12.
- **Mic feedback:** suppressed while the app's voice plays. The mic is not used for rhythm scoring, because of about 100 ms of latency.
- **Transport:** the band owns the Tone Transport only while its tab is open.
- **6/8 in the stand:** if the count-in breaks, "Practise this" turns off for 6/8 and shows a notice.
- **Double-sharp and double-flat glyphs** may be missing from the fonts. Use a symbol-font fallback for those spans.
- **Storage:** `mistakes.v1` and `srs.v1` have caps.

## Verification (each milestone)

1. Unit and build: `npm test` (more than 960 tests stay green, plus the new ones) and `npm run build`.
2. End to end: `npx playwright test` on all three projects, plus the `offline` project (nothing fetched from the network) and the `visual` project after M0.
3. Feature checks in the e2e tests:
   - Deep link `#/scales/d-shur` shows koron on the staff.
   - Chord dialog: Escape closes it and focus returns to the card.
   - MIDI downloads are parsed back with `new Midi(bytes)`.
   - A seeded generator URL reproduces the same chords.
   - The tuner gets a fake `getUserMedia` (a 440 Hz oscillator) and shows A4 within ±5 cents.
   - Rhythm taps are scripted with `page.keyboard`.
   - A seeded `mistakes.v1` shows the heat classes.
4. Manual: `npm run dev` and screenshots in Chrome of the dictionary, chord dialog, generator, tuner and Today. Each in English and Persian, at desktop size and 375px.
5. CLAUDE.md module map: add a row for each new module in the same commit.
