# Candidate apps: learning to read music notes

Research date: 2026-10-16. Goal: find an existing, legally modifiable app that teaches note reading, then improve it (bilingual English/Persian, usable without a MIDI keyboard).

## Method
- GitHub: about 400 repositories from 27 keyword and topic searches (`sight reading`, `music notes trainer`, `ear training`, `solfege`, topics `music-education`, `sight-reading`, …), then license, activity and file-tree checks with the `gh` CLI.
- Web: English and Persian searches (alternativeto.net, Cafe Bazaar, Zoomit, Digikala Mag).
- Filters: a declared open license (we must be able to modify and share), recent activity, teaches reading notes, runs without installing a toolchain.

## Result

| Candidate | Stars | License | Stack | Teaches | Decision |
|---|---|---|---|---|---|
| **ftrain/sightreading** | 13 | LGPL-3.0 | TypeScript, Vite, Verovio, Tone.js, tonal | Reading notes on the grand staff: 23 levels, MIDI feedback, metronome, mastery tracking, songs, MusicXML/MIDI upload | **Chosen base.** 190 unit tests pass, production build works, 0 vulnerabilities in shipped dependencies |
| ZaneH/piano-trainer | 2,209 | MIT | React (CRA), Tauri, react-i18next | Scales, chords, fifths quiz on a keyboard; no staff | Not chosen: does not teach reading notes. Languages shipped: br, de, en, fr, ja, zh (no Persian). Used only as a design reference |
| leafo/sightreading.training | 543 | none declared | JavaScript | Sight reading, ear training | Not usable: without a license, modified copies cannot be legally shared. Useful as a UX reference only |
| BHSPitMonkey/Prelude | 38 | none declared | TypeScript | Sight reading | Not usable (no license); last push 2024 |
| davidgilbertson/sight-reader | 58 | none declared | JavaScript | Piano sight reading | Not usable (no license); last push 2016 |
| Jaybee18/mfp | 9 | GPL-3.0 | SvelteKit | MIDI piano playing | Plays MIDI files; no note reading |
| SeeLook/nootka | 45 | GPL-3.0 | C++ / Qt | Reading, ear training, desktop | Mature, has translations (no Persian), but a large native codebase (112 MB) |
| opensheetmusicdisplay/osme | 19 | BSD-3 | TypeScript | Sight-reading generator | Last push 2020 |
| spark404/jalmus, Vernalhav/levada, snowme34/tone-the-ear | 8–15 | none / GPL | Java / TS / JS | Reading, rhythm, ear | Old or unlicensed |
| "Best … 2026" repos (shelot2004, KUID57, ALog041926, AdhiNarayananS2006, williamlai98) | 53–56 | — | HTML | — | SEO spam: created weeks ago, near-identical star counts |

Search note: GitHub searches in Persian and for Persian-language music education returned no relevant repository.

## Persian apps (closed source, benchmark only)
- **Mifa (میفا)**, **Noteland (نت‌لند)**, **Haft Note (هفت نت)**, **Notes-e-Farsi** on Cafe Bazaar: note reading as a game, rhythm reading, microphone feedback, theory lessons. They show what Persian learners expect. None is open source.

## Gap this project fills
No open-source app teaches note reading well **and** ships a Persian interface. The base app also needs a MIDI keyboard to practise, so a beginner without one cannot use it.

## Why the license matters
LGPL-3.0 allows modification and redistribution if the license and credit stay and changes are marked. This project keeps the upstream `LICENSE`, credits `ftrain/sightreading`, and marks its changes in the README. Verovio (the notation engine) is LGPL-3.0 as well.
