import { describe, it, expect } from 'vitest';
import { buildSongXml, parseMelody, type SongSpec } from '../songs/songBuilder';
import { extractMelody } from '../xylophone/songMelody';
import { parseMusicXML } from '../upload/parser';

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

  it('requires the sharp to be written where the key signature has one', () => {
    expect(() => buildSongXml({ ...base, fifths: 1, melody: 'G4q A4q B4q F4q | G4w' })).toThrow(/F#/);
  });

  it('refuses an accidental that the key signature does not have', () => {
    expect(() => buildSongXml({ ...base, melody: 'C4q D4q F#4q F4q | G4w' })).toThrow(/key/i);
  });

  it('escapes characters that are special in XML', () => {
    const xml = buildSongXml({ ...base, title: 'Tom & "Jerry" <3' });
    expect(xml).toContain('Tom &amp; &quot;Jerry&quot; &lt;3');
    expect(parseMusicXML(xml).title).toBe('Tom & "Jerry" <3');
  });
});
