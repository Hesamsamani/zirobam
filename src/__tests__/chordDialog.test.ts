import { Midi } from '@tonejs/midi';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { initLocale, setLocale, setPersianDigits } from '../i18n';
import { openChordDialog, type ChordDialogDeps } from '../scales/chordDialog';
import { chordsOfScale } from '../theory/diatonic';
import { spellScale } from '../theory/spell';

/** A notation toolkit that draws as many notes as the XML it was given has. */
function setup(overrides: Partial<ChordDialogDeps> = {}) {
  let count = 0;
  const toolkit = {
    setOptions: vi.fn(),
    loadData: vi.fn((xml: string) => {
      count = (xml.match(/<note>/g) ?? []).length;
    }),
    renderToSVG: vi.fn(() => {
      const notes = Array.from({ length: count }, (_, i) => `<g class="note"><g class="notehead"><use x="${100 + i * 20}" y="300"/></g></g>`).join('');
      return `<svg xmlns="http://www.w3.org/2000/svg" width="640px" height="210px">${notes}</svg>`;
    }),
  };
  const voice = { ready: vi.fn(async () => true), play: vi.fn(), stopAll: vi.fn() };
  const download = vi.fn();
  const notify = vi.fn();
  const deps: ChordDialogDeps = {
    toolkit,
    voice,
    formatName: (note) => note.replace('#', '♯').replace(/(?<=[A-G])b/, '♭'),
    download,
    notify,
    ...overrides,
  };
  return { toolkit, voice, download, notify, deps };
}

const c = (family: 'triad' | 'seventh', degree = 1) => chordsOfScale(spellScale(0, 'major'), { families: [family], degree })[0];
const $ = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector)!;
const all = <T extends HTMLElement>(selector: string) => Array.from(document.querySelectorAll<T>(selector));
const flush = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};

beforeEach(() => {
  document.body.replaceChildren();
  localStorage.clear();
  initLocale();
  setLocale('en');
  setPersianDigits(false);
});

describe('the chord dialog: what it says about the chord', () => {
  it('is a dialog named after the chord, with its kind, degree and notes', () => {
    const { deps } = setup();
    openChordDialog(c('seventh'), deps);
    const dialog = $('dialog.app-dialog');
    expect(dialog.querySelector('.app-dialog-title')!.textContent).toBe('Cmaj7');
    expect($('.cd-kind').textContent).toBe('Major seventh');
    expect($('.cd-sub').textContent).toBe('Degree 1 of the scale, Imaj7');
    expect($('.cd-notes').textContent).toBe('C · E · G · B');
  });

  it('writes the notes with the names the student chose', () => {
    const { deps } = setup();
    openChordDialog(chordsOfScale(spellScale(10, 'major'), { families: ['triad'], degree: 1 })[0], deps);
    expect($('.app-dialog-title').textContent).toBe('B♭');
    expect($('.cd-notes').textContent).toBe('B♭ · D · F');
  });

  it('draws the chord on the staff, all its notes at once, and on the keys with the root marked', () => {
    const { deps, toolkit } = setup();
    openChordDialog(c('seventh'), deps);
    const xml = toolkit.loadData.mock.calls.at(-1)![0] as string;
    expect(xml.match(/<note>/g)).toHaveLength(4);
    expect(xml.match(/<chord\/>/g)).toHaveLength(3);
    expect(all('.cd-staff .note')).toHaveLength(4);
    expect(all('.cd-keys .lk-key.marked').map((k) => k.dataset.note)).toEqual(['C4', 'E4', 'G4', 'B4']);
    expect(all('.cd-keys .lk-key.lk-root').map((k) => k.dataset.note)).toEqual(['C4']);
    expect($('.cd-staff').getAttribute('dir')).toBe('ltr');
    expect($('.cd-keys').getAttribute('dir')).toBe('ltr');
  });
});

describe('the chord dialog: the turns of the chord', () => {
  it('offers the root position and one turn for each other note, and the chord it was opened with is pressed', () => {
    const { deps } = setup();
    openChordDialog(c('seventh'), deps);
    const chips = all('.cd-turns .sc-chip');
    expect(chips.map((chip) => chip.textContent)).toEqual(['Root position', 'First inversion', 'Second inversion', 'Third inversion']);
    expect(chips.map((chip) => chip.getAttribute('aria-pressed'))).toEqual(['true', 'false', 'false', 'false']);
  });

  it('opens on the turn of the card that was pressed', () => {
    const { deps } = setup();
    const turned = chordsOfScale(spellScale(0, 'major'), { families: ['triad'], degree: 1 })[0];
    openChordDialog({ ...turned, notes: ['E', 'G', 'C'], inversion: 1, bass: 'E', symbol: 'C/E' }, deps);
    expect($('.app-dialog-title').textContent).toBe('C/E');
    expect(all('.cd-turns .sc-chip').map((chip) => chip.getAttribute('aria-pressed'))).toEqual(['false', 'true', 'false']);
  });

  it('shows another turn on the staff, the keys, the title and the guitar when it is chosen', () => {
    const { deps, toolkit } = setup();
    openChordDialog(c('seventh'), deps);
    all<HTMLButtonElement>('.cd-turns .sc-chip')[2].click();
    expect($('.app-dialog-title').textContent).toBe('Cmaj7/G');
    expect($('.cd-notes').textContent).toBe('G · B · C · E');
    expect(all('.cd-turns .sc-chip').map((chip) => chip.getAttribute('aria-pressed'))).toEqual(['false', 'false', 'true', 'false']);
    const xml = toolkit.loadData.mock.calls.at(-1)![0] as string;
    expect(xml.indexOf('<step>G</step>')).toBeLessThan(xml.indexOf('<step>B</step>'));
    // the lowest note of every guitar shape is now the bass, G
    for (const shape of all('.cd-shape')) {
      const frets = shape.dataset.frets!.split(',').map(Number);
      const open = [40, 45, 50, 55, 59, 64];
      const lowest = frets.map((f, i) => (f < 0 ? null : open[i] + f)).find((m) => m !== null)!;
      expect(lowest % 12).toBe(7);
    }
  });

  it('keeps the focus on the chip that was pressed', () => {
    const { deps } = setup();
    openChordDialog(c('triad'), deps);
    const chip = all<HTMLButtonElement>('.cd-turns .sc-chip')[1];
    chip.focus();
    chip.click();
    expect(document.activeElement).toBe(all('.cd-turns .sc-chip')[1]);
  });
});

describe('the chord dialog: the guitar', () => {
  it('shows the shapes of the chord with a diagram, the kind of shape and the tuning', () => {
    const { deps } = setup();
    openChordDialog(c('triad'), deps);
    const shapes = all('.cd-shape');
    expect(shapes.length).toBeGreaterThan(2);
    const open = $('.cd-shape[data-frets="-1,3,2,0,1,0"]');
    expect(open.querySelector('.fretboard')).not.toBeNull();
    expect(open.querySelector('.cd-shape-kind')!.textContent).toBe('Open');
    expect(open.querySelector('.fretboard')!.getAttribute('aria-label')).toBe('Guitar shape for C: Open, frets from the low string: muted, 3, 2, 0, 1, 0.');
    expect($('.cd-tuning').textContent).toBe('Standard tuning, low string on the left: E A D G B E.');
    // a barre shape higher up the neck says where it starts
    const barre = all('.cd-shape').find((s) => s.dataset.kind === 'barre')!;
    expect(barre.querySelector('.cd-shape-kind')!.textContent).toContain('Barre');
  });

  it('plays a shape string by string from the bottom up', async () => {
    const { deps, voice } = setup();
    openChordDialog(c('triad'), deps);
    $<HTMLButtonElement>('.cd-shape[data-frets="-1,3,2,0,1,0"] .cd-shape-hear').click();
    await flush();
    const played = voice.play.mock.calls.map((call) => call[0]);
    expect(played).toEqual(['C3', 'E3', 'G3', 'C4', 'E4']);
    const starts = voice.play.mock.calls.map((call) => call[2]);
    expect([...starts].sort((a, b) => a - b)).toEqual(starts);
    expect(new Set(starts).size).toBe(5);
  });

  it('has no guitar part for a chord no shape fits, and says so', () => {
    const { deps } = setup();
    // a chord the search cannot place: a made-up one with a note that is no pitch class of the guitar search
    const odd = { ...c('triad'), def: { ...c('triad').def, id: 'cluster', formula: ['1P', '2m', '2M', '3m', '3M', '4P', '5P'] as const } };
    openChordDialog(odd, deps);
    expect(all('.cd-shape')).toHaveLength(0);
    expect($('.cd-guitar-none').textContent).toBe('No guitar shape was found for this chord.');
  });
});

describe('the chord dialog: listening and saving', () => {
  it('plays the chord all at once', async () => {
    const { deps, voice } = setup();
    openChordDialog(c('seventh'), deps);
    $<HTMLButtonElement>('.cd-play').click();
    await flush();
    expect(voice.stopAll).toHaveBeenCalled();
    expect(voice.play.mock.calls.map((call) => call[0])).toEqual(['C4', 'E4', 'G4', 'B4']);
    expect(new Set(voice.play.mock.calls.map((call) => call[2])).size).toBe(1);
  });

  it('plays an arpeggio: the notes one after the other, then together', async () => {
    const { deps, voice } = setup();
    openChordDialog(c('triad'), deps);
    $<HTMLButtonElement>('.cd-arpeggio').click();
    await flush();
    const calls = voice.play.mock.calls;
    expect(calls).toHaveLength(6);
    expect(calls.slice(0, 3).map((call) => call[0])).toEqual(['C4', 'E4', 'G4']);
    const starts = calls.map((call) => call[2] as number);
    expect(starts[0]).toBeLessThan(starts[1]);
    expect(starts[1]).toBeLessThan(starts[2]);
    expect(starts[3]).toBe(starts[4]);
    expect(starts[3]).toBeGreaterThan(starts[2]);
  });

  it('says so when the piano cannot be loaded', async () => {
    const { deps, voice } = setup();
    voice.ready.mockResolvedValue(false);
    openChordDialog(c('triad'), deps);
    $<HTMLButtonElement>('.cd-play').click();
    await flush();
    expect(voice.play).not.toHaveBeenCalled();
    expect($('.cd-status').textContent).toBe('The piano sounds could not be loaded, so there is nothing to listen to.');
  });

  it('downloads the chord as a MIDI file the notes of which can be read back', () => {
    const { deps, download, notify } = setup();
    openChordDialog(c('seventh'), deps);
    $<HTMLButtonElement>('.cd-midi').click();
    expect(download).toHaveBeenCalledTimes(1);
    const [fileName, bytes] = download.mock.calls[0] as [string, Uint8Array];
    expect(fileName).toBe('Cmaj7.mid');
    const midi = new Midi(bytes);
    expect(midi.tracks[0].notes.map((n) => n.midi)).toEqual([60, 64, 67, 71, 60, 64, 67, 71]);
    expect(notify).toHaveBeenCalledWith('Saved Cmaj7.mid.');
  });

  it('names the file of a turned chord without a slash', () => {
    const { deps, download } = setup();
    openChordDialog(c('seventh'), deps);
    all<HTMLButtonElement>('.cd-turns .sc-chip')[1].click();
    $<HTMLButtonElement>('.cd-midi').click();
    expect(download.mock.calls[0][0]).toBe('Cmaj7-over-E.mid');
    const midi = new Midi(download.mock.calls[0][1] as Uint8Array);
    expect(midi.tracks[0].notes.slice(0, 4).map((n) => n.midi)).toEqual([64, 67, 71, 72]);
  });
});

describe('the chord dialog: closing', () => {
  it('closes with Escape, stops the sound and gives the focus back to the card that opened it', () => {
    const { deps, voice } = setup();
    const card = document.createElement('button');
    document.body.append(card);
    card.focus();
    openChordDialog(c('triad'), deps);
    $('dialog.app-dialog').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(document.querySelector('dialog')).toBeNull();
    expect(voice.stopAll).toHaveBeenCalled();
    expect(document.activeElement).toBe(card);
  });
});

describe('the chord dialog in Persian', () => {
  it('has Persian text and digits, and keeps the chord symbol, the staff, the keys and the diagrams left to right', () => {
    setLocale('fa');
    setPersianDigits(true);
    const { deps } = setup();
    openChordDialog(c('seventh'), deps);
    expect($('.cd-sub').textContent).toBe('درجه‌ی ۱ گام، Imaj7');
    expect($('.cd-turns').getAttribute('aria-label')).toBe('برگردان‌های آکورد');
    expect(all('.cd-turns .sc-chip')[0].textContent).toBe('وضع اصلی');
    expect($('.app-dialog-title').getAttribute('dir')).toBe('ltr');
    expect($('.cd-staff').getAttribute('dir')).toBe('ltr');
    expect($('.cd-keys').getAttribute('dir')).toBe('ltr');
    expect($('.fretboard').getAttribute('dir')).toBe('ltr');
    expect($('.cd-shape .fretboard').getAttribute('aria-label')).toContain('فرت‌ها از سیم بم');
  });
});
