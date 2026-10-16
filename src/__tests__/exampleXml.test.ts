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
