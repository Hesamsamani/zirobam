import type { StyleId } from '../generator/styles';

export type BandPart = 'drums' | 'bass' | 'chords';
export const BAND_PARTS: readonly BandPart[] = ['drums', 'bass', 'chords'];

export type DrumPiece = 'kick' | 'snare' | 'hat' | 'openHat' | 'rim' | 'ride' | 'tom';

/** Where things happen is counted in sixteenth notes from the start of a bar of 4/4, 0 to 15. */
export interface DrumHit {
  piece: DrumPiece;
  at: number;
  /** 0 (silent) to 1 (loudest). */
  velocity: number;
}

/** What a bass note plays: the root of the chord, its third (the second note of the chord), its fifth or the root an octave up. */
export type BassTone = 'root' | 'third' | 'fifth' | 'octave';

export interface BassHit {
  at: number;
  length: number;
  tone: BassTone;
  velocity: number;
}

export interface CompHit {
  at: number;
  length: number;
  velocity: number;
}

/** How the chords are played: all notes at once at the places given, or one note after the other, up and down, `step` sixteenths apart. */
export type Comping = { kind: 'hits'; hits: readonly CompHit[] } | { kind: 'arpeggio'; step: number; velocity: number };

export interface BandPattern {
  /** The eighth notes that fall between the beats land two thirds of the way through the beat (a shuffle). */
  swing: boolean;
  /** No hits: no drums in this style. */
  drums: readonly DrumHit[];
  /** Replaces what the drums play in the last beat of the last bar of the loop. */
  fill: readonly DrumHit[];
  bass: readonly BassHit[];
  comp: Comping;
}

const d = (piece: DrumPiece, velocity: number, ...at: number[]): DrumHit[] => at.map((position) => ({ piece, at: position, velocity }));
const EIGHTHS = [0, 2, 4, 6, 8, 10, 12, 14];
const SIXTEENTHS = Array.from({ length: 16 }, (_, i) => i);
/** The accent of an eighth-note hi-hat: the beats are louder than the eighths between them. */
const hatEighths = (soft: number, loud: number): DrumHit[] => EIGHTHS.map((at) => ({ piece: 'hat' as const, at, velocity: at % 4 === 0 ? loud : soft }));
const roll: DrumHit[] = [{ piece: 'snare', at: 12, velocity: 0.5 }, { piece: 'snare', at: 13, velocity: 0.55 }, { piece: 'tom', at: 14, velocity: 0.7 }, { piece: 'tom', at: 15, velocity: 0.8 }];
const b = (at: number, length: number, tone: BassTone, velocity: number): BassHit => ({ at, length, tone, velocity });
const c = (at: number, length: number, velocity: number): CompHit => ({ at, length, velocity });
const hits = (...list: CompHit[]): Comping => ({ kind: 'hits', hits: list });

/** The groove of each style: drums, bass and the way the chords are played. A bar of 4/4, whatever the chords. */
export const PATTERNS: Readonly<Record<StyleId, BandPattern>> = {
  pop: {
    swing: false,
    drums: [...d('kick', 0.9, 0, 8), ...d('kick', 0.6, 10), ...d('snare', 0.8, 4, 12), ...hatEighths(0.45, 0.6)],
    fill: roll,
    bass: [b(0, 6, 'root', 0.9), b(6, 2, 'root', 0.6), b(8, 4, 'root', 0.85), b(12, 4, 'fifth', 0.7)],
    comp: hits(c(0, 6, 0.7), c(8, 6, 0.65), c(14, 2, 0.5)),
  },
  rock: {
    swing: false,
    drums: [...d('kick', 0.95, 0, 8), ...d('kick', 0.7, 6), ...d('snare', 0.95, 4, 12), ...hatEighths(0.55, 0.7), ...d('openHat', 0.55, 14)],
    fill: roll,
    bass: EIGHTHS.map((at) => b(at, 2, 'root', at % 8 === 0 ? 0.9 : 0.75)),
    comp: hits(c(0, 6, 0.8), c(8, 6, 0.8), c(14, 2, 0.6)),
  },
  folk: {
    swing: false,
    drums: [...d('kick', 0.6, 0, 8), ...d('rim', 0.5, 4, 12), ...d('hat', 0.3, 2, 6, 10, 14)],
    fill: [],
    bass: [b(0, 8, 'root', 0.85), b(8, 8, 'fifth', 0.75)],
    comp: hits(c(0, 4, 0.7), c(4, 4, 0.55), c(8, 2, 0.5), c(10, 2, 0.55), c(12, 4, 0.6)),
  },
  ballad: {
    swing: false,
    drums: [...d('kick', 0.7, 0), ...d('kick', 0.5, 10), ...d('snare', 0.5, 8), ...d('hat', 0.35, 0, 4, 8, 12)],
    fill: [],
    bass: [b(0, 12, 'root', 0.8), b(12, 4, 'fifth', 0.6)],
    comp: { kind: 'arpeggio', step: 2, velocity: 0.5 },
  },
  blues: {
    swing: true,
    drums: [...d('kick', 0.85, 0, 8), ...d('snare', 0.85, 4, 12), ...hatEighths(0.45, 0.6)],
    fill: roll,
    bass: [b(0, 4, 'root', 0.85), b(4, 4, 'fifth', 0.7), b(8, 4, 'octave', 0.75), b(12, 4, 'fifth', 0.7)],
    comp: hits(c(0, 2, 0.6), c(2, 2, 0.5), c(8, 2, 0.6), c(10, 2, 0.5)),
  },
  jazz: {
    swing: true,
    drums: [...d('ride', 0.55, 0, 4, 6, 8, 12, 14), ...d('hat', 0.5, 4, 12), ...d('kick', 0.25, 0, 4, 8, 12)],
    fill: [],
    bass: [b(0, 4, 'root', 0.85), b(4, 4, 'third', 0.7), b(8, 4, 'fifth', 0.75), b(12, 4, 'third', 0.7)],
    comp: hits(c(0, 6, 0.6), c(10, 4, 0.55)),
  },
  bossa: {
    swing: false,
    drums: [...d('kick', 0.7, 0, 6, 8, 14), ...d('rim', 0.5, 0, 6, 12), ...d('hat', 0.35, 2, 6, 10, 14)],
    fill: [],
    bass: [b(0, 6, 'root', 0.85), b(6, 2, 'fifth', 0.6), b(8, 6, 'root', 0.8), b(14, 2, 'fifth', 0.6)],
    comp: hits(c(0, 4, 0.6), c(6, 4, 0.55), c(10, 4, 0.55)),
  },
  latin: {
    swing: false,
    drums: [...d('kick', 0.8, 0, 8), ...d('tom', 0.5, 4, 6, 10, 12, 14), ...d('rim', 0.45, 0, 6, 12)],
    fill: roll,
    bass: [b(0, 6, 'root', 0.85), b(6, 4, 'fifth', 0.7), b(12, 4, 'root', 0.75)],
    comp: hits(c(0, 2, 0.6), c(3, 2, 0.55), c(6, 2, 0.55), c(8, 2, 0.6), c(11, 2, 0.55), c(14, 2, 0.55)),
  },
  funk: {
    swing: false,
    drums: [...d('kick', 0.9, 0), ...d('kick', 0.7, 3, 7, 10), ...d('snare', 0.95, 4, 12), ...d('snare', 0.25, 2, 9, 15), ...SIXTEENTHS.map((at) => ({ piece: 'hat' as const, at, velocity: at % 2 === 0 ? 0.5 : 0.3 })), ...d('openHat', 0.5, 14)],
    fill: roll,
    bass: [b(0, 3, 'root', 0.9), b(3, 3, 'root', 0.6), b(6, 2, 'octave', 0.8), b(8, 3, 'root', 0.85), b(12, 2, 'fifth', 0.7), b(14, 2, 'octave', 0.7)],
    comp: hits(c(2, 2, 0.7), c(6, 2, 0.6), c(10, 2, 0.7), c(14, 2, 0.6)),
  },
  gospel: {
    swing: false,
    drums: [...d('kick', 0.8, 0, 8), ...d('snare', 0.9, 4, 12), ...d('hat', 0.45, 2, 6, 10, 14)],
    fill: roll,
    bass: [b(0, 6, 'root', 0.85), b(6, 2, 'fifth', 0.6), b(8, 6, 'root', 0.8), b(14, 2, 'third', 0.6)],
    comp: hits(c(0, 6, 0.75), c(6, 2, 0.55), c(8, 6, 0.7), c(14, 2, 0.55)),
  },
  classical: {
    swing: false,
    drums: [],
    fill: [],
    bass: [b(0, 8, 'root', 0.7), b(8, 8, 'fifth', 0.65)],
    comp: { kind: 'arpeggio', step: 2, velocity: 0.55 },
  },
  lofi: {
    swing: false,
    drums: [...d('kick', 0.7, 0, 10), ...d('snare', 0.55, 4, 12), ...d('hat', 0.28, ...EIGHTHS)],
    fill: [],
    bass: [b(0, 8, 'root', 0.8), b(10, 6, 'fifth', 0.6)],
    comp: hits(c(0, 6, 0.55), c(6, 2, 0.4), c(10, 4, 0.5)),
  },
  cinematic: {
    swing: false,
    drums: d('kick', 0.5, 0),
    fill: [],
    bass: [b(0, 16, 'root', 0.6)],
    comp: hits(c(0, 16, 0.5)),
  },
};
