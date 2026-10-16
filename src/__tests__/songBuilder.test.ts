import { describe, it, expect } from 'vitest';
import { buildSongXml, MelodyError, parseMelody, type SongSpec } from '../songs/songBuilder';
import { extractMelody } from '../xylophone/songMelody';
import { parseMusicXML } from '../upload/parser';
import { noteDataToString } from '../core';

const base: SongSpec = {
  id: 'test',
  title: 'Test Tune',
  composer: 'Traditional',
  difficulty: 'beginner',
  category: 'folk',
  fifths: 0,
  beats: 4,
  melody: 'C4q D4q E4q F4q | G4w',
};

describe('parseMelody', () => {
  it('splits the measures at bars and reads each note', () => {
    const measures = parseMelody('C4q D4q E4h | G4w', 4, 4);
    expect(measures).toHaveLength(2);
    expect(measures[0].map((n) => n.pitch)).toEqual(['C4', 'D4', 'E4']);
    expect(measures[0].map((n) => n.duration)).toEqual([4, 4, 8]);
    expect(measures[1][0].type).toBe('whole');
  });

  it('reads dotted notes, eighths and sixteenths', () => {
    const [m] = parseMelody('G4q. A4e G4q F4q', 4, 4);
    expect(m.map((n) => n.duration)).toEqual([6, 2, 4, 4]);
    expect(m[0].dotted).toBe(true);
    const [s] = parseMelody('C4s C4s C4e C4q C4h', 4, 4);
    expect(s.map((n) => n.duration)).toEqual([1, 1, 2, 4, 8]);
  });

  it('reads sharps, flats and rests', () => {
    const [m] = parseMelody('F#4q Bb3q rq rq', 4, 4); // the key is checked when the song is built
    expect(m[0]).toMatchObject({ step: 'F', alter: 1, octave: 4 });
    expect(m[1]).toMatchObject({ step: 'B', alter: -1, octave: 3 });
    expect(m[2].rest).toBe(true);
  });

  it('refuses a measure of the wrong length and says which one', () => {
    expect(() => parseMelody('C4q D4q E4q | G4w', 4, 4)).toThrow(/measure 1/i);
    expect(() => parseMelody('C4w | G4h', 4, 4)).toThrow(/measure 2/i);
    expect(() => parseMelody('C4q C4q C4q | C4h.', 3, 4)).not.toThrow();
  });

  it('says what was wrong in a form a screen can translate', () => {
    const problem = (fn: () => unknown) => {
      try {
        fn();
      } catch (error) {
        return error instanceof MelodyError ? error.problem : undefined;
      }
      return undefined;
    };
    expect(problem(() => parseMelody('C4q D4q E4q | G4w', 4, 4))).toEqual({ kind: 'measure', measure: 1, beats: 3, expected: 4 });
    expect(problem(() => parseMelody('C4q D4q E4q E4e | G4w', 4, 4))).toEqual({ kind: 'measure', measure: 1, beats: 3.5, expected: 4 });
    expect(problem(() => parseMelody('H4q C4q C4h', 4, 4))).toEqual({ kind: 'note', token: 'H4q' });
    expect(problem(() => parseMelody('C4s. D4q', 4, 4))).toEqual({ kind: 'dotted16th', token: 'C4s.' });
    expect(problem(() => buildSongXml({ ...base, fifths: 1, melody: 'G4q A4q B4q F4q | G4w' }))).toEqual({ kind: 'keySign', token: 'F4q', needed: 'F#4', natural: 'Fn4' });
    expect(problem(() => buildSongXml({ ...base, melody: 'C4q D4q F#4q F4q | G4w' }))).toEqual({ kind: 'carried', token: 'F4q', needed: 'F#4', natural: 'Fn4' });
  });

  it('refuses a note it cannot read', () => {
    expect(() => parseMelody('H4q C4q C4h', 4, 4)).toThrow(/H4q/);
    expect(() => parseMelody('C4x C4q C4h', 4, 4)).toThrow(/C4x/);
  });

  it('ignores extra spaces and a closing bar', () => {
    expect(parseMelody('  C4w  |  G4w | ', 4, 4)).toHaveLength(2);
  });
});

describe('buildSongXml', () => {
  it('writes MusicXML that the app reads back as the same tune', () => {
    const xml = buildSongXml(base);
    expect(extractMelody(xml).map((n) => n.pitch)).toEqual(['C4', 'D4', 'E4', 'F4', 'G4']);
    const parsed = parseMusicXML(xml);
    expect(parsed.measures).toHaveLength(2);
    expect(parsed.timeSignature).toMatchObject({ beats: 4, beatType: 4 });
    expect(parsed.title).toBe('Test Tune');
  });

  it('puts the tune in the right hand and a rest in the left hand of every measure', () => {
    const parsed = parseMusicXML(buildSongXml(base));
    for (const measure of parsed.measures) {
      expect(measure.rightHand.length).toBeGreaterThan(0);
      expect(measure.leftHand.every((n) => n.isRest)).toBe(true);
    }
  });

  it('supports 3/4 with a dotted-half rest for the left hand', () => {
    const xml = buildSongXml({ ...base, beats: 3, melody: 'C4q D4q E4q | G4h. ' });
    expect(xml).toContain('<beats>3</beats>');
    expect(xml).toContain('<rest/><duration>12</duration><type>half</type><dot/><staff>2</staff>');
    expect(parseMusicXML(xml).measures).toHaveLength(2);
  });

  it('writes the key signature', () => {
    const xml = buildSongXml({ ...base, fifths: 1, melody: 'G4q A4q B4q F#4q | G4w' });
    expect(xml).toContain('<fifths>1</fifths>');
    expect(parseMusicXML(xml).keySignature.name).toBe('G major');
  });

  it('writes the mode, and the app names the key after it', () => {
    const minor = buildSongXml({ ...base, mode: 'minor', melody: 'A4q B4q C5q D5q | E5w' });
    expect(minor).toContain('<mode>minor</mode>');
    expect(parseMusicXML(minor).keySignature.name).toBe('A minor');
    const dorian = buildSongXml({ ...base, mode: 'dorian', melody: 'D4q E4q F4q G4q | A4w' });
    expect(parseMusicXML(dorian).keySignature.name).toBe('D dorian');
    const eMinor = buildSongXml({ ...base, fifths: 1, mode: 'minor', melody: 'E4q F#4q G4q A4q | B4w' });
    expect(parseMusicXML(eMinor).keySignature.name).toBe('E minor');
    expect(parseMusicXML(buildSongXml(base)).keySignature.name).toBe('C major');
  });

  it('requires the sharp to be written where the key signature has one', () => {
    expect(() => buildSongXml({ ...base, fifths: 1, melody: 'G4q A4q B4q F4q | G4w' })).toThrow(/F#/);
  });

  it('supports 2/4 with a half-note rest for the left hand', () => {
    const xml = buildSongXml({ ...base, beats: 2, melody: 'C4q D4q | E4h' });
    expect(xml).toContain('<beats>2</beats>');
    expect(xml).toContain('<rest/><duration>8</duration><type>half</type><staff>2</staff>');
    expect(parseMusicXML(xml).timeSignature).toMatchObject({ beats: 2, beatType: 4 });
  });

  it('draws a sign for an accidental outside the key, once per measure and pitch', () => {
    const xml = buildSongXml({ ...base, melody: 'C4q F#4q F#4q G4q | F#4q F#5q Fn4q Fn4q' });
    const signs = xml.match(/<accidental>[a-z]+<\/accidental>/g);
    // measure 1: the first F#4 only. Measure 2: F#4 again, F#5 (another octave), then Fn4 cancels the sharp
    // and the second Fn4 needs no sign
    expect(signs).toEqual([
      '<accidental>sharp</accidental>',
      '<accidental>sharp</accidental>',
      '<accidental>sharp</accidental>',
      '<accidental>natural</accidental>',
    ]);
    expect(extractMelody(xml).map((n) => n.pitch)).toEqual(['C4', 'F#4', 'F#4', 'G4', 'F#4', 'F#5', 'F4', 'F4']);
  });

  it('plays an accidental outside the key as the altered pitch', () => {
    const parsed = parseMusicXML(buildSongXml({ ...base, fifths: -1, melody: 'F4q Bb4q A4q Bn4q | C5w' }));
    expect(parsed.measures[0].rightHand.map((n) => noteDataToString(n))).toEqual(['F4', 'Bb4', 'A4', 'B4']);
  });

  it('refuses a plain note while a sign for that pitch is still in force in the measure', () => {
    expect(() => buildSongXml({ ...base, melody: 'C4q D4q F#4q F4q | G4w' })).toThrow(/natural/i);
  });

  it('keeps ties between notes', () => {
    const xml = buildSongXml({ ...base, melody: 'C4h D4h~ | D4w' });
    expect(xml).toContain('<tie type="start"/>');
    expect(xml).toContain('<tie type="stop"/>');
    expect(extractMelody(xml).map((n) => n.pitch)).toEqual(['C4', 'D4']);
  });

  it('escapes characters that are special in XML', () => {
    const xml = buildSongXml({ ...base, title: 'Tom & "Jerry" <3' });
    expect(xml).toContain('Tom &amp; &quot;Jerry&quot; &lt;3');
    expect(parseMusicXML(xml).title).toBe('Tom & "Jerry" <3');
  });
});
