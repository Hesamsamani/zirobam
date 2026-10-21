import { Midi } from '@tonejs/midi';
import { describe, expect, it } from 'vitest';
import { buildMidiFile } from '../theory/midiExport';
import { chordMidiSpec } from '../theory/chordMidi';

const read = (pitches: string[], bpm?: number) => new Midi(buildMidiFile(chordMidiSpec('Cmaj7', pitches, bpm)));

describe('chordMidiSpec', () => {
  it('plays the notes one after the other, then all together', () => {
    const midi = read(['C4', 'E4', 'G4', 'B4']);
    const notes = midi.tracks[0].notes;
    expect(notes).toHaveLength(8);
    const arpeggio = notes.slice(0, 4);
    expect(arpeggio.map((n) => n.midi)).toEqual([60, 64, 67, 71]);
    expect(arpeggio.map((n) => n.ticks)).toEqual([0, 480, 960, 1440]);
    const block = notes.slice(4);
    expect(block.map((n) => n.midi).sort((a, b) => a - b)).toEqual([60, 64, 67, 71]);
    expect(new Set(block.map((n) => n.ticks)).size).toBe(1);
    expect(block[0].ticks).toBe(1920);
    expect(block[0].durationTicks).toBe(1920);
  });

  it('is named after the chord and carries its tempo', () => {
    const midi = read(['C4', 'E4', 'G4'], 72);
    expect(midi.header.name).toBe('Cmaj7');
    expect(Math.round(midi.header.tempos[0].bpm)).toBe(72);
    expect(midi.header.timeSignatures[0].timeSignature).toEqual([4, 4]);
  });

  it('is a piano on the first channel', () => {
    const midi = read(['C4', 'E4', 'G4']);
    expect(midi.tracks[0].channel).toBe(0);
    expect(midi.tracks[0].instrument.number).toBe(0);
  });

  it('keeps the spelling out of the file: B flat is the same key as A sharp', () => {
    const midi = read(['Bb3', 'D4', 'F4']);
    expect(midi.tracks[0].notes.slice(0, 3).map((n) => n.midi)).toEqual([58, 62, 65]);
  });
});
