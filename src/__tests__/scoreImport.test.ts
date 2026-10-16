import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { Midi } from '@tonejs/midi';
import { readScoreFile, parseStoredScore, scoreIdForData, titleFromFileName, type ScoreFile } from '../scores/scoreImport';
import { buildSongXml } from '../songs/songBuilder';

const XML = buildSongXml({
  id: 't', title: 'Little Tune', composer: 'Me', difficulty: 'beginner', category: 'nursery',
  fifths: 0, beats: 4, melody: 'C4q D4q E4q F4q | G4w',
});

/** The least a File needs: a name, text() and arrayBuffer(). */
function fakeFile(name: string, content: string | ArrayBuffer | Uint8Array): ScoreFile {
  const bytes = typeof content === 'string' ? new TextEncoder().encode(content) : content instanceof Uint8Array ? content : new Uint8Array(content);
  const copy = bytes.slice().buffer as ArrayBuffer;
  return {
    name,
    text: async () => new TextDecoder().decode(bytes),
    arrayBuffer: async () => copy,
  };
}

function midiBytes(): ArrayBuffer {
  const midi = new Midi();
  const track = midi.addTrack();
  [60, 62, 64, 65, 67].forEach((note, i) => track.addNote({ midi: note, time: i * 0.5, duration: 0.5 }));
  const bytes = midi.toArray();
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

async function mxlBytes(xml: string): Promise<ArrayBuffer> {
  const zip = new JSZip();
  zip.file('META-INF/container.xml', '<?xml version="1.0"?><container><rootfiles><rootfile full-path="score.xml"/></rootfiles></container>');
  zip.file('score.xml', xml);
  return zip.generateAsync({ type: 'arraybuffer' });
}

describe('readScoreFile', () => {
  it('reads a MusicXML file', async () => {
    const score = await readScoreFile(fakeFile('tune.musicxml', XML));
    expect(score.kind).toBe('xml');
    expect(score.data).toBe(XML);
    expect(score.parsed.measures).toHaveLength(2);
    expect(score.title).toBe('Little Tune');
  });

  it('reads a plain .xml file the same way', async () => {
    const score = await readScoreFile(fakeFile('tune.xml', XML));
    expect(score.kind).toBe('xml');
  });

  it('reads a compressed .mxl file and keeps the MusicXML inside', async () => {
    const score = await readScoreFile(fakeFile('tune.mxl', await mxlBytes(XML)));
    expect(score.kind).toBe('xml');
    expect(score.data).toBe(XML);
    expect(score.parsed.measures).toHaveLength(2);
  });

  it('finds the score in an .mxl without a container file', async () => {
    const zip = new JSZip();
    zip.file('inner.xml', XML);
    const score = await readScoreFile(fakeFile('x.mxl', await zip.generateAsync({ type: 'arraybuffer' })));
    expect(score.parsed.measures).toHaveLength(2);
  });

  it('reads a MIDI file and keeps its bytes', async () => {
    const bytes = midiBytes();
    const score = await readScoreFile(fakeFile('tune.mid', bytes));
    expect(score.kind).toBe('midi');
    expect(score.data).toBeInstanceOf(ArrayBuffer);
    expect((score.data as ArrayBuffer).byteLength).toBe(bytes.byteLength);
    expect(score.parsed.measures.length).toBeGreaterThan(0);
  });

  it('takes the title from the file name when the score has none', async () => {
    const noTitle = XML.replace(/<work>.*<\/work>/, '');
    expect((await readScoreFile(fakeFile('My_Favourite-Song.musicxml', noTitle))).title).toBe('My Favourite Song');
    expect((await readScoreFile(fakeFile('canon.mid', midiBytes()))).title).toBe('canon');
  });

  it('refuses a file with no measures', async () => {
    await expect(readScoreFile(fakeFile('empty.xml', '<score-partwise><part id="P1"/></score-partwise>'))).rejects.toThrow(/measures/i);
  });

  it('refuses a file that is not music', async () => {
    await expect(readScoreFile(fakeFile('notes.xml', 'hello'))).rejects.toThrow();
    await expect(readScoreFile(fakeFile('broken.mxl', new Uint8Array([1, 2, 3])))).rejects.toThrow();
    await expect(readScoreFile(fakeFile('broken.mid', new Uint8Array([1, 2, 3])))).rejects.toThrow();
  });

  it('refuses a file that is far too big', async () => {
    const huge = { name: 'big.xml', text: async () => 'x', arrayBuffer: async () => new ArrayBuffer(0), size: 60 * 1024 * 1024 };
    await expect(readScoreFile(huge)).rejects.toThrow(/big/i);
  });
});

describe('parseStoredScore', () => {
  it('reads a score that was kept, whatever its kind', () => {
    const xml = parseStoredScore({ id: 'a', title: 'A', kind: 'xml', data: XML, size: XML.length, addedAt: 1 });
    expect(xml.measures).toHaveLength(2);
    const maker = parseStoredScore({ id: 'b', title: 'B', kind: 'maker', data: XML, size: XML.length, addedAt: 1 });
    expect(maker.measures).toHaveLength(2);
    const midi = parseStoredScore({ id: 'c', title: 'C', kind: 'midi', data: midiBytes(), size: 10, addedAt: 1 });
    expect(midi.measures.length).toBeGreaterThan(0);
  });
});

describe('scoreIdForData', () => {
  it('gives the same id to the same file and another id to another file', () => {
    expect(scoreIdForData(XML)).toBe(scoreIdForData(XML));
    expect(scoreIdForData(XML)).not.toBe(scoreIdForData(XML + ' '));
    expect(scoreIdForData(XML)).toMatch(/^file-[0-9a-f]{8}$/);
  });

  it('works on bytes too', () => {
    const a = new Uint8Array([1, 2, 3]).buffer;
    expect(scoreIdForData(a)).toBe(scoreIdForData(new Uint8Array([1, 2, 3]).buffer));
    expect(scoreIdForData(a)).not.toBe(scoreIdForData(new Uint8Array([1, 2, 4]).buffer));
  });
});

describe('titleFromFileName', () => {
  it('drops the extension and turns underscores and dashes into spaces', () => {
    expect(titleFromFileName('Let_It-Be.mxl')).toBe('Let It Be');
    expect(titleFromFileName('Für Elise.MID')).toBe('Für Elise');
    expect(titleFromFileName('song')).toBe('song');
    expect(titleFromFileName('')).toBe('');
  });
});
