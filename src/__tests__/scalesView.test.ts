import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ScalesView } from '../scales/scalesView';
import { NoteInputHub } from '../input/noteInput';
import type { PianoVoice } from '../playback/pianoVoice';
import { initLocale, setLocale } from '../i18n';

function svgWithNotes(count: number): string {
  const notes = Array.from({ length: count }, (_, i) => `<g class="note"><g class="notehead"><use x="${100 + i * 500}" y="300"/></g></g>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="640px" height="210px">${notes}</svg>`;
}

function setup(options: { ready?: boolean } = {}) {
  const toolkit = {
    setOptions: vi.fn(),
    loadData: vi.fn(),
    renderToSVG: vi.fn(() => svgWithNotes(8)),
  };
  const voice: PianoVoice = { ready: vi.fn(async () => options.ready ?? true), play: vi.fn(), stopAll: vi.fn() };
  const hub = new NoteInputHub();
  const onPlayed = vi.fn();
  const onBack = vi.fn();
  const view = new ScalesView({ toolkit, voice, hub, formatName: (n) => n, onBack, onPlayed });
  document.body.replaceChildren(view.element);
  view.activate();
  return { view, toolkit, voice, hub, onPlayed, onBack };
}

const $ = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector)!;
const all = <T extends HTMLElement>(selector: string) => Array.from(document.querySelectorAll<T>(selector));
const flush = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};
const labels = () => all('.sc-staff .note-label').map((el) => el.textContent);
const press = (note: string) => $(`.lk-key[data-note="${note}"]`).dispatchEvent(new Event('pointerdown', { bubbles: true, cancelable: true }));

beforeEach(() => {
  localStorage.clear();
  initLocale();
  setLocale('en');
});

describe('ScalesView', () => {
  it('starts with the C major scale: twelve starting notes, six kinds, the staff and the keys', () => {
    const { view } = setup();
    expect(all('.sc-roots .sc-chip').map((c) => c.textContent)).toEqual(['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']);
    expect(all('.sc-types .sc-chip')).toHaveLength(6);
    expect($('.sc-roots [aria-pressed="true"]').textContent).toBe('C');
    expect(view.current().spelled.notes).toEqual(['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5']);
    expect($('.sc-staff svg')).not.toBeNull();
    expect($('.sc-notes').textContent).toBe('Notes: C D E F G A B C');
  });

  it('writes the key signature into the picture of the staff', () => {
    const { toolkit } = setup();
    $('[data-root="1"]').click(); // D flat
    const xml = String(toolkit.loadData.mock.calls.at(-1)![0]);
    expect(xml).toContain('<fifths>-5</fifths>');
    expect(xml).toContain('<step>D</step><alter>-1</alter>');
  });

  it('marks the keys of the scale', () => {
    setup();
    const marked = all('.lk-key.marked').map((k) => k.getAttribute('data-note'));
    expect(marked).toEqual(['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5']);
    $('[data-root="1"]').click();
    expect(all('.lk-key.marked').map((k) => k.getAttribute('data-note'))).toEqual(['C#4', 'D#4', 'F4', 'F#4', 'G#4', 'A#4', 'C5', 'C#5']);
  });

  it('writes the note names under the notes, and the fingers when asked', () => {
    setup();
    expect(labels()).toEqual(['C', 'D', 'E', 'F', 'G', 'A', 'B', 'C']);
    $('[data-labels="right"]').click();
    expect(labels()).toEqual(['1', '2', '3', '1', '2', '3', '4', '5']);
    $('[data-labels="left"]').click();
    expect(labels()).toEqual(['5', '4', '3', '2', '1', '3', '2', '1']);
  });

  it('says there is no fingering for a scale that has none, and shows the names instead', () => {
    setup();
    $('[data-labels="right"]').click();
    $('[data-root="1"]').click(); // D flat major
    expect($('.sc-note').hidden).toBe(false);
    expect($('.sc-note').textContent).toMatch(/no fingering/);
    expect(labels()).toEqual(['Db', 'Eb', 'F', 'Gb', 'Ab', 'Bb', 'C', 'Db']);
    $('[data-root="0"]').click();
    expect($('.sc-note').hidden).toBe(true);
  });

  it('changes the kind of scale', () => {
    const { view } = setup();
    $('[data-root="9"]').click();
    $('[data-type="harmonic"]').click();
    expect(view.current().spelled.notes).toEqual(['A4', 'B4', 'C5', 'D5', 'E5', 'F5', 'G#5', 'A5']);
  });

  it('shows chords: a few notes, no fingering row', () => {
    const { view } = setup();
    $('[data-tab="chords"]').click();
    expect(view.current().tab).toBe('chords');
    expect(all('.sc-types .sc-chip')).toHaveLength(7);
    expect($('.sc-labels').hidden).toBe(true);
    expect(view.current().spelled.notes).toEqual(['C4', 'E4', 'G4']);
    $('[data-type="m7"]').click();
    expect(view.current().spelled.notes).toEqual(['C4', 'Eb4', 'G4', 'Bb4']);
  });

  it('plays a scale up and down, one note after the other', async () => {
    const { voice } = setup();
    $('.sc-hear').click();
    await flush();
    const notes = vi.mocked(voice.play).mock.calls.map((c) => c[0]);
    expect(notes).toEqual(['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5', 'B4', 'A4', 'G4', 'F4', 'E4', 'D4', 'C4']);
    const starts = vi.mocked(voice.play).mock.calls.map((c) => c[2]);
    for (let i = 1; i < starts.length; i++) expect(starts[i]).toBeGreaterThan(starts[i - 1]);
  });

  it('plays a chord note by note, then all together', async () => {
    const { voice } = setup();
    $('[data-tab="chords"]').click();
    $('.sc-hear').click();
    await flush();
    const calls = vi.mocked(voice.play).mock.calls;
    expect(calls.map((c) => c[0])).toEqual(['C4', 'E4', 'G4', 'C4', 'E4', 'G4']);
    const together = calls.slice(3).map((c) => c[2]);
    expect(new Set(together).size).toBe(1);
    expect(together[0]).toBeGreaterThan(calls[2][2]);
  });

  it('says so when the piano cannot be loaded', async () => {
    const { voice } = setup({ ready: false });
    $('.sc-hear').click();
    await flush();
    expect(voice.play).not.toHaveBeenCalled();
    expect($('.sc-status').textContent).toMatch(/could not be loaded/);
  });

  it('remembers the choice for the next visit', () => {
    setup();
    $('[data-root="7"]').click();
    $('[data-type="minor"]').click();
    const { view } = setup();
    expect(view.current().spelled).toMatchObject({ root: 'G', fifths: -2 });
  });

  it('goes back', () => {
    const { onBack } = setup();
    $('.back-btn').click();
    expect(onBack).toHaveBeenCalled();
  });
});

describe('ScalesView: playing along', () => {
  it('marks the key to play, moves on when it is played, and finishes with a reward', async () => {
    const { onPlayed } = setup();
    $('.sc-along').click();
    expect($('.sc-status').textContent).toBe('Play the marked key.');
    expect(all('.lk-key.next-key').map((k) => k.getAttribute('data-note'))).toEqual(['C4']);
    press('C4');
    expect(all('.lk-key.next-key').map((k) => k.getAttribute('data-note'))).toEqual(['D4']);
    for (const note of ['D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5']) press(note);
    expect($('.sc-status').textContent).toBe('Well done! You played every note.');
    expect($('.sc-status').dataset.tone).toBe('good');
    expect(onPlayed).toHaveBeenCalledTimes(1);
    expect(all('.lk-key.next-key')).toHaveLength(0);
    expect($('.sc-along').textContent).toBe('Play along');
  });

  it('says when a wrong key is played, and stays at the same key', () => {
    setup();
    $('.sc-along').click();
    press('E4');
    expect($('.sc-status').textContent).toBe('Not that one. Look at the marked key.');
    expect(all('.lk-key.next-key').map((k) => k.getAttribute('data-note'))).toEqual(['C4']);
  });

  it('follows the flats of a scale on the sharp-named keys', () => {
    setup();
    $('[data-root="1"]').click();
    $('.sc-along').click();
    expect(all('.lk-key.next-key').map((k) => k.getAttribute('data-note'))).toEqual(['C#4']);
  });

  it('takes notes from a MIDI keyboard, but only while the screen is open', () => {
    const { view, hub, onPlayed } = setup();
    $('.sc-along').click();
    view.deactivate();
    hub.noteOn('C4', 'midi');
    expect($('.sc-along').getAttribute('aria-pressed')).toBe('false'); // leaving stopped it
    view.activate();
    $('.sc-along').click();
    for (const note of ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5']) hub.noteOn(note, 'midi');
    expect(onPlayed).toHaveBeenCalledTimes(1);
  });

  it('stops when the choice changes or the stop button is pressed', () => {
    const { view } = setup();
    $('.sc-along').click();
    expect($('.sc-along').textContent).toBe('Stop');
    $('.sc-along').click();
    expect(view.current().along).toBe(false);
    $('.sc-along').click();
    $('[data-root="2"]').click();
    expect(view.current().along).toBe(false);
  });
});

describe('ScalesView: Persian', () => {
  it('speaks Persian with Persian digits for the fingers', () => {
    setLocale('fa');
    setup();
    expect($('.view-title').textContent).toBe('گام‌ها و آکوردها');
    expect($('[data-tab="chords"]').textContent).toBe('آکوردها');
    $('[data-labels="right"]').click();
    expect(labels()).toEqual(['۱', '۲', '۳', '۱', '۲', '۳', '۴', '۵']);
    expect($('.sc-staff').getAttribute('dir')).toBe('ltr');
    expect($('.sc-keys').getAttribute('dir')).toBe('ltr');
  });
});
