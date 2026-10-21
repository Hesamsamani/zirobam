# Persian scales: draft table for the owner's review

Status: **draft, written 2026-10-21 for milestone M2.** The dictionary teaches these twelve modes, so the pitch table should be checked by someone who knows the music. Nothing here has been checked by an expert; it comes from three public sources and I could not settle every disagreement between them.

**Decision (2026-10-21):** the owner chose to ship the draft as it stands, with every Persian mode marked `reviewed: false` in `src/theory/scaleCatalog.ts` and shown as approximate on screen. To correct a mode, change its formula or default root there and in the table of `src/__tests__/scaleCatalog.test.ts` (the test pins the table on purpose), then set `reviewed` to true.

## How to read the table

- **Root** is the finalis, the note the mode comes to rest on. The dictionary builds the scale on it, so "C Shur" means Shur with its finalis on C.
- **k** (koron) is a quarter tone lower than the written note, **o** (sori) a quarter tone higher. In the app a koron note is written `Ek`, a sori note `Co`.
- **Formula** gives each degree against the major scale on the root: `k2` is the major second lowered by a quarter tone. This is the form the app stores.
- Every quarter tone is the 50-cent teaching model, not a measured pitch. The screen says so.

## Sources

| Short name | What it is |
|---|---|
| Farhat | The scale table of the English Wikipedia article "Dastgah" (after Hormoz Farhat, *The Dastgah Concept in Persian Music*, 1990). It writes the scale in the register of C and marks the finalis. |
| FIS | The Iranian academic e-book "Persian system of modes" (fis-iran.org). It writes each scale in the register of G or F, without marking the finalis. |
| Oud | A guitarist's comparison page of maqams and dastgahs (oudforguitarists.com). The weakest source; used only as a tie-break. |

Farhat's marks on a note are letters after it: `f` finalis, `a` āghāz, `i` ist, `ŝ` šāhed, `m` moteghayyer (a note that varies). `p` means koron.

## The seven dastgahs

| Mode | Root | Notes from the root | Formula | Sources |
|---|---|---|---|---|
| Shur (شور) | D | D Ek F G A Bb C | 1 k2 b3 4 5 b6 b7 | Farhat, FIS and Oud agree. The fifth is variable (natural or koron); the draft uses the natural fifth. |
| Mahur (ماهور) | C | C D E F G A B | 1 2 3 4 5 6 7 | All three agree: the major scale. |
| Homayun (همایون) | G | G Ak B C D Eb F | 1 k2 3 4 5 b6 b7 | Farhat and FIS agree; Oud writes the same notes in another register. |
| Segah (سه‌گاه) | Ek | Ek F G Ak Bb C D | 1 k2 k3 4 k5 k6 k7 | Farhat and Oud agree. FIS gives a different list (F G Ap Bp C Dp Eb), which I could not match. |
| Chahargah (چهارگاه) | C | C Dk E F G Ak B | 1 k2 3 4 5 k6 7 | All three agree. |
| Nava (نوا) | G | G A Bb C D Ek F | 1 2 b3 4 5 k6 b7 | The notes agree with FIS (which lists them from D). The finalis G is from Farhat only. |
| Rast-Panjgah (راست‌پنجگاه) | F | F G A Bb C D E | 1 2 3 4 5 6 7 | Farhat and FIS agree. Oud lists a plain C scale, which I took as a different register. |

## The five avazes (sources disagree: your decision needed)

An avaz is a branch of a dastgah. Farhat and FIS agree on the notes of some avazes but write them in different registers, so the finalis is unclear, and for two of them the notes differ.

| Mode | Farhat, from its finalis | FIS, as written | What disagrees |
|---|---|---|---|
| Abu'ata (ابوعطا) | D Eb F G Ak Bb C: `1 b2 b3 4 k5 b6 b7` | G Ak Bb C D Eb F | Same notes, written from G. The finalis D is from Farhat. Oud differs (a Shur-like scale). |
| Bayat-e Tork (بیات ترک) | F G A Bb C D Ek: `1 2 3 4 5 6 k7` | F G Ak Bb C D Eb: `1 2 k3 4 5 6 b7` | **Different notes** (A against A koron, E koron against E flat). |
| Afshari (افشاری) | C D Eb F G Ak Bb: `1 2 b3 4 5 k6 b7` | F G Ak Bb C D Eb | Same notes; Farhat's finalis is C, FIS writes from F. |
| Dashti (دشتی) | D Eb F G A Bb C: `1 b2 b3 4 5 b6 b7` | G Ak Bb C D Eb F | **One note differs** (Farhat has Ab where FIS has A koron, once moved to the same register). |
| Bayat-e Esfahan (بیات اصفهان) | G A Bb C D Ek F#: `1 2 b3 4 5 k6 7` | G Ak B C D Eb F | **Different notes**: FIS gives the same notes as Homayun. |

## What I need from you

1. **The seven dastgahs:** do the roots and notes above look right to you? Any you know to be wrong?
2. **The five avazes:** pick one for each, or all at once:
   - use Farhat's version as written above (the most citable in English), with the screen saying the modes are approximate;
   - use a reference you trust (a book or your teacher): send me the notes from the finalis for each avaz;
   - leave the avazes out of the first version and add them once checked.
3. **The Persian names** of the modes and the words «کرن» and «سری»: as written here, or another spelling you prefer?

Whatever you choose is stored as data in one file, with a test that pins it, so a correction later is a one-line change.
