import { describe, it, expect } from 'vitest';
import { buildExampleXml, exampleNoteNames } from '../lessons/exampleXml';

function doc(xml: string): Document {
  return new DOMParser().parseFromString(xml, 'text/xml');
}
const texts = (d: Document, tag: string) => Array.from(d.getElementsByTagName(tag)).map((e) => e.textContent);

describe('buildExampleXml', () => {
  it('draws notes on one treble staff', () => {
    const xml = buildExampleXml({ clef: 'treble', notes: 'C4q D4q E4q F4q' });
    const d = doc(xml);
    expect(d.getElementsByTagName('parsererror')).toHaveLength(0);
    expect(texts(d, 'step')).toEqual(['C', 'D', 'E', 'F']);
    expect(d.getElementsByTagName('sign')[0].textContent).toBe('G');
    expect(d.getElementsByTagName('staves')).toHaveLength(0);
  });

  it('draws notes on one bass staff', () => {
    const d = doc(buildExampleXml({ clef: 'bass', notes: 'C3q D3q E3q F3q' }));
    expect(d.getElementsByTagName('sign')[0].textContent).toBe('F');
    expect(d.getElementsByTagName('line')[0].textContent).toBe('4');
  });

  it('draws both staves, with notes in each, or a rest in the lower one', () => {
    const both = doc(buildExampleXml({ clef: 'grand', notes: 'C4w', lower: 'C3w' }));
    expect(texts(both, 'staves')).toEqual(['2']);
    const staffs = Array.from(both.getElementsByTagName('note')).map((n) => n.getElementsByTagName('staff')[0].textContent);
    expect(staffs).toEqual(['1', '2']);

    const upperOnly = doc(buildExampleXml({ clef: 'grand', notes: 'C4w' }));
    expect(upperOnly.getElementsByTagName('rest').length).toBe(1);
  });

  it('shows the time signature only when asked', () => {
    const hidden = doc(buildExampleXml({ clef: 'treble', notes: 'C4w' }));
    expect(hidden.getElementsByTagName('time')[0].getAttribute('print-object')).toBe('no');
    const shown = doc(buildExampleXml({ clef: 'treble', notes: 'C4h. | D4q E4q F4q', beats: 3, showTime: true }));
    expect(shown.getElementsByTagName('time')[0].getAttribute('print-object')).toBeNull();
    expect(texts(shown, 'beats')).toEqual(['3']);
  });

  it('writes the key signature', () => {
    const d = doc(buildExampleXml({ clef: 'treble', fifths: 2, notes: 'D4q E4q F#4q G4q' }));
    expect(texts(d, 'fifths')).toEqual(['2']);
  });

  it('puts every measure of a longer example in the score', () => {
    const d = doc(buildExampleXml({ clef: 'treble', notes: 'C4w | D4w | E4w' }));
    expect(d.getElementsByTagName('measure')).toHaveLength(3);
  });

  it('can show notes that do not fill a measure, for charts of note lengths', () => {
    const d = doc(buildExampleXml({ clef: 'treble', notes: 'C4w D4h E4q F4e', free: true }));
    expect(texts(d, 'type')).toEqual(['whole', 'half', 'quarter', 'eighth']);
  });

  it('refuses a measure of the wrong length unless it is free', () => {
    expect(() => buildExampleXml({ clef: 'treble', notes: 'C4q D4q' })).toThrow(/measure 1/i);
  });

  it('refuses a lower part that does not line up with the upper part', () => {
    expect(() => buildExampleXml({ clef: 'grand', notes: 'C4w | C4w', lower: 'C3w' })).toThrow(/lower/i);
  });

  it('writes rests, ties are not needed', () => {
    const d = doc(buildExampleXml({ clef: 'treble', notes: 'C4q rq C4h' }));
    expect(d.getElementsByTagName('rest')).toHaveLength(1);
  });
});

describe('ties and accidentals', () => {
  it('ties a note to the next one of the same pitch', () => {
    const d = doc(buildExampleXml({ clef: 'treble', notes: 'C4h~ C4q C4q' }));
    const ties = Array.from(d.getElementsByTagName('tie')).map((t) => t.getAttribute('type'));
    expect(ties).toEqual(['start', 'stop']);
    const tied = Array.from(d.getElementsByTagName('tied')).map((t) => t.getAttribute('type'));
    expect(tied).toEqual(['start', 'stop']);
  });

  it('can tie across the barline', () => {
    const d = doc(buildExampleXml({ clef: 'treble', notes: 'C4q C4q C4q C4q~ | C4h D4h' }));
    expect(Array.from(d.getElementsByTagName('tie')).map((t) => t.getAttribute('type'))).toEqual(['start', 'stop']);
  });

  it('shows a sharp or flat that the key signature does not have', () => {
    const d = doc(buildExampleXml({ clef: 'treble', notes: 'F4q F#4q Bb4q C5q' }));
    expect(Array.from(d.getElementsByTagName('accidental')).map((a) => a.textContent)).toEqual(['sharp', 'flat']);
  });

  it('cancels an accidental that is still in force later in the same measure', () => {
    const d = doc(buildExampleXml({ clef: 'treble', notes: 'F#4q F#4q F4q F4q' }));
    expect(Array.from(d.getElementsByTagName('accidental')).map((a) => a.textContent)).toEqual(['sharp', 'natural']);
  });

  it('starts every measure again from the key signature', () => {
    const d = doc(buildExampleXml({ clef: 'treble', notes: 'F#4q F#4q F#4q F#4q | F4w' }));
    expect(Array.from(d.getElementsByTagName('accidental')).map((a) => a.textContent)).toEqual(['sharp']);
  });

  it('keeps accidentals of different octaves apart', () => {
    const d = doc(buildExampleXml({ clef: 'treble', notes: 'F#4q F5q F#5q F4q' }));
    expect(Array.from(d.getElementsByTagName('accidental')).map((a) => a.textContent)).toEqual(['sharp', 'sharp', 'natural']);
  });

  it('does not repeat an accidental that is in the key signature', () => {
    const d = doc(buildExampleXml({ clef: 'treble', fifths: 1, notes: 'F#4q G4q A4q B4q' }));
    expect(d.getElementsByTagName('accidental')).toHaveLength(0);
  });

  it('shows a natural sign when the key has a sharp and the note is plain', () => {
    const d = doc(buildExampleXml({ clef: 'treble', fifths: 1, notes: 'F#4q Fn4q G4q A4q' }));
    expect(Array.from(d.getElementsByTagName('accidental')).map((a) => a.textContent)).toEqual(['natural']);
  });
});

describe('quarter tones and double signs', () => {
  it('draws koron and sori with their sign, and keeps the alteration', () => {
    const d = doc(buildExampleXml({ clef: 'treble', notes: 'Ek4q Fo4q G4q A4q' }));
    expect(texts(d, 'alter')).toEqual(['-0.5', '0.5']);
    expect(Array.from(d.getElementsByTagName('accidental')).map((a) => a.textContent)).toEqual(['koron', 'sori']);
  });

  it('draws double sharp and double flat', () => {
    const d = doc(buildExampleXml({ clef: 'treble', notes: 'F##4q Dbb4q G4h' }));
    expect(texts(d, 'alter')).toEqual(['2', '-2']);
    expect(Array.from(d.getElementsByTagName('accidental')).map((a) => a.textContent)).toEqual(['double-sharp', 'flat-flat']);
  });

  it('draws a natural to cancel a quarter tone that is still in force', () => {
    const d = doc(buildExampleXml({ clef: 'treble', notes: 'Ek4q En4q F4h' }));
    expect(Array.from(d.getElementsByTagName('accidental')).map((a) => a.textContent)).toEqual(['koron', 'natural']);
  });

  it('writes no sign for the repeat of a quarter tone in the same measure', () => {
    const d = doc(buildExampleXml({ clef: 'treble', notes: 'Ek4q Ek4q Ek4q Ek4q' }));
    expect(Array.from(d.getElementsByTagName('accidental')).map((a) => a.textContent)).toEqual(['koron']);
  });

  it('lists the written pitches of a quarter tone scale for the labels', () => {
    expect(exampleNoteNames({ clef: 'treble', notes: 'D4q Ek4q F4q G4q' })).toEqual(['D4', 'Ek4', 'F4', 'G4']);
  });
});

describe('chords', () => {
  it('stacks the notes of a chord with <chord/> after the first', () => {
    const d = doc(buildExampleXml({ clef: 'treble', notes: 'C4+E4+G4w' }));
    const notes = Array.from(d.getElementsByTagName('note'));
    expect(notes).toHaveLength(3);
    expect(notes.map((n) => n.getElementsByTagName('chord').length)).toEqual([0, 1, 1]);
    expect(texts(d, 'step')).toEqual(['C', 'E', 'G']);
    expect(texts(d, 'duration')).toEqual(['16', '16', '16']);
  });

  it('counts a chord once in the length of the measure', () => {
    expect(() => buildExampleXml({ clef: 'treble', notes: 'C4+E4+G4h C4+G4h | C4w' })).not.toThrow();
    expect(() => buildExampleXml({ clef: 'treble', notes: 'C4+E4+G4h C4+G4q' })).toThrow(/measure 1/i);
  });

  it('draws a chord in each hand of the grand staff', () => {
    const d = doc(buildExampleXml({ clef: 'grand', notes: 'E4+G4+C5w', lower: 'C3+G3w' }));
    const staffs = Array.from(d.getElementsByTagName('note')).map((n) => n.getElementsByTagName('staff')[0].textContent);
    expect(staffs).toEqual(['1', '1', '1', '2', '2']);
  });

  it('lists every pitch of a chord for the labels, lowest first', () => {
    expect(exampleNoteNames({ clef: 'treble', notes: 'G4+C4+E4w' })).toEqual(['C4', 'E4', 'G4']);
  });
});

describe('6/8', () => {
  it('writes the 6/8 time signature, and counts six eighths as a measure', () => {
    const spec = { clef: 'treble' as const, notes: 'C4e D4e E4e F4e G4e A4e', beats: 6 as const, beatType: 8 as const, showTime: true };
    const d = doc(buildExampleXml(spec));
    expect(texts(d, 'beats')).toEqual(['6']);
    expect(texts(d, 'beat-type')).toEqual(['8']);
    expect(() => buildExampleXml({ ...spec, notes: 'C4e D4e E4e F4e G4e' })).toThrow(/measure 1/i);
  });

  it('gives a whole-measure rest to the empty lower staff', () => {
    const d = doc(buildExampleXml({ clef: 'grand', notes: 'C4q. D4q.', beats: 6, beatType: 8 }));
    const rest = Array.from(d.getElementsByTagName('note')).find((n) => n.getElementsByTagName('rest').length > 0)!;
    expect(rest.getElementsByTagName('rest')[0].getAttribute('measure')).toBe('yes');
    expect(rest.getElementsByTagName('duration')[0].textContent).toBe('12');
  });

  it('keeps the time signature of the x/4 examples', () => {
    const d = doc(buildExampleXml({ clef: 'treble', notes: 'C4w', showTime: true }));
    expect(texts(d, 'beat-type')).toEqual(['4']);
  });
});

describe('exampleNoteNames', () => {
  it('lists the written pitches in order, skipping rests, for labelling the notes', () => {
    expect(exampleNoteNames({ clef: 'treble', notes: 'C4q rq E4h | G4w' , free: true })).toEqual(['C4', 'E4', 'G4']);
  });

  it('puts the upper staff first and then the lower one', () => {
    expect(exampleNoteNames({ clef: 'grand', notes: 'C4w', lower: 'C3w' })).toEqual(['C4', 'C3']);
  });

  it('goes measure by measure, the way the notes are drawn', () => {
    expect(exampleNoteNames({ clef: 'grand', notes: 'C4w | D4w', lower: 'C3w | D3w' })).toEqual(['C4', 'C3', 'D4', 'D3']);
  });

  it('writes a natural sign without changing the pitch name', () => {
    expect(exampleNoteNames({ clef: 'treble', notes: 'Fn4q F#4q Bb4q rq' })).toEqual(['F4', 'F#4', 'Bb4']);
  });
});
