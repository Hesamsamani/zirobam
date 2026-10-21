import { Midi } from '@tonejs/midi';
import { describe, expect, it } from 'vitest';
import { generateMelody } from '../generator/melody';
import { generateProgression } from '../generator/progression';
import { METERS, METER_IDS, type MeterId } from '../generator/rhythmCells';
import { pieceMidiSpec, pieceXml, songDraftOf, type GeneratedPiece } from '../generator/scoreXml';
import { buildDraft } from '../songs/songMaker';
import { buildMidiFile } from '../theory/midiExport';
import { parseMusicXML } from '../upload/parser';
import { SCALES } from '../theory/scaleCatalog';
import { spellScale, type SpelledScale } from '../theory/spell';

const cMajor = spellScale(0, 'major');

function piece(options: { scale?: SpelledScale; meter?: MeterId; bars?: number; melody?: boolean; chords?: boolean; seed?: number } = {}): GeneratedPiece {
  const { scale = cMajor, meter = '4/4', bars = 4, melody = true, chords = true, seed = 3 } = options;
  const progression = chords ? generateProgression({ scale, style: 'pop', bars, seed, bpm: 100 }) : null;
  return {
    title: 'Test piece',
    scale,
    meter,
    bpm: 100,
    progression,
    melody: melody ? generateMelody({ scale, bars, meter, density: 'medium', feel: 'straight', contour: 'arch', range: 'medium', octave: 4, seed, progression: progression ?? undefined }) : null,
  };
}

describe('pieceXml', () => {
  it('is a score the practice stand can read: a measure for each bar, the tune in the right hand, the chords in the left', () => {
    const p = piece({ bars: 4 });
    const parsed = parseMusicXML(pieceXml(p));
    expect(parsed.measures).toHaveLength(4);
    expect(parsed.timeSignature).toMatchObject({ beats: 4, beatType: 4 });
    parsed.measures.forEach((measure, i) => {
      const tune = p.melody!.bars[i].filter((n) => n.pitch !== null);
      expect(measure.rightHand.filter((n) => !n.isRest)).toHaveLength(tune.length);
      const chordsHere = p.progression!.chords.filter((c) => c.bar === i);
      expect(measure.leftHand.filter((n) => !n.isRest)).toHaveLength(chordsHere.length);
    });
    // the chords are in the bass staff: an octave under the voicing that is played, so that none sits far above it
    for (const measure of parsed.measures) for (const note of measure.leftHand) if (!note.isRest) expect(note.octave).toBeLessThanOrEqual(4);
  });

  it('has the right time signature for each meter', () => {
    for (const meter of METER_IDS) {
      const m = METERS[meter];
      const parsed = parseMusicXML(pieceXml(piece({ meter, chords: false, bars: 3 })));
      expect(parsed.timeSignature).toMatchObject({ beats: m.beats, beatType: m.beatType });
      expect(parsed.measures).toHaveLength(3);
    }
  });

  it('keeps the left hand quiet when there is a tune only', () => {
    const parsed = parseMusicXML(pieceXml(piece({ chords: false })));
    for (const measure of parsed.measures) expect(measure.leftHand.every((n) => n.isRest)).toBe(true);
  });

  it('divides the chords between the hands when there are no melody: the notes from middle C up are in the right hand', () => {
    const p = piece({ melody: false, bars: 4 });
    const parsed = parseMusicXML(pieceXml(p));
    const rightPitches = parsed.measures.flatMap((m) => m.rightHand.filter((n) => !n.isRest));
    for (const note of rightPitches) expect(note.octave).toBeGreaterThanOrEqual(4);
    for (const measure of parsed.measures) {
      for (const note of measure.leftHand) if (!note.isRest) expect(note.octave).toBeLessThanOrEqual(4);
    }
    // every chord of the progression is there once in one hand or the other
    expect(parsed.measures.flatMap((m) => [...m.rightHand, ...m.leftHand]).filter((n) => !n.isRest).length).toBeGreaterThanOrEqual(p.progression!.chords.length);
  });

  it('keeps the signs of a Persian mode: a koron is in the file', () => {
    const shur = spellScale('D', 'shur');
    let found = false;
    for (let seed = 1; seed <= 30 && !found; seed++) found = pieceXml(piece({ scale: shur, seed, chords: false, bars: 8 })).includes('<alter>-0.5</alter>');
    expect(found).toBe(true);
  });

  it('is well-formed XML for every scale of the catalog', () => {
    for (const def of SCALES) {
      const scale = def.persian ? spellScale(def.persian.defaultRoot, def.id) : spellScale(0, def.id);
      for (const chords of [true, false]) {
        const xml = pieceXml(piece({ scale, chords, bars: 4, seed: 2 }));
        const doc = new DOMParser().parseFromString(xml, 'application/xml');
        expect(doc.getElementsByTagName('parsererror'), `${def.id}`).toHaveLength(0);
      }
    }
  });
});

describe('pieceMidiSpec', () => {
  it('writes the chords, a bass and the tune as three tracks, with the tempo and the meter', () => {
    const p = piece({ bars: 4 });
    const midi = new Midi(buildMidiFile(pieceMidiSpec(p)));
    expect(midi.header.name).toBe('Test piece');
    expect(Math.round(midi.header.tempos[0].bpm)).toBe(100);
    expect(midi.header.timeSignatures[0].timeSignature).toEqual([4, 4]);
    expect(midi.tracks.map((t) => t.name)).toEqual(['Chords', 'Bass', 'Melody']);
    const chordNotes = p.progression!.chords.reduce((sum, c) => sum + c.voicing.length, 0);
    expect(midi.tracks[0].notes).toHaveLength(chordNotes);
    expect(midi.tracks[1].notes).toHaveLength(p.progression!.chords.length);
    expect(midi.tracks[2].notes).toHaveLength(p.melody!.bars.flat().filter((n) => n.pitch !== null).length);
  });

  it('puts each note where it belongs in time: a chord of the second bar starts on the fifth beat', () => {
    const p = piece({ bars: 4 });
    const midi = new Midi(buildMidiFile(pieceMidiSpec(p)));
    const second = p.progression!.chords.find((c) => c.bar === 1)!;
    const startTicks = (second.bar * 4 + second.beat) * 480;
    expect(midi.tracks[0].notes.some((n) => n.ticks === startTicks)).toBe(true);
    expect(midi.tracks[1].notes.some((n) => n.ticks === startTicks)).toBe(true);
  });

  it('counts a 6/8 bar as three quarter notes', () => {
    const p = piece({ meter: '6/8', chords: false, bars: 4 });
    const midi = new Midi(buildMidiFile(pieceMidiSpec(p)));
    expect(midi.header.timeSignatures[0].timeSignature).toEqual([6, 8]);
    const last = midi.tracks[0].notes.at(-1)!;
    // the last bar is the tonic held for the whole bar: three quarter notes
    expect(last.ticks).toBe(3 * 3 * 480);
    expect(last.durationTicks).toBe(3 * 480);
    expect(midi.tracks).toHaveLength(1);
  });

  it('has only the tracks that have notes', () => {
    expect(new Midi(buildMidiFile(pieceMidiSpec(piece({ melody: false })))).tracks.map((t) => t.name)).toEqual(['Chords', 'Bass']);
    expect(new Midi(buildMidiFile(pieceMidiSpec(piece({ chords: false })))).tracks.map((t) => t.name)).toEqual(['Melody']);
  });
});

describe('songDraftOf', () => {
  it('turns the tune into a draft of the song maker that builds', () => {
    for (const meter of METER_IDS) {
      const p = piece({ meter, chords: false, bars: 8 });
      const draft = songDraftOf(p)!;
      expect(draft.title).toBe('Test piece');
      expect(draft.beats).toBe(METERS[meter].beats);
      expect(buildDraft(draft).ok).toBe(true);
    }
  });

  it('has nothing for a piece with no tune', () => {
    expect(songDraftOf(piece({ melody: false }))).toBeNull();
  });
});
