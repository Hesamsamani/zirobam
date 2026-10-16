import { describe, it, expect } from 'vitest';
import {
  addToken,
  buildDraft,
  MAKER_KEYS,
  MAX_MEASURES,
  MAX_TITLE,
  newMakerId,
  noteToken,
  readDraft,
  removeLastToken,
  type SongDraft,
} from '../songs/songMaker';
import { parseMusicXML } from '../upload/parser';
import { extractMelody } from '../xylophone/songMelody';

const draft: SongDraft = { title: 'My tune', fifths: 0, beats: 4, melody: 'C4q D4q E4q F4q | G4w' };

describe('buildDraft', () => {
  it('turns a song into MusicXML the practice mode reads', () => {
    const result = buildDraft(draft);
    if (!result.ok) throw new Error(JSON.stringify(result.problem));
    expect(result.measures).toBe(2);
    const parsed = parseMusicXML(result.xml);
    expect(parsed.title).toBe('My tune');
    expect(parsed.measures).toHaveLength(2);
    expect(extractMelody(result.xml).map((n) => n.pitch)).toEqual(['C4', 'D4', 'E4', 'F4', 'G4']);
  });

  it('keeps the key and the time signature', () => {
    const result = buildDraft({ ...draft, fifths: 1, beats: 3, melody: 'G4q A4q B4q | F#4h.' });
    if (!result.ok) throw new Error(JSON.stringify(result.problem));
    const parsed = parseMusicXML(result.xml);
    expect(parsed.keySignature.name).toBe('G major');
    expect(parsed.timeSignature).toMatchObject({ beats: 3, beatType: 4 });
  });

  it('asks for a name and some notes', () => {
    expect(buildDraft({ ...draft, title: '   ' })).toEqual({ ok: false, problem: { kind: 'name' } });
    expect(buildDraft({ ...draft, title: 'x'.repeat(MAX_TITLE + 1) })).toEqual({ ok: false, problem: { kind: 'name' } });
    expect(buildDraft({ ...draft, melody: '  |  ' })).toEqual({ ok: false, problem: { kind: 'empty' } });
  });

  it('says which measure is too short or too long', () => {
    expect(buildDraft({ ...draft, melody: 'C4q D4q E4q | G4w' })).toEqual({
      ok: false,
      problem: { kind: 'measure', measure: 1, beats: 3, expected: 4 },
    });
  });

  it('says which note it cannot read, and which note needs a sign', () => {
    expect(buildDraft({ ...draft, melody: 'C4q D4q X4q E4q' })).toEqual({ ok: false, problem: { kind: 'note', token: 'X4q' } });
    const sharp = buildDraft({ ...draft, fifths: 1, melody: 'G4q A4q B4q F4q' });
    expect(sharp).toEqual({ ok: false, problem: { kind: 'keySign', token: 'F4q', needed: 'F#4', natural: 'Fn4' } });
  });

  it('limits the length of a song', () => {
    const measures = Array.from({ length: MAX_MEASURES + 1 }, () => 'C4w').join(' | ');
    expect(buildDraft({ ...draft, melody: measures })).toEqual({ ok: false, problem: { kind: 'tooLong', max: MAX_MEASURES } });
    const fine = Array.from({ length: MAX_MEASURES }, () => 'C4w').join(' | ');
    expect(buildDraft({ ...draft, melody: fine }).ok).toBe(true);
  });

  it('puts nothing of the title into the XML unescaped', () => {
    const result = buildDraft({ ...draft, title: '</work-title><evil/>' });
    if (!result.ok) throw new Error('should build');
    expect(result.xml).not.toContain('<evil/>');
    expect(parseMusicXML(result.xml).title).toBe('</work-title><evil/>');
  });
});

describe('readDraft', () => {
  it('gets the song back out of its MusicXML, so it can be edited', () => {
    const result = buildDraft({ ...draft, fifths: -2, beats: 2, melody: 'Bb4q C5q | D5h' });
    if (!result.ok) throw new Error('should build');
    expect(readDraft(result.xml)).toEqual({ title: 'My tune', fifths: -2, beats: 2, melody: 'Bb4q C5q | D5h' });
  });

  it('survives characters that are special in XML', () => {
    const result = buildDraft({ ...draft, title: 'Tom & "Jerry" <3' });
    if (!result.ok) throw new Error('should build');
    expect(readDraft(result.xml)?.title).toBe('Tom & "Jerry" <3');
  });

  it('is empty for a file that did not come from the song maker', () => {
    expect(readDraft('<score-partwise><part/></score-partwise>')).toBeNull();
    expect(readDraft('not xml at all')).toBeNull();
  });

  it('ignores a damaged or hostile source', () => {
    const marker = (text: string) =>
      `<score-partwise><identification><miscellaneous><miscellaneous-field name="music-notes-trainer-maker">${text}</miscellaneous-field></miscellaneous></identification></score-partwise>`;
    expect(readDraft(marker('{not json'))).toBeNull();
    expect(readDraft(marker('{"v":1,"title":5,"fifths":0,"beats":4,"melody":"C4w"}'))).toBeNull();
    expect(readDraft(marker('{"v":1,"title":"x","fifths":99,"beats":4,"melody":"C4w"}'))).toBeNull();
    expect(readDraft(marker('{"v":1,"title":"x","fifths":0,"beats":7,"melody":"C4w"}'))).toBeNull();
  });
});

describe('the keys', () => {
  it('has the fifteen key signatures, from seven flats to seven sharps', () => {
    expect(MAKER_KEYS.map((k) => k.fifths)).toEqual([-7, -6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6, 7]);
    expect(MAKER_KEYS.find((k) => k.fifths === 0)).toMatchObject({ major: 'C', minor: 'A' });
    expect(MAKER_KEYS.find((k) => k.fifths === 1)).toMatchObject({ major: 'G', minor: 'E' });
    expect(MAKER_KEYS.find((k) => k.fifths === -3)).toMatchObject({ major: 'Eb', minor: 'C' });
  });
});

describe('ids', () => {
  it('makes an id that cannot clash with a library song or a file', () => {
    expect(newMakerId(1700000000000, () => 0.5)).toMatch(/^maker-[a-z0-9]+$/);
    expect(newMakerId(1, () => 0.1)).not.toBe(newMakerId(1, () => 0.2));
  });
});

describe('writing the notes with buttons', () => {
  it('writes a note from its parts', () => {
    expect(noteToken({ letter: 'E', accidental: '', octave: 4, length: 'q', dotted: false })).toBe('E4q');
    expect(noteToken({ letter: 'F', accidental: '#', octave: 5, length: 'e', dotted: true })).toBe('F#5e.');
    expect(noteToken({ letter: 'B', accidental: 'b', octave: 3, length: 'h', dotted: false })).toBe('Bb3h');
    expect(noteToken({ letter: 'F', accidental: 'n', octave: 4, length: 'q', dotted: false })).toBe('Fn4q');
    expect(noteToken({ letter: 'r', accidental: '', octave: 4, length: 'q', dotted: true })).toBe('rq.');
  });

  it('adds a bar line by itself when a measure is full', () => {
    expect(addToken('', 'C4q', 4)).toBe('C4q');
    expect(addToken('C4q D4q', 'E4h', 4)).toBe('C4q D4q E4h |');
    expect(addToken('C4q D4q E4h |', 'F4w', 4)).toBe('C4q D4q E4h | F4w |');
    expect(addToken('C4q', 'D4q', 2)).toBe('C4q D4q |');
    expect(addToken('C4q D4q', 'E4q', 3)).toBe('C4q D4q E4q |');
  });

  it('does not close a measure that is too long, and the student sees the error', () => {
    expect(addToken('C4q D4q E4q', 'F4h', 4)).toBe('C4q D4q E4q F4h');
  });

  it('copes with text it cannot read', () => {
    expect(addToken('C4q ???', 'D4q', 4)).toBe('C4q ??? D4q');
  });

  it('takes the last note or bar line away', () => {
    expect(removeLastToken('C4q D4q E4h |')).toBe('C4q D4q E4h');
    expect(removeLastToken('C4q D4q E4h')).toBe('C4q D4q');
    expect(removeLastToken('C4q')).toBe('');
    expect(removeLastToken('')).toBe('');
  });
});
