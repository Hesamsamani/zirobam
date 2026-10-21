import { describe, expect, it } from 'vitest';
import { arrangeBand, chordAtBeat, type BandEvent } from '../band/arrange';
import { BAND_PARTS, PATTERNS } from '../band/patterns';
import { generateProgression, type Progression } from '../generator/progression';
import { STYLE_IDS, type StyleId } from '../generator/styles';
import { spellScale } from '../theory/spell';

const cMajor = spellScale(0, 'major');
const make = (style: StyleId, bars = 8, seed = 1, scale = cMajor): Progression => generateProgression({ scale, style, bars, seed, bpm: 100 });
const ofPart = (events: readonly BandEvent[], part: string) => events.filter((e) => e.part === part);

describe('the patterns', () => {
  it('give every style a groove: places inside the bar, softer than loud, and bass and chords that fit a bar', () => {
    for (const id of STYLE_IDS) {
      const p = PATTERNS[id];
      for (const hit of [...p.drums, ...p.fill]) {
        expect(hit.at, `${id} drums`).toBeGreaterThanOrEqual(0);
        expect(hit.at).toBeLessThan(16);
        expect(hit.velocity).toBeGreaterThan(0);
        expect(hit.velocity).toBeLessThanOrEqual(1);
      }
      for (const hit of p.fill) expect(hit.at, `${id} fill`).toBeGreaterThanOrEqual(12);
      expect(p.bass.length, `${id} bass`).toBeGreaterThan(0);
      let end = 0;
      for (const hit of [...p.bass].sort((a, z) => a.at - z.at)) {
        expect(hit.at, `${id} bass`).toBeGreaterThanOrEqual(end);
        end = hit.at + hit.length;
        expect(end).toBeLessThanOrEqual(16);
        expect(hit.velocity).toBeGreaterThan(0);
        expect(hit.velocity).toBeLessThanOrEqual(1);
      }
      if (p.comp.kind === 'hits') {
        expect(p.comp.hits.length).toBeGreaterThan(0);
        for (const hit of p.comp.hits) {
          expect(hit.at).toBeGreaterThanOrEqual(0);
          expect(hit.at + hit.length).toBeLessThanOrEqual(16);
        }
      } else {
        expect(p.comp.step).toBeGreaterThan(0);
      }
    }
  });

  it('shuffle in the blues and in jazz, and nowhere else', () => {
    expect(STYLE_IDS.filter((id) => PATTERNS[id].swing)).toEqual(['blues', 'jazz']);
  });

  it('have no drums in classical music, and a quiet kick in cinematic', () => {
    expect(PATTERNS.classical.drums).toEqual([]);
    expect(PATTERNS.cinematic.drums.every((h) => h.piece === 'kick')).toBe(true);
  });

  it('name three parts', () => {
    expect(BAND_PARTS).toEqual(['drums', 'bass', 'chords']);
  });
});

describe('arrangeBand', () => {
  it('has events of all three parts, in time order, inside the loop', () => {
    const p = make('pop');
    const { events, loopBeats, countInBeats } = arrangeBand(p);
    expect(loopBeats).toBe(32);
    expect(countInBeats).toBe(0);
    expect(new Set(events.map((e) => e.part))).toEqual(new Set(['drums', 'bass', 'chords']));
    expect([...events].sort((a, b) => a.at - b.at)).toEqual(events);
    for (const e of events) {
      expect(e.at).toBeGreaterThanOrEqual(0);
      expect(e.at).toBeLessThan(loopBeats);
      expect(e.length).toBeGreaterThan(0);
      expect(e.velocity).toBeGreaterThan(0);
      expect(e.velocity).toBeLessThanOrEqual(1);
    }
    for (const e of ofPart(events, 'drums')) expect(e.drum).toBeDefined();
    for (const e of [...ofPart(events, 'bass'), ...ofPart(events, 'chords')]) expect(e.midis!.length).toBeGreaterThan(0);
  });

  it('plays a bass note where every chord begins, on the root of the chord', () => {
    for (const id of STYLE_IDS) {
      const p = make(id, 8, 3);
      const bass = ofPart(arrangeBand(p).events, 'bass');
      for (const chord of p.chords) {
        const start = chord.bar * 4 + chord.beat;
        const note = bass.find((e) => Math.abs(e.at - start) < 1e-9);
        expect(note, `${id} ${chord.chord.symbol} at beat ${start}`).toBeDefined();
        expect(note!.midis![0] % 12).toBe((chord.voicing.length > 0 ? midiRootPc(chord) : -1));
      }
    }
  });

  it('keeps the bass to one note at a time, in the low octaves', () => {
    for (const id of STYLE_IDS) {
      const bass = ofPart(arrangeBand(make(id, 8, 5)).events, 'bass');
      let end = 0;
      for (const e of bass) {
        expect(e.at, `${id}`).toBeGreaterThanOrEqual(end - 1e-9);
        end = e.at + e.length;
        expect(e.midis).toHaveLength(1);
        expect(e.midis![0]).toBeGreaterThanOrEqual(34);
        expect(e.midis![0]).toBeLessThanOrEqual(62);
      }
    }
  });

  it('plays the chords as the voicing says, all at once or one note at a time', () => {
    const pop = make('pop', 4, 2);
    const first = pop.chords[0];
    const chordEvents = ofPart(arrangeBand(pop).events, 'chords').filter((e) => e.at === 0);
    expect(chordEvents).toHaveLength(1);
    expect(chordEvents[0].midis).toEqual(first.voicing.map(midiOfPitch));
    const ballad = make('ballad', 4, 2);
    const arp = ofPart(arrangeBand(ballad).events, 'chords').filter((e) => e.at < 4);
    expect(arp.length).toBeGreaterThanOrEqual(6);
    for (const e of arp) expect(e.midis).toHaveLength(1);
    // up through the chord
    const firstChord = ballad.chords[0].voicing.map(midiOfPitch);
    expect(arp.slice(0, firstChord.length).map((e) => e.midis![0])).toEqual(firstChord);
  });

  it('lands the eighths between the beats late in a shuffle, and on time otherwise', () => {
    const blues = ofPart(arrangeBand(make('blues', 4, 1)).events, 'drums').filter((e) => e.drum === 'hat');
    expect(blues.some((e) => Math.abs(e.at - (0 + 2 / 3)) < 1e-9)).toBe(true);
    expect(blues.some((e) => Math.abs(e.at - 0.5) < 1e-9)).toBe(false);
    const pop = ofPart(arrangeBand(make('pop', 4, 1)).events, 'drums').filter((e) => e.drum === 'hat');
    expect(pop.some((e) => Math.abs(e.at - 0.5) < 1e-9)).toBe(true);
  });

  it('puts a fill in the last beat of the loop, in place of the groove', () => {
    const events = ofPart(arrangeBand(make('rock', 4, 1)).events, 'drums');
    const lastBeat = events.filter((e) => e.at >= 15);
    expect(lastBeat.some((e) => e.drum === 'tom')).toBe(true);
    expect(lastBeat.some((e) => e.drum === 'kick')).toBe(false);
    // the loop before it has no tom
    expect(events.filter((e) => e.at < 12).some((e) => e.drum === 'tom')).toBe(false);
  });

  it('moves the bass and the chords by the transposition and leaves the drums', () => {
    const p = make('pop', 4, 2);
    const plain = arrangeBand(p);
    const up = arrangeBand(p, { transpose: 3 });
    expect(up.events).toHaveLength(plain.events.length);
    plain.events.forEach((e, i) => {
      expect(up.events[i].at).toBe(e.at);
      if (e.part === 'drums') expect(up.events[i].midis).toBeUndefined();
      else expect(up.events[i].midis).toEqual(e.midis!.map((m) => m + 3));
    });
  });

  it('adds a bar of clicks before the loop and moves everything else four beats on', () => {
    const p = make('pop', 4, 2);
    const plain = arrangeBand(p);
    const counted = arrangeBand(p, { countIn: true });
    expect(counted.countInBeats).toBe(4);
    expect(counted.loopBeats).toBe(16);
    const clicks = counted.events.filter((e) => e.at < 4 && e.drum === 'hat').slice(0, 4);
    expect(clicks.map((e) => e.at)).toEqual([0, 1, 2, 3]);
    expect(clicks[0].velocity).toBeGreaterThan(clicks[1].velocity);
    expect(counted.events).toHaveLength(plain.events.length + 4);
    expect(counted.events.at(-1)!.at).toBe(plain.events.at(-1)!.at + 4);
  });

  it('arranges every style on every kind of scale: chords of the scale, nothing out of range', () => {
    const scales = [cMajor, spellScale('D', 'shur'), spellScale(5, 'dorian'), spellScale(0, 'blues')];
    for (const scale of scales) {
      for (const id of STYLE_IDS) {
        const p = generateProgression({ scale, style: id, bars: 8, seed: 4 });
        for (const transpose of [-6, 0, 6]) {
          const { events } = arrangeBand(p, { transpose });
          expect(events.length).toBeGreaterThan(8);
          for (const e of events) {
            expect(Number.isFinite(e.at) && Number.isFinite(e.length)).toBe(true);
            for (const m of e.midis ?? []) {
              expect(m, `${scale.id} ${id}`).toBeGreaterThanOrEqual(24);
              expect(m).toBeLessThanOrEqual(96);
            }
          }
        }
      }
    }
  });
});

describe('chordAtBeat', () => {
  it('names the chord that sounds on a beat, and goes round with the loop', () => {
    const p = make('pop', 4, 2);
    expect(chordAtBeat(p, 0)).toBe(p.chords[0]);
    expect(chordAtBeat(p, 4)!.bar).toBe(1);
    expect(chordAtBeat(p, 16)).toBe(p.chords[0]);
    expect(chordAtBeat(p, 16 + 5)!.bar).toBe(1);
    expect(chordAtBeat(p, -1)!.bar).toBe(3);
  });

  it('knows the second chord of a bar with two', () => {
    const jazz = make('jazz', 4, 1);
    const two = jazz.chords.filter((c) => c.bar === 0);
    if (two.length === 2) {
      expect(chordAtBeat(jazz, 1.9)).toBe(two[0]);
      expect(chordAtBeat(jazz, 2)).toBe(two[1]);
    }
  });

  it('has no chord when there are none', () => {
    expect(chordAtBeat({ ...make('pop'), chords: [] }, 3)).toBeNull();
  });
});

function midiOfPitch(pitch: string): number {
  const m = /^([A-G])(##|bb|[#b])?(-?\d+)$/.exec(pitch)!;
  const base = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1] as 'C'];
  const alter = { '': 0, '#': 1, '##': 2, b: -1, bb: -2 }[(m[2] ?? '') as '#'];
  return base + alter + 12 * (Number(m[3]) + 1);
}

function midiRootPc(chord: Progression['chords'][number]): number {
  return (((midiOfPitch(`${chord.chord.root}4`) % 12) + 12) % 12);
}
