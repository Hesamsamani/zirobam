import { describe, it, expect } from 'vitest';
import { exampleLength, exampleTimeline } from '../lessons/exampleTimeline';

describe('exampleTimeline', () => {
  it('puts the notes one after another, in beats', () => {
    const events = exampleTimeline({ clef: 'treble', notes: 'C4q D4q E4h' });
    expect(events).toEqual([
      { pitch: 'C4', start: 0, length: 1 },
      { pitch: 'D4', start: 1, length: 1 },
      { pitch: 'E4', start: 2, length: 2 },
    ]);
  });

  it('counts rests and dotted notes', () => {
    const events = exampleTimeline({ clef: 'treble', notes: 'C4q. D4e rq E4q' });
    expect(events.map((e) => [e.pitch, e.start, e.length])).toEqual([
      ['C4', 0, 1.5],
      ['D4', 1.5, 0.5],
      ['E4', 3, 1],
    ]);
  });

  it('continues across the barline', () => {
    const events = exampleTimeline({ clef: 'treble', notes: 'C4w | D4w' });
    expect(events.map((e) => e.start)).toEqual([0, 4]);
  });

  it('joins tied notes into one long sound', () => {
    const events = exampleTimeline({ clef: 'treble', notes: 'C4h~ C4q D4q' });
    expect(events).toEqual([
      { pitch: 'C4', start: 0, length: 3 },
      { pitch: 'D4', start: 3, length: 1 },
    ]);
  });

  it('plays both staves of a grand staff together', () => {
    const events = exampleTimeline({ clef: 'grand', notes: 'E4h G4h', lower: 'C3w' });
    expect(events.filter((e) => e.start === 0).map((e) => e.pitch).sort()).toEqual(['C3', 'E4']);
    expect(events.find((e) => e.pitch === 'C3')?.length).toBe(4);
  });

  it('sorts by start time so a player can walk the list', () => {
    const events = exampleTimeline({ clef: 'grand', notes: 'E4h G4h', lower: 'C3q D3q E3h' });
    const starts = events.map((e) => e.start);
    expect([...starts].sort((a, b) => a - b)).toEqual(starts);
  });

  it('measures the whole example', () => {
    expect(exampleLength({ clef: 'treble', notes: 'C4w | D4h D4q rq' })).toBe(8);
    expect(exampleLength({ clef: 'grand', notes: 'C4w', lower: 'C3w' })).toBe(4);
  });

  it('works for charts of note lengths that do not fill their measures', () => {
    const events = exampleTimeline({ clef: 'treble', notes: 'C5w D5h E5q', free: true });
    expect(events.map((e) => e.length)).toEqual([4, 2, 1]);
  });
});
