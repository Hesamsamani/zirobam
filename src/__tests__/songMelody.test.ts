import { describe, it, expect } from 'vitest';
import { extractMelody, fitMelody, playableSongs } from '../xylophone/songMelody';
import { barsForRow } from '../xylophone/keyRows';
import { BUILT_IN_SONGS, getSongById } from '../songs';

function score(measureBody: string): string {
  return `<?xml version="1.0"?><score-partwise version="4.0">
  <part-list><score-part id="P1"><part-name>P</part-name></score-part></part-list>
  <part id="P1"><measure number="1">
    <attributes><divisions>2</divisions><key><fifths>0</fifths></key><staves>2</staves></attributes>
    ${measureBody}
  </measure></part></score-partwise>`;
}
const note = (step: string, octave: number, duration: number, extra = '', staff = 1) =>
  `<note>${extra.includes('<chord/>') ? '<chord/>' : ''}<pitch><step>${step}</step>${extra.replace('<chord/>', '')}<octave>${octave}</octave></pitch><duration>${duration}</duration><staff>${staff}</staff></note>`;

describe('extractMelody', () => {
  it('reads pitches and lengths in beats from the upper staff', () => {
    const xml = score(note('C', 4, 2) + note('D', 4, 1) + note('E', 4, 4));
    expect(extractMelody(xml)).toEqual([
      { pitch: 'C4', beats: 1 },
      { pitch: 'D4', beats: 0.5 },
      { pitch: 'E4', beats: 2 },
    ]);
  });

  it('skips rests and notes of the lower staff', () => {
    const xml = score(`<note><rest/><duration>2</duration><staff>1</staff></note>` + note('G', 4, 2) + note('C', 3, 2, '', 2));
    expect(extractMelody(xml).map((n) => n.pitch)).toEqual(['G4']);
  });

  it('keeps only the top note of a chord, and skips the second note of a tie', () => {
    const xml = score(
      note('E', 4, 2) + note('G', 4, 2, '<chord/>') +
      `<note><pitch><step>A</step><octave>4</octave></pitch><duration>2</duration><tie type="start"/><staff>1</staff></note>` +
      `<note><pitch><step>A</step><octave>4</octave></pitch><duration>2</duration><tie type="stop"/><staff>1</staff></note>`
    );
    expect(extractMelody(xml).map((n) => n.pitch)).toEqual(['E4', 'A4']);
  });

  it('writes sharps and flats into the pitch name', () => {
    const xml = score(note('F', 4, 2, '<alter>1</alter>') + note('B', 3, 2, '<alter>-1</alter>'));
    expect(extractMelody(xml).map((n) => n.pitch)).toEqual(['F#4', 'Bb3']);
  });

  it('gives an empty melody for text that is not MusicXML', () => {
    expect(extractMelody('not xml')).toEqual([]);
    expect(extractMelody('<a/>')).toEqual([]);
  });

  it('reads the built-in song Mary Had a Little Lamb', () => {
    const melody = extractMelody(getSongById('mary-lamb')!.xml);
    expect(melody).toHaveLength(26);
    expect(melody.slice(0, 4).map((n) => n.pitch)).toEqual(['E4', 'D4', 'C4', 'D4']);
    expect(melody[25]).toEqual({ pitch: 'C4', beats: 4 });
  });
});

describe('fitMelody', () => {
  const bars = barsForRow('home', 4).map((b) => b.noteName); // C4 .. F5

  it('returns the melody unchanged when every note has a bar', () => {
    const fitted = fitMelody([{ pitch: 'C4', beats: 1 }, { pitch: 'F5', beats: 1 }], bars);
    expect(fitted).toEqual([{ pitch: 'C4', beats: 1 }, { pitch: 'F5', beats: 1 }]);
  });

  it('moves the whole melody by octaves when that makes it fit', () => {
    const fitted = fitMelody([{ pitch: 'C3', beats: 1 }, { pitch: 'E3', beats: 1 }], bars);
    expect(fitted!.map((n) => n.pitch)).toEqual(['C4', 'E4']);
    const high = fitMelody([{ pitch: 'C6', beats: 1 }], bars);
    expect(high!.map((n) => n.pitch)).toEqual(['C5']);
  });

  it('gives up on notes that no bar can play, such as sharps', () => {
    expect(fitMelody([{ pitch: 'F#4', beats: 1 }], bars)).toBeNull();
  });

  it('gives up when the range is wider than the bars', () => {
    expect(fitMelody([{ pitch: 'C3', beats: 1 }, { pitch: 'C6', beats: 1 }], bars)).toBeNull();
  });

  it('gives up on an empty melody', () => {
    expect(fitMelody([], bars)).toBeNull();
  });
});

describe('playableSongs', () => {
  const bars = barsForRow('home', 4);

  it('offers the C major songs and leaves out Minuet in G, which has F sharp', () => {
    const ids = playableSongs(BUILT_IN_SONGS, bars.map((b) => b.noteName)).map((s) => s.song.id);
    expect(ids).toEqual(expect.arrayContaining(['mary-lamb', 'twinkle', 'ode-to-joy']));
    expect(ids).not.toContain('minuet-g');
  });

  it('returns the fitted notes for each song', () => {
    const entry = playableSongs(BUILT_IN_SONGS, bars.map((b) => b.noteName)).find((s) => s.song.id === 'mary-lamb')!;
    expect(entry.notes).toHaveLength(26);
    expect(entry.notes[0]).toBe('E4');
  });

  it('offers fewer songs on a shorter row', () => {
    const short = barsForRow('bottom', 4).map((b) => b.noteName); // C4 .. E5
    const home = barsForRow('home', 4).map((b) => b.noteName);
    expect(playableSongs(BUILT_IN_SONGS, short).length).toBeLessThanOrEqual(playableSongs(BUILT_IN_SONGS, home).length);
  });
});
