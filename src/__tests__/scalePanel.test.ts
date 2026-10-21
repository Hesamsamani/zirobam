import { describe, it, expect, vi, beforeEach } from 'vitest';
import { initLocale, setLocale, setPersianDigits } from '../i18n';
import { ScalePanel, type ScalePanelDeps } from '../scales/scalePanel';
import { spellScale } from '../theory/spell';
import type { ScaleId } from '../theory/scaleCatalog';

/** A notation toolkit that draws as many notes as the XML it was given has. */
function setup(overrides: Partial<ScalePanelDeps> = {}) {
  let count = 0;
  const toolkit = {
    setOptions: vi.fn(),
    loadData: vi.fn((xml: string) => {
      count = (xml.match(/<note>/g) ?? []).length;
    }),
    renderToSVG: vi.fn(() => {
      const notes = Array.from({ length: count }, (_, i) => `<g class="note"><g class="notehead"><use x="${100 + i * 500}" y="300"/></g></g>`).join('');
      return `<svg xmlns="http://www.w3.org/2000/svg" width="640px" height="210px">${notes}</svg>`;
    }),
  };
  const voice = { ready: vi.fn(async () => true), play: vi.fn(), stopAll: vi.fn() };
  const deps: ScalePanelDeps = {
    toolkit,
    voice,
    formatName: (note) => note.replace('#', '♯').replace(/(?<=[A-G])b/, '♭'),
    onPlayed: vi.fn(),
    onAnswer: vi.fn(),
    onLabels: vi.fn(),
    ...overrides,
  };
  const panel = new ScalePanel(deps);
  document.body.replaceChildren(panel.element);
  const show = (root: number | string, id: ScaleId, labels: 'names' | 'right' | 'left' = 'names') => panel.show(spellScale(root, id), labels);
  return { panel, toolkit, voice, deps, show };
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

describe('ScalePanel: the title and the stairs', () => {
  it('names the scale and its root', () => {
    const { show } = setup();
    show('D', 'shur');
    expect($('.dict-scale-title').textContent).toBe('D Shur');
    show(1, 'major');
    expect($('.dict-scale-title').textContent).toBe('D♭ Major');
  });

  it('draws one step for each note, as wide as the gap to the next note, with its degree, name and size in tones', () => {
    const { show } = setup();
    show(0, 'major');
    const steps = all('.dict-step');
    expect(steps).toHaveLength(7);
    expect(steps.map((s) => s.style.flexGrow)).toEqual(['2', '2', '1', '2', '2', '2', '1']);
    expect(steps.map((s) => s.querySelector('.dict-step-degree')!.textContent)).toEqual(['1', '2', '3', '4', '5', '6', '7']);
    expect(steps.map((s) => s.querySelector('.dict-step-name')!.textContent)).toEqual(['C', 'D', 'E', 'F', 'G', 'A', 'B']);
    expect(steps.map((s) => s.querySelector('.dict-step-tones')!.textContent)).toEqual(['1', '1', '½', '1', '1', '1', '½']);
    expect(steps[0].dataset.tonic).toBe('true');
    expect(steps.slice(1).every((s) => s.dataset.tonic === 'false')).toBe(true);
  });

  it('shows a quarter tone as a step of its own kind', () => {
    const { show } = setup();
    show('D', 'shur');
    const steps = all('.dict-step');
    expect(steps.map((s) => s.style.flexGrow)).toEqual(['1.5', '1.5', '2', '2', '1', '2', '2']);
    expect(steps.map((s) => s.dataset.quarter)).toEqual(['false', 'true', 'false', 'false', 'false', 'false', 'false']);
    expect(steps[1].querySelector('.dict-step-name')!.textContent).toBe('Ek');
    expect(steps[0].querySelector('.dict-step-tones')!.textContent).toBe('¾');
  });

  it('describes a step for a screen reader', () => {
    const { show } = setup();
    show('D', 'shur');
    expect(all('.dict-step')[1].getAttribute('aria-label')).toBe('Ek, degree 2, a step of ¾ tones');
    expect($('.dict-stairs').getAttribute('role')).toBe('group');
    expect($('.dict-stairs').getAttribute('dir')).toBe('ltr');
  });

  it('plays a note when its step is pressed', async () => {
    const { show, voice } = setup();
    show('D', 'shur');
    all('.dict-step')[1].click();
    await flush();
    expect(voice.play).toHaveBeenCalledWith('Ek4', 0.9, 0);
  });

  it('uses Persian digits for the degrees when the screen is in Persian with them on, and Latin ones when they are off', () => {
    setLocale('fa');
    setPersianDigits(true);
    const { show } = setup();
    show(0, 'major');
    expect(all('.dict-step-degree').map((s) => s.textContent)).toEqual(['۱', '۲', '۳', '۴', '۵', '۶', '۷']);
    setPersianDigits(false);
    show(0, 'major');
    expect(all('.dict-step-degree').map((s) => s.textContent)).toEqual(['1', '2', '3', '4', '5', '6', '7']);
  });
});

describe('ScalePanel: the staff and the keys', () => {
  it('writes the key signature of a mode into the picture of the staff', () => {
    const { show, toolkit } = setup();
    show(1, 'major');
    expect(String(toolkit.loadData.mock.calls.at(-1)![0])).toContain('<fifths>-5</fifths>');
    show(2, 'dorian');
    expect(String(toolkit.loadData.mock.calls.at(-1)![0])).toContain('<fifths>0</fifths>');
  });

  it('draws koron with its own sign, and no key signature, for a Persian mode', () => {
    const { show, toolkit } = setup();
    show('D', 'shur');
    const xml = String(toolkit.loadData.mock.calls.at(-1)![0]);
    expect(xml).toContain('<fifths>0</fifths>');
    expect(xml).toContain('<accidental>koron</accidental>');
    expect(xml).toContain('<accidental>flat</accidental>');
  });

  it('draws as many notes as the scale has, and the root again at the end', () => {
    const { show } = setup();
    show(0, 'major');
    expect(all('.sc-staff svg .note')).toHaveLength(8);
    show(0, 'pentatonic-major');
    expect(all('.sc-staff svg .note')).toHaveLength(6);
    show(0, 'chromatic');
    expect(all('.sc-staff svg .note')).toHaveLength(13);
  });

  it('marks the keys of the scale, and the key of the root', () => {
    const { show } = setup();
    show(0, 'major');
    expect(all('.sc-keys .lk-key.marked').map((k) => k.getAttribute('data-note'))).toEqual(['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5']);
    expect(all('.sc-keys .lk-key.lk-root').map((k) => k.getAttribute('data-note'))).toEqual(['C4', 'C5']);
    show(1, 'major');
    expect(all('.sc-keys .lk-key.marked').map((k) => k.getAttribute('data-note'))).toEqual(['C#4', 'D#4', 'F4', 'F#4', 'G#4', 'A#4', 'C5', 'C#5']);
  });

  it('flags the key of a quarter tone, which is the key of its letter', () => {
    const { show } = setup();
    show('D', 'shur');
    const flagged = all('.sc-keys .lk-key.lk-quarter');
    expect(flagged.map((k) => k.getAttribute('data-note'))).toEqual(['E4']);
    expect(flagged[0].dataset.quarter).toBe('koron');
    expect(all('.sc-keys .lk-key.marked').map((k) => k.getAttribute('data-note'))).toEqual(['D4', 'E4', 'F4', 'G4', 'A4', 'A#4', 'C5', 'D5']);
  });

  it('shows the octave the scale lies in, even when it starts below middle C', () => {
    const { show } = setup();
    show('Cb', 'major'); // Cb4 is the key B3
    expect(all('.sc-keys .lk-key.marked').length).toBeGreaterThan(0);
    expect($('.sc-keys .lk-key[data-note="B3"]')).not.toBeNull();
  });

  it('writes the note names under the notes', () => {
    const { show } = setup();
    show(0, 'major');
    expect(labels()).toEqual(['C', 'D', 'E', 'F', 'G', 'A', 'B', 'C']);
    show('D', 'shur');
    expect(labels()).toEqual(['D', 'Ek', 'F', 'G', 'A', 'B♭', 'C', 'D']);
  });
});

describe('ScalePanel: fingering', () => {
  it('shows the fingers under the notes when asked, for each hand', () => {
    const { show } = setup();
    show(0, 'major', 'right');
    expect(labels()).toEqual(['1', '2', '3', '1', '2', '3', '4', '5']);
    show(0, 'major', 'left');
    expect(labels()).toEqual(['5', '4', '3', '2', '1', '3', '2', '1']);
  });

  it('says there is no fingering for a scale that has none, and shows the names instead', () => {
    const { show } = setup();
    show(1, 'major', 'right');
    expect($('.sc-note').hidden).toBe(false);
    expect($('.sc-note').textContent).toMatch(/no fingering/);
    expect(labels()).toEqual(['D♭', 'E♭', 'F', 'G♭', 'A♭', 'B♭', 'C', 'D♭']);
    show(0, 'major', 'right');
    expect($('.sc-note').hidden).toBe(true);
  });

  it('has three buttons for what goes under the notes, and says when one is pressed', () => {
    const { show, deps } = setup();
    show(0, 'major');
    expect(all('.sc-labels .sc-chip').map((c) => c.dataset.labels)).toEqual(['names', 'right', 'left']);
    expect($('.sc-labels [data-labels="names"]').getAttribute('aria-pressed')).toBe('true');
    $('.sc-labels [data-labels="right"]').click();
    expect(deps.onLabels).toHaveBeenCalledWith('right');
  });

  it('lists the notes in a line, with the root again at the end', () => {
    const { show } = setup();
    show(0, 'major');
    expect($('.sc-notes').textContent).toBe('Notes: C D E F G A B C');
    show('Ek', 'segah');
    expect($('.sc-notes').textContent).toBe('Notes: Ek F G Ak B♭ C D Ek');
  });
});

describe('ScalePanel: the Persian modes', () => {
  it('say they are a teaching model, and that the pitches are not checked yet', () => {
    const { show } = setup();
    show('D', 'shur');
    const text = $('.dict-persian').textContent ?? '';
    expect($('.dict-persian').hidden).toBe(false);
    expect(text).toMatch(/teaching model/);
    expect(text).toMatch(/not been checked/);
    expect(text).toMatch(/key of its letter/);
  });

  it('leave out the remark about the piano for a mode with no quarter tone', () => {
    const { show } = setup();
    show('C', 'mahur');
    expect($('.dict-persian').hidden).toBe(false);
    expect($('.dict-persian').textContent).not.toMatch(/key of its letter/);
  });

  it('are not mentioned for any other scale', () => {
    const { show } = setup();
    show(0, 'major');
    expect($('.dict-persian').hidden).toBe(true);
  });
});

describe('ScalePanel: hearing', () => {
  it('plays a scale up and down, one note after the other, quarter tones as they are written', async () => {
    const { show, voice } = setup();
    show('D', 'shur');
    $('.sc-hear').click();
    await flush();
    const notes = vi.mocked(voice.play).mock.calls.map((c) => c[0]);
    expect(notes).toEqual(['D4', 'Ek4', 'F4', 'G4', 'A4', 'Bb4', 'C5', 'D5', 'C5', 'Bb4', 'A4', 'G4', 'F4', 'Ek4', 'D4']);
    const starts = vi.mocked(voice.play).mock.calls.map((c) => c[2]);
    for (let i = 1; i < starts.length; i++) expect(starts[i]).toBeGreaterThan(starts[i - 1]);
  });

  it('says so when the sound cannot be loaded, and plays nothing', async () => {
    const { show, voice } = setup();
    vi.mocked(voice.ready).mockResolvedValue(false);
    show(0, 'major');
    $('.sc-hear').click();
    await flush();
    expect(voice.play).not.toHaveBeenCalled();
    expect($('.sc-status').textContent).toMatch(/could not be loaded/);
  });

  it('stops the sound when another scale is shown', () => {
    const { show, voice } = setup();
    show(0, 'major');
    show(2, 'major');
    expect(voice.stopAll).toHaveBeenCalled();
  });
});

describe('ScalePanel: playing along', () => {
  it('marks the key to play next, and moves on with each right key', () => {
    const { show, panel } = setup();
    show(0, 'major');
    $('.sc-along').click();
    expect(panel.current().along).toBe(true);
    expect($('.sc-along').getAttribute('aria-pressed')).toBe('true');
    expect($('.lk-key.next-key').getAttribute('data-note')).toBe('C4');
    press('C4');
    expect($('.lk-key.next-key').getAttribute('data-note')).toBe('D4');
  });

  it('says when a wrong key was played, and tells the practice memory which note was asked', () => {
    const { show, deps } = setup();
    show(0, 'major');
    $('.sc-along').click();
    press('D4');
    expect($('.sc-status').dataset.tone).toBe('bad');
    expect(deps.onAnswer).toHaveBeenCalledWith('C4', false);
    expect($('.lk-key.next-key').getAttribute('data-note')).toBe('C4');
  });

  it('tells the practice memory about a right key, with the note as the scale writes it', () => {
    const { show, deps } = setup();
    show(1, 'major'); // D flat major
    $('.sc-along').click();
    press('C#4');
    expect(deps.onAnswer).toHaveBeenCalledWith('Db4', true);
  });

  it('is done when every note has been played: it says so, and tells the game', () => {
    const { show, deps, panel } = setup();
    show(0, 'pentatonic-major');
    $('.sc-along').click();
    for (const note of ['C4', 'D4', 'E4', 'G4', 'A4', 'C5']) press(note);
    expect($('.sc-status').dataset.tone).toBe('good');
    expect(deps.onPlayed).toHaveBeenCalledTimes(1);
    expect(panel.current().along).toBe(false);
    expect($('.sc-along').getAttribute('aria-pressed')).toBe('false');
  });

  it('asks for the key of the letter when the note is a quarter tone, and it is not wrong to press it', () => {
    const { show, deps } = setup();
    show('D', 'shur');
    $('.sc-along').click();
    press('D4');
    press('E4'); // Ek4 is on the key of E
    expect(deps.onAnswer).toHaveBeenLastCalledWith('Ek4', true);
    expect($('.lk-key.next-key').getAttribute('data-note')).toBe('F4');
  });

  it('can be stopped, and is stopped by showing another scale', () => {
    const { show, panel } = setup();
    show(0, 'major');
    $('.sc-along').click();
    $('.sc-along').click();
    expect(panel.current().along).toBe(false);
    $('.sc-along').click();
    show(2, 'major');
    expect(panel.current().along).toBe(false);
  });

  it('takes a key from a MIDI keyboard too, but only while the panel is open', () => {
    const { show, panel, deps } = setup();
    show(0, 'major');
    $('.sc-along').click();
    panel.deactivate();
    panel.keyPressed('C4');
    expect(deps.onAnswer).not.toHaveBeenCalled();
    panel.activate();
    show(0, 'major');
    $('.sc-along').click();
    panel.keyPressed('C4');
    expect(deps.onAnswer).toHaveBeenCalledWith('C4', true);
  });

  it('does nothing for a key pressed when the scale is not being played along', () => {
    const { show, deps } = setup();
    show(0, 'major');
    press('D4');
    expect(deps.onAnswer).not.toHaveBeenCalled();
  });
});
