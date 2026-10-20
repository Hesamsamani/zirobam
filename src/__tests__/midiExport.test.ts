import { describe, it, expect } from 'vitest';
import { Midi } from '@tonejs/midi';
import { buildMidiFile, midiFileName, type MidiSongSpec } from '../theory/midiExport';

// Every test reads the bytes back with the same library, so what is checked is what a player would get.

const base: MidiSongSpec = {
  title: 'D Shur',
  bpm: 120,
  meter: [4, 4],
  tracks: [{ name: 'Melody', notes: [{ pitch: 'C4', startBeat: 0, beats: 1 }] }],
};

const read = (spec: MidiSongSpec) => new Midi(buildMidiFile(spec));

describe('buildMidiFile', () => {
  it('writes a standard MIDI file', () => {
    const bytes = buildMidiFile(base);
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(String.fromCharCode(...bytes.slice(0, 4))).toBe('MThd');
  });

  it('keeps the tempo, the time signature and the title', () => {
    const midi = read({ ...base, bpm: 96, meter: [6, 8] });
    expect(midi.header.tempos[0].bpm).toBeCloseTo(96, 1);
    expect(midi.header.timeSignatures[0].timeSignature).toEqual([6, 8]);
    expect(midi.header.name).toBe('D Shur');
  });

  it('counts the beats as quarter notes at 480 ticks each', () => {
    const midi = read({
      ...base,
      tracks: [{ name: 'M', notes: [{ pitch: 'C4', startBeat: 0, beats: 1 }, { pitch: 'D4', startBeat: 1.5, beats: 0.5 }] }],
    });
    expect(midi.header.ppq).toBe(480);
    const notes = midi.tracks[0].notes;
    expect(notes.map((n) => [n.ticks, n.durationTicks])).toEqual([
      [0, 480],
      [720, 240],
    ]);
  });

  it('numbers the notes by the key that is struck, whatever the spelling', () => {
    const notes = (...pitches: string[]) => pitches.map((pitch, i) => ({ pitch, startBeat: i, beats: 1 }));
    const midi = read({ ...base, tracks: [{ name: 'M', notes: notes('C4', 'Bb3', 'Cb5', 'B#3', 'F##4', 'Dbb4') }] });
    expect(midi.tracks[0].notes.map((n) => n.midi)).toEqual([60, 58, 71, 60, 67, 60]);
  });

  it('gives a note the velocity it was asked for, and a default one', () => {
    const midi = read({
      ...base,
      tracks: [{ name: 'M', notes: [{ pitch: 'C4', startBeat: 0, beats: 1, velocity: 1 }, { pitch: 'D4', startBeat: 1, beats: 1 }] }],
    });
    const [loud, normal] = midi.tracks[0].notes;
    expect(loud.velocity).toBeCloseTo(1, 1);
    expect(normal.velocity).toBeCloseTo(0.8, 1);
  });

  it('takes a MIDI number as the pitch, for the drums', () => {
    const midi = read({ ...base, tracks: [{ name: 'Drums', percussion: true, notes: [{ pitch: 36, startBeat: 0, beats: 0.25 }] }] });
    expect(midi.tracks[0].notes[0].midi).toBe(36);
    expect(midi.tracks[0].channel).toBe(9);
  });

  it('sets the sound of a track', () => {
    // a channel is kept in the notes, so a track needs one to show it
    const note = { pitch: 'C2', startBeat: 0, beats: 1 };
    const midi = read({ ...base, tracks: [{ name: 'Piano', program: 0, notes: [note] }, { name: 'Bass', program: 33, channel: 1, notes: [note] }] });
    expect(midi.tracks.map((t) => t.instrument.number)).toEqual([0, 33]);
    expect(midi.tracks[1].channel).toBe(1);
  });

  it('writes a track with no notes, and a song with no tracks', () => {
    expect(read({ ...base, tracks: [{ name: 'Empty', notes: [] }] }).tracks[0].notes).toHaveLength(0);
    expect(() => buildMidiFile({ ...base, tracks: [] })).not.toThrow();
  });
});

describe('quarter tones', () => {
  const track = (pitches: string[], beats = 1) => ({ name: 'M', notes: pitches.map((pitch, i) => ({ pitch, startBeat: i * beats, beats })) });

  it('plays koron on the key of its letter, bent down a quarter of the bend range', () => {
    const midi = read({ ...base, tracks: [track(['Ek4'])] });
    expect(midi.tracks[0].notes[0].midi).toBe(64); // E4
    const bends = midi.tracks[0].pitchBends;
    // down half a semitone with a range of two semitones is a quarter of the way down
    expect(bends[0]).toMatchObject({ ticks: 0 });
    expect(bends[0].value).toBeCloseTo(-0.25, 3);
  });

  it('plays sori bent up', () => {
    const midi = read({ ...base, tracks: [track(['Co4'])] });
    expect(midi.tracks[0].notes[0].midi).toBe(60);
    expect(midi.tracks[0].pitchBends[0].value).toBeCloseTo(0.25, 3);
  });

  it('puts the bend back to normal when the note ends', () => {
    const midi = read({ ...base, tracks: [track(['Ek4', 'E4'])] });
    const bends = midi.tracks[0].pitchBends.map((b) => [b.ticks, Math.round(b.value * 1000) / 1000]);
    expect(bends).toEqual([
      [0, -0.25],
      [480, 0],
    ]);
  });

  it('keeps the bend when the next note is a quarter tone too', () => {
    const midi = read({ ...base, tracks: [track(['Ek4', 'Co4'])] });
    const bends = midi.tracks[0].pitchBends.map((b) => [b.ticks, Math.round(b.value * 1000) / 1000]);
    // at the second note the new bend replaces the old one; the reset comes only after the last note
    expect(bends).toEqual([
      [0, -0.25],
      [480, 0.25],
      [960, 0],
    ]);
  });

  it('writes no bend for a song without quarter tones', () => {
    expect(read({ ...base, tracks: [track(['C4', 'Eb4', 'F##4'])] }).tracks[0].pitchBends).toHaveLength(0);
  });
});

describe('midiFileName', () => {
  it('makes a file name from a title', () => {
    expect(midiFileName('D Shur')).toBe('D-Shur.mid');
    expect(midiFileName('C major - Jazz - 8 bars')).toBe('C-major-Jazz-8-bars.mid');
  });

  it('removes what a file name cannot hold, and keeps Persian letters', () => {
    expect(midiFileName('a/b:c*d?"e<f>g|h')).toBe('abcdefgh.mid');
    expect(midiFileName('دستگاه شور')).toBe('دستگاه-شور.mid');
  });

  it('falls back to a plain name', () => {
    expect(midiFileName('')).toBe('music.mid');
    expect(midiFileName('///')).toBe('music.mid');
  });

  it('does not make a very long name', () => {
    expect(midiFileName('x'.repeat(300)).length).toBeLessThanOrEqual(84);
  });
});
