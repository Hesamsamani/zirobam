<p align="center">
  <img src="docs/images/logo.svg" width="96" height="96" alt="ZiroBam logo: a heavy Z with a notehead">
</p>

<h1 align="center">ZiroBam</h1>

<p align="center">
  <b>The ins and outs of music: read it, hear it, play it.</b><br>
  A free piano and music-reading trainer in <b>English</b> and <b>Persian</b>. It works offline.
</p>

<p align="center">
  <a href="https://hesamsamani.me/zirobam/"><b>Open the app</b></a>
  &nbsp;·&nbsp;
  <a href="README.fa.md">راهنمای فارسی</a>
  &nbsp;·&nbsp;
  <a href="#run-it-yourself">Run it yourself</a>
</p>

<p align="center">
  <a href="https://hesamsamani.me/zirobam/"><img alt="Live" src="https://img.shields.io/badge/live-hesamsamani.me%2Fzirobam-c9a227?style=flat-square"></a>
  <a href="https://github.com/Hesamsamani/zirobam/actions/workflows/pages.yml"><img alt="Deploy" src="https://github.com/Hesamsamani/zirobam/actions/workflows/pages.yml/badge.svg"></a>
  <img alt="Languages" src="https://img.shields.io/badge/English%20%C2%B7%20Persian-right--to--left%20ready-2f6fd1?style=flat-square">
  <img alt="Offline" src="https://img.shields.io/badge/works-offline%20%C2%B7%20installable-2f6b43?style=flat-square">
  <img alt="Licence" src="https://img.shields.io/badge/licence-LGPL--3.0-5b44b8?style=flat-square">
</p>

<p align="center">
  <img src="docs/images/home.png" width="880" alt="The home screen of ZiroBam: the mark on a staff, the name, today's plan, where you left off and the ways to practise">
</p>

**ZiroBam** (Persian *zir o bam*, "treble and bass", and also "the ins and outs") teaches you to read music and play the piano. Read a staff, hear it, play it on a MIDI keyboard, the on-screen piano or your computer keyboard, and get an answer at once. It starts from the very first note and goes as far as Persian quarter tones.

## What is inside

| | | |
|---|---|---|
| **Read** | Sight-reading levels | Twenty levels from whole notes in C to eighths and sixteenths in many keys, right hand, left hand and both, with the notes made fresh every time |
| | Songs | Well-known tunes practised bar by bar, with a measure map and a "put it together" step; or bring your own MusicXML or MIDI file |
| | Note quiz | "Name the note" with five stages that open as you improve |
| **Hear** | Ear training | Intervals, chords and short melodies to play back, and **quarter tones** (koron and sori) |
| | Tuner | Sing or play into the microphone and see the note and how far from in tune it is, with a mode for Persian quarter tones |
| **Play** | Rhythm trainer | Ten levels of rhythm tapped in time with the clicks, scored to the millisecond |
| | Chord reader | Play a chord and see its name, or be shown a name and play the chord |
| | Xylophone | One row of your computer keyboard becomes a xylophone |
| **Understand** | Lessons | Forty-seven short lessons on notes, rhythm, the keyboard, and Persian music |
| | Scale and chord dictionary | Thirty-two scales and thirty-seven chords in every key, on the staff and the keys, with fingering and guitar shapes, and a finder that names a scale from the notes you play |
| | Persian music | The twelve dastgahs and avazes with koron and sori drawn and heard |
| **Create** | Music maker | A chord progression, a melody and a backing band in thirteen styles on any scale; practise it, edit it, or download it as MIDI |
| **Keep going** | Today | A ten-minute plan made from what you missed |
| | Progress | Ranks, a daily goal, badges, and a map of the notes you slip on |

## See it

<table>
  <tr>
    <td width="50%"><img src="docs/images/dictionary.png" alt="The scale dictionary showing D Shur with a koron on the staff and the keys"><br><sub><b>Dictionary.</b> D Shur, with its quarter tone drawn on the staff and the keys.</sub></td>
    <td width="50%"><img src="docs/images/stand.png" alt="The music stand with a staff and the on-screen piano"><br><sub><b>Practice.</b> A staff, the on-screen piano and the control bar.</sub></td>
  </tr>
  <tr>
    <td width="50%"><img src="docs/images/maker.png" alt="The music maker in the light theme with eight bars of jazz chords"><br><sub><b>Music maker.</b> Eight bars of jazz chords, in the light theme with the blue accent.</sub></td>
    <td width="50%"><img src="docs/images/home-light-fa.png" alt="The home screen in Persian, right to left, in the light theme"><br><sub><b>Persian.</b> The whole app turns right to left; the staff and the keys stay as they are.</sub></td>
  </tr>
</table>

<p align="center">
  <img src="docs/images/phone-home.png" width="260" alt="The home screen on a phone">
  &nbsp;&nbsp;
  <img src="docs/images/phone-drawer.png" width="260" alt="The menu on a phone, opened from the edge">
</p>
<p align="center"><sub>On a phone the menu opens from the edge of the screen.</sub></p>

## Made to feel good

- **Two languages, really.** English and Persian, with the layout turned right to left, Persian digits, and three ways to name notes: letters (C D E), solfège (Do Re Mi) and Persian solfège.
- **Dark, light, or the device's.** Six accent colours, a rail that opens over the page, and a quick button for the language and the theme on every screen.
- **Works without internet.** The piano sounds, the fonts and every screen are part of the app. Install it from the browser like any other app. When a new version is ready it asks before it switches.
- **Nothing leaves your device.** Progress, scores and settings stay in your browser, and a backup file moves them to another one. No accounts, no tracking, no requests to other sites.
- **Any way to play.** A MIDI keyboard, the on-screen piano, or the computer keyboard (by physical key, so a Persian layout works too).

| Computer keys | Notes |
|---|---|
| `A S D F G H J K L ;` `'` | white keys, C4 to F5 |
| `W E T Y U O P` | black keys |
| `Z` / `X` | octave down / up |

## Run it yourself

You need [Node.js](https://nodejs.org/) 20 or newer.

```bash
npm ci
npm run dev        # http://localhost:5173/zirobam/
```

| Command | What it does |
|---|---|
| `npm test` | Unit tests (Vitest) |
| `npx playwright test` | End-to-end tests (desktop, phone and phone-landscape, plus an offline run on the production build) |
| `npm run build` | The production build in `dist/`, with the offline worker |
| `node scripts/readme-shots.mjs` | Takes the pictures of this page again |

On Windows, `Start-Trainer.ps1` starts the app and opens the browser (the Desktop shortcut runs it).

Built with Vite and TypeScript with no UI framework, [Verovio](https://www.verovio.org/) for the notation, [Tone.js](https://tonejs.github.io/) for sound, [tonal](https://github.com/tonaljs/tonal) for music theory and [@tonejs/midi](https://github.com/Tonejs/Midi) for MIDI files. How it fits together is in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), and how to contribute is in [CONTRIBUTING.md](CONTRIBUTING.md).

## Credits and licence

ZiroBam is free software under the **GNU Lesser General Public License 3.0** (see [LICENSE](LICENSE)). It grew out of the open-source sight-reading app [ftrain/sightreading](https://github.com/ftrain/sightreading) by Paul Ford (LGPL-3.0); the changes since then are in the git history.

- **Piano sounds:** the Salamander Grand Piano by Alexander Holm, [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) (copied from the Tone.js samples; see `public/samples/salamander/README.md`).
- **Notation engine:** [Verovio](https://www.verovio.org/) (LGPL-3.0).
- **Libraries:** Tone.js, tonal and @tonejs/midi (MIT), JSZip (MIT or GPL-3.0).
- **Fonts:** Inter and Crimson Pro through `@fontsource`, and Vazirmatn (SIL OFL 1.1).
- **Song notes:** the public-domain tunes were read from the LilyPond scores on English and German Wikipedia (CC BY-SA 4.0) and from The Session's ABC settings; see `src/songs/libraryMore.ts`. The song library lists titles, artists and levels only, with links to the sheet music; it contains no notes of copyrighted songs.
- **Persian terms and quarter-tone pitches** are a teaching model and are marked as a draft in the app; see `docs/persian-scales-review.md`.
