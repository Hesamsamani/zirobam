import { describe, it, expect } from 'vitest';
import {
  addToken,
  buildDraft,
  draftFromData,
  MAKER_KEYS,
  MAX_MEASURES,
  MAX_TITLE,
  measureBeats,
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

describe('6/8', () => {
  const jig: SongDraft = { title: 'A jig', fifths: 0, beats: 6, beatType: 8, melody: 'C4e D4e E4e F4e G4e A4e | G4h.' };

  it('builds a song in 6/8, with a measure of six eighths', () => {
    const result = buildDraft(jig);
    if (!result.ok) throw new Error(JSON.stringify(result.problem));
    expect(result.measures).toBe(2);
    expect(result.xml).toContain('<beat-type>8</beat-type>');
    expect(parseMusicXML(result.xml).timeSignature).toMatchObject({ beats: 6, beatType: 8 });
  });

  it('says which measure has the wrong length, counting in quarter notes', () => {
    const result = buildDraft({ ...jig, melody: 'C4e D4e E4e | G4h.' });
    expect(result).toEqual({ ok: false, problem: { kind: 'measure', measure: 1, beats: 1.5, expected: 3 } });
  });

  it('gets the song back out of its MusicXML with its time signature', () => {
    const result = buildDraft(jig);
    if (!result.ok) throw new Error('did not build');
    expect(readDraft(result.xml)).toEqual(jig);
  });

  it('leaves the x/4 songs as they were: no beat type in the stored text', () => {
    const result = buildDraft(draft);
    if (!result.ok) throw new Error('did not build');
    expect(result.xml).not.toContain('beatType');
    expect(readDraft(result.xml)).toEqual(draft);
  });
});

describe('measureBeats', () => {
  it('is the length of a measure in quarter notes', () => {
    expect(measureBeats({ beats: 4 })).toBe(4);
    expect(measureBeats({ beats: 3 })).toBe(3);
    expect(measureBeats({ beats: 2, beatType: 4 })).toBe(2);
    expect(measureBeats({ beats: 6, beatType: 8 })).toBe(3);
  });
});

describe('draftFromData', () => {
  const good = { title: 'T', fifths: 2, beats: 3, melody: 'C4q D4q E4q' };

  it('takes what the song maker stores', () => {
    expect(draftFromData(good)).toEqual(good);
    expect(draftFromData({ ...good, beats: 6, beatType: 8 })).toEqual({ ...good, beats: 6, beatType: 8 });
  });

  it('drops a beat type of 4, which is the default', () => {
    expect(draftFromData({ ...good, beatType: 4 })).toEqual(good);
    expect('beatType' in draftFromData({ ...good, beatType: 4 })!).toBe(false);
  });

  it('refuses a time signature the maker does not offer', () => {
    expect(draftFromData({ ...good, beats: 6 })).toBeNull(); // six quarter notes
    expect(draftFromData({ ...good, beats: 6, beatType: 4 })).toBeNull();
    expect(draftFromData({ ...good, beats: 3, beatType: 8 })).toBeNull();
    expect(draftFromData({ ...good, beats: 5 })).toBeNull();
  });

  it('refuses what is not a song', () => {
    for (const bad of [null, undefined, 'text', 7, [], { ...good, title: 5 }, { ...good, melody: null }, { ...good, fifths: 8 }, { ...good, fifths: 1.5 }]) {
      expect(draftFromData(bad)).toBeNull();
    }
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

  it('adds the bar line of a 6/8 measure after six eighths (three quarter notes)', () => {
    expect(addToken('C4e D4e E4e F4e G4e', 'A4e', 3)).toBe('C4e D4e E4e F4e G4e A4e |');
    expect(addToken('C4e D4e E4e F4e', 'G4e', 3)).toBe('C4e D4e E4e F4e G4e');
    expect(addToken('C4q.', 'D4q.', 3)).toBe('C4q. D4q. |');
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
