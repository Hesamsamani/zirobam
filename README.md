# Music Notes Trainer (English / فارسی)

A personal study fork of [ftrain/sightreading](https://github.com/ftrain/sightreading), extended so a beginner can learn to read music notes in **English or Persian**, with or without a MIDI keyboard. Persian README: [README.fa.md](README.fa.md).

## What this fork adds

- **Main menu.** Lessons, Note quiz, Sight-reading levels, Songs, Song library, Xylophone, Metronome, Progress and Settings. Every screen has its own address (`#/lessons/octaves`, `#/catalog?artist=Queen`), so the Back button, reloads and shared links work.
- **English and Persian interface**, with right-to-left layout for Persian text. The staff, the piano, the keyboard pictures and the note buttons stay left-to-right. Choose the language in Options (the three-dot button).
- **Three ways to name notes:** letters (C D E), solfège (Do Re Mi) and Persian solfège (دو ر می). The choice applies everywhere: level names, the piano, the quiz, the lessons and, if you tick "Show note names on the staff", under every note.
- **Play without a MIDI keyboard.** The piano button opens an on-screen piano, and the computer keyboard plays notes too (table below). Keys are matched by position, so it also works with a Persian keyboard layout.
- **Lessons (36).** Three units: reading notes (staff, clefs, ledger lines, octaves, sharps and flats, key signatures), reading rhythm (beat, note values, rests, time signatures, counting, dotted notes, ties) and playing the piano (keyboard, finding notes, posture, fingering, five-finger position, both hands, touch, scales, pedals, practising). Each lesson has drawn staff examples with a Play button, clickable keyboards, hand pictures and "Try it" links. Read lessons are remembered.
- **Note quiz.** "Name the note": one note on a staff, seven answer buttons, or play the note on any input. Notes you miss come back more often, and five stages unlock after 20 answers at 90 percent.
- **Songs.** 45 built-in songs and exercises in groups by difficulty, 22 of them real public-domain tunes with their notes: carols (Silent Night, Joy to the World, O Come All Ye Faithful), folk songs (Amazing Grace, Auld Lang Syne, Greensleeves, Scarborough Fair, Danny Boy, When the Saints), children's songs and classical themes (Für Elise, Eine kleine Nachtmusik, Brahms' Lullaby). A song is practised in small steps with a measure map, jump buttons and a "put it together" step. You can also practise from your own MusicXML or MIDI file.
- **My scores and the song maker.** Attach your own MusicXML, MXL or MIDI file to any library song (or open a file without a row) and practise from it; the file stays in this browser. "Write a song" lets you type or tap your own melody (any of 15 keys, 2/4, 3/4 or 4/4), shows it on the staff as you write, checks every measure and practises it like a built-in song.
- **Offline and installable.** The production build works without internet and can be installed as an app (Options shows an Install button where the browser allows it).
- **Backup and restore.** One button (in Options and under the progress) saves your XP, badges, lesson progress, settings and every score into a JSON file; another restores it, in any browser, after showing what the file contains and asking first. Files with the wrong marker, a newer version, unknown keys or odd scores are refused or trimmed.
- **Song library.** About 4,570 songs by 287 artists (Persian pop and classics, international pop and rock from the 1950s to today, classical and traditional works, modern piano, film, game and anime music). Each song has an estimated level; filter by search, artist, level and kind of music. The library finds the sheet music for you (IMSLP for classical works, MuseScore for the rest); songs marked "In the app" play right inside it.
- **Practice aids** (the small sliders button next to "Whole piece"). *Wait for me*: the piece stops at each note and moves on when you play it (no count-in, no tempo; a chord waits for all its notes). *Repeat this step*: a step you played well comes again. *Speed up as I improve*: after each clean pass the tempo goes up by 5 until it reaches your tempo. Quick speeds of 50, 75 and 100 percent. *Hands*: practise the right or the left hand alone; the app plays the other one and draws it faintly.
- **Xylophone.** One row of the computer keyboard becomes a xylophone, left to right: free play, read and play, and play-along songs.
- **Floating metronome.** A small always-on-top window (Document Picture-in-Picture in Chrome and Edge 116+, with a draggable panel as the fallback) that shares its tempo with the exercise.
- **Rewards.** XP and ranks, a daily goal with a streak, 16 badges, a combo counter and stars for songs. Everything stays in the browser.
- **Phones:** the control bar wraps onto two rows so every button, including Options, stays reachable.
- **Planned:** microphone input for an acoustic instrument.

| Computer keys | Notes |
|---|---|
| `A S D F G H J K L ;` `'` | white keys, C4 to F5 |
| `W E T Y U O P` | black keys |
| `Z` / `X` | octave down / up |

## Run it

On Windows, double-click the Desktop shortcut **Music Notes Trainer**. It starts the app and opens your browser; close its window to stop. (Double-clicking `Start-Trainer.ps1` itself only opens it in an editor.) The shortcut runs `powershell.exe -NoProfile -ExecutionPolicy Bypass -File "<this folder>\Start-Trainer.ps1"` and uses the icon `Start-Trainer.ico`, so it can be recreated by hand. From a terminal: `powershell -ExecutionPolicy Bypass -File Start-Trainer.ps1`.

By hand:

```bash
npm ci
npm run dev      # http://localhost:5173/sightreading/
npm test         # unit tests
npx playwright test
npm run build
```

## Known limitations

- The app needs no internet after its first load: the piano sounds, the fonts and every screen are served from the app's own files, and a service worker (production build only) keeps them in the browser. The development server (`npm run dev`) has no service worker, so there the app needs the dev server.
- A new version of the app is used the next time it is opened after the update (the old files stay until then).
- Persian music terms (دیز, بمل, the lesson texts, the level names) are waiting for the owner's review.
- The song library lists titles, artists and an estimated level. It contains no notes of copyrighted songs: the notes come from the sheet-music links or from your own file. The lists were put together by hand, so a few details may be wrong, and the Persian list is shorter than the international one.
- All unit tests (about 960) and all end-to-end tests (about 500, on desktop, phone and phone-landscape profiles) pass.
- Audit warnings in dev tooling (Vite, Vitest, gh-pages) are not fixed yet; nothing in the shipped bundle is flagged.

Design: [docs/superpowers/specs/2026-10-16-bilingual-note-trainer-design.md](docs/superpowers/specs/2026-10-16-bilingual-note-trainer-design.md). Why this base app was chosen: [research/candidates.md](research/candidates.md).

## Credits and license

The notes of the public-domain songs were read from the LilyPond scores on English and German Wikipedia (CC BY-SA 4.0) and from The Session's ABC settings, compared with each other and with the well-known tunes; see `src/songs/libraryMore.ts`. The tests check the length of every measure and the first notes of every tune, so please tell us if a song sounds wrong anywhere else.

Piano sounds: the Salamander Grand Piano by Alexander Holm, licensed CC BY 3.0 (copied from the Tone.js samples; see `public/samples/salamander/README.md`). Fonts: Inter and Crimson Pro through `@fontsource` and Vazirmatn (SIL OFL 1.1).

Based on `ftrain/sightreading` at commit `05158c5` (LGPL-3.0). The original `LICENSE` is kept and this fork stays under LGPL-3.0. Changes made in this fork are the ones listed above and in the git history of the `bilingual` branch. The notation engine, [Verovio](https://www.verovio.org/), is LGPL-3.0 too.

---

# Sight Reading Practice (upstream README)

**[Try it live](https://ftrain.github.io/sightreading)** | [GitHub](https://github.com/ftrain/sightreading)

A web-based sight reading practice app for piano. Generates infinite procedural exercises with a structured curriculum that progresses from simple whole notes to complex rhythms across multiple keys.

## Features

- **Structured Curriculum**: 23 levels progressing through C major fundamentals, advanced rhythms, then new keys (G, F, D, Bb, etc.)
- **Interleaved Hand Practice**: Each concept is practiced RH → LH → Both hands before advancing
- **MIDI Input**: Connect your MIDI keyboard for real-time note detection
  - Correct notes highlight in teal
  - Wrong notes highlight in red
  - Forgiving timing (early notes accepted)
- **Metronome**: Count-off with 4-3-2-1 display, 16th note subdivisions
- **Grand Staff**: Clean notation with treble and bass clefs
- **Progress Tracking**: Mastery system requires consistent correct play before advancing
- **Tempo Progression**: Start slow (30 BPM), increase as you master each level

## Curriculum Overview

### C Major Foundation (Levels 1-7)

| Level | Focus | Hands |
|-------|-------|-------|
| 1 | Whole notes, C-G range | RH only |
| 2 | Whole notes, bass clef intro | LH only |
| 3 | Whole notes, coordination | Both |
| 4 | Half notes | RH → LH → Both |
| 5 | Quarter notes | RH → LH → Both |
| 6 | Rests, 3/4 time | RH → LH → Both |
| 7 | Dotted notes, wider intervals | RH → LH → Both |

### C Major Advanced Rhythms (Levels 8-10)

| Level | Focus | Hands |
|-------|-------|-------|
| 8 | Eighth notes | RH → LH → Both |
| 9 | Dotted eighth rhythms | RH → LH → Both |
| 10 | Sixteenth notes | RH → LH → Both |

### New Keys (Levels 11+)

Each new key follows the same pattern (RH whole → LH whole → RH varied → Both):
- 11a-d: G major (1 sharp)
- 12a-d: F major (1 flat)
- 13a-d: D major (2 sharps)
- And so on through the circle of fifths...

## Controls

- **Tempo**: Set BPM (starts at 30 for beginners)
- **Metronome**: Toggle on/off, adjust volume
- **Level +/-**: Manually adjust difficulty
- **Options**: Access level jump, key override, and fingering settings
- **Start/Stop**: Begin or end practice session

## Tech Stack

- [Vite](https://vitejs.dev/) - Build tool
- [TypeScript](https://www.typescriptlang.org/) - Type safety
- [Verovio](https://www.verovio.org/) - Music notation rendering (MusicXML → SVG)
- [Tone.js](https://tonejs.github.io/) - Web audio (metronome, sounds)
- [Playwright](https://playwright.dev/) - E2E testing
- [Vitest](https://vitest.dev/) - Unit testing
- Web MIDI API - MIDI keyboard input

## Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Run unit tests
npm test

# Run E2E tests
npx playwright test

# Build for production
npm run build

# Deploy to GitHub Pages
npm run deploy
```

## Architecture

```
src/
├── core/             # Shared types, events, utilities
├── curriculum/       # Lessons and progress tracking
│   └── lessons/      # Lesson implementations
├── input/            # MIDI and performance tracking
├── music/            # Music generation and representation
│   ├── generators/   # Melody, pattern, scale generation
│   ├── sources/      # MusicSource implementations
│   └── xml/          # MusicXML building
├── playback/         # Audio playback engine
├── rendering/        # Visual rendering (Verovio)
├── main.ts           # App entry, UI, playback scheduling
├── musicGenerator.ts # Procedural music generation, curriculum
├── scheduler.ts      # Timing utilities for playback
├── fingeringEngine.ts# Piano fingering suggestions
└── __tests__/        # Unit tests
```

Key data flow:
1. `musicGenerator` creates `NoteData[]` for each hand
2. `buildTimingEvents()` extracts timing from note data
3. `scheduleMusic()` schedules playback via Tone.js
4. `visualGroups` maps SVG elements for highlighting

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

LGPL-3.0 - See [LICENSE](LICENSE) for details.

Uses [Verovio](https://www.verovio.org/) (LGPL-3.0).
