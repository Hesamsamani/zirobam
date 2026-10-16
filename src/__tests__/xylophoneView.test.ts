import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import { initLocale, setLocale } from '../i18n';
import { NoteInputHub } from '../input/noteInput';
import { NoteStats } from '../learn/noteStats';
import type { Clef } from '../learn/nameTheNote';
import { XylophoneView } from '../xylophone/xylophoneView';
import { BUILT_IN_SONGS, getSongById } from '../songs';
import { formatNoteName } from '../i18n/noteNames';

function fakeStorage() {
  const data: Record<string, string> = {};
  return {
    getItem: (k: string) => (k in data ? data[k] : null),
    setItem: (k: string, v: string) => {
      data[k] = v;
    },
  };
}

function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

type RenderNote = (pitch: string, clef: Clef, into: HTMLElement) => void;

let hub: NoteInputHub;
let sound: { play: Mock<(note: string) => void> };
let renderNote: Mock<RenderNote>;
let stats: NoteStats;
let view: XylophoneView;
let backed: number;
let readAnswers: Array<[boolean, string]>;
let finished: Array<[string, number, number]>;

const q = <T extends Element>(sel: string) => view.element.querySelector(sel) as T;
const qa = <T extends Element>(sel: string) => Array.from(view.element.querySelectorAll(sel)) as T[];
const bar = (note: string) => q<HTMLButtonElement>(`.xylo-bar[data-note="${note}"]`);
const pitch = () => view.element.dataset.pitch!;
const wrongPitch = () => (pitch() === 'C4' ? 'D4' : 'C4');
const press = (code: string) => document.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true, cancelable: true }));
const release = (code: string) => document.dispatchEvent(new KeyboardEvent('keyup', { code, bubbles: true }));
const pointer = (el: Element, type: 'pointerdown' | 'pointerup') =>
  el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true }));
const setMode = (mode: string) => q<HTMLButtonElement>(`[data-mode="${mode}"]`).click();

function build(options: { songs?: typeof BUILT_IN_SONGS } = {}) {
  view = new XylophoneView({
    hub,
    sound,
    stats,
    songs: options.songs ?? BUILT_IN_SONGS,
    renderNote,
    formatName: (n) => formatNoteName(n, 'letters'),
    onBack: () => backed++,
    rng: seeded(3),
    autoAdvanceMs: 500,
    onReadAnswer: (correct, p) => readAnswers.push([correct, p]),
    onSongFinished: (id, stars, mistakes) => finished.push([id, stars, mistakes]),
  });
  document.body.appendChild(view.element);
  view.activate();
}

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  initLocale();
  hub = new NoteInputHub();
  sound = { play: vi.fn<(note: string) => void>() };
  renderNote = vi.fn<RenderNote>();
  stats = new NoteStats(fakeStorage(), 'xyloStats.v1');
  backed = 0;
  readAnswers = [];
  finished = [];
  build();
});

afterEach(() => {
  view.deactivate();
  view.dispose();
  document.body.replaceChildren();
  vi.useRealTimers();
});

describe('screen', () => {
  it('is the xylophone section with a back button', () => {
    expect(view.element.id).toBe('xylophoneView');
    expect(view.element.dataset.views).toBe('xylophone');
    q<HTMLButtonElement>('.back-btn').click();
    expect(backed).toBe(1);
  });

  it('starts in free play on the home row', () => {
    expect(view.element.dataset.mode).toBe('free');
    expect(q('[data-row="home"]').getAttribute('aria-pressed')).toBe('true');
    expect(q('[data-octave="4"]').getAttribute('aria-pressed')).toBe('true');
  });
});

describe('bars', () => {
  it('has one bar per key of the home row, C major from C4, always left to right', () => {
    expect(qa('.xylo-bar').map((b) => (b as HTMLElement).dataset.note)).toEqual([
      'C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5', 'D5', 'E5', 'F5',
    ]);
    expect(q('.xylo-bars').getAttribute('dir')).toBe('ltr');
    expect(qa('.xylo-bar-key').map((k) => k.textContent).join('')).toBe("ASDFGHJKL;'");
  });

  it('names each bar in the chosen system and gives it an accessible name', () => {
    expect(bar('E4').querySelector('.xylo-bar-name')!.textContent).toBe('E');
    expect(bar('E4').getAttribute('aria-label')).toBe('Bar E, key D');
  });

  it('gets shorter from left to right', () => {
    const heights = qa<HTMLElement>('.xylo-bar').map((b) => Number(b.style.getPropertyValue('--bar-height').replace('px', '')));
    expect(heights.every((h, i) => i === 0 || h < heights[i - 1])).toBe(true);
  });

  it('switches to another row of keys', () => {
    q<HTMLButtonElement>('[data-row="top"]').click();
    expect(qa('.xylo-bar')).toHaveLength(12);
    expect(qa('.xylo-bar-key').map((k) => k.textContent).join('')).toBe('QWERTYUIOP[]');
    press('KeyQ');
    expect(sound.play).toHaveBeenCalledWith('C4');
    sound.play.mockClear();
    press('KeyA'); // no longer a bar
    expect(sound.play).not.toHaveBeenCalled();
  });

  it('starts the bars an octave higher on request', () => {
    q<HTMLButtonElement>('[data-octave="5"]').click();
    expect(bar('C5')).not.toBeNull();
    expect(q('.xylo-bar').getAttribute('data-note')).toBe('C5');
    expect(q('[data-octave="5"]').getAttribute('aria-pressed')).toBe('true');
  });

  it('can hide the note names', () => {
    const names = q<HTMLInputElement>('[data-option="names"]');
    expect(names.checked).toBe(true);
    names.click();
    expect(view.element.classList.contains('hide-names')).toBe(true);
  });
});

describe('playing', () => {
  it('sounds and lights the bar for a key press, and lets go on key up', () => {
    press('KeyD');
    expect(sound.play).toHaveBeenCalledWith('E4');
    expect(bar('E4').dataset.active).toBe('true');
    release('KeyD');
    expect(bar('E4').dataset.active).toBeUndefined();
  });

  it('sounds and lights the bar for a click or a touch', () => {
    pointer(bar('G4'), 'pointerdown');
    expect(sound.play).toHaveBeenCalledWith('G4');
    expect(bar('G4').dataset.active).toBe('true');
    pointer(bar('G4'), 'pointerup');
    expect(bar('G4').dataset.active).toBeUndefined();
  });

  it('lights a bar for a note from a MIDI keyboard without playing its own sound', () => {
    hub.noteOn('C4', 'midi');
    expect(bar('C4').dataset.active).toBe('true');
    expect(sound.play).not.toHaveBeenCalled();
    hub.noteOff('C4', 'midi');
    expect(bar('C4').dataset.active).toBeUndefined();
  });

  it('is silent while the screen is not open', () => {
    view.deactivate();
    press('KeyA');
    hub.noteOn('C4', 'xylophone');
    expect(sound.play).not.toHaveBeenCalled();
    view.activate();
    press('KeyA');
    expect(sound.play).toHaveBeenCalledTimes(1);
  });
});

describe('settings are remembered', () => {
  it('saves the row, octave, mode and options and restores them in a new view', () => {
    q<HTMLButtonElement>('[data-row="bottom"]').click();
    q<HTMLButtonElement>('[data-octave="5"]').click();
    q<HTMLInputElement>('[data-option="names"]').click();
    setMode('read');
    view.deactivate();
    view.dispose();
    document.body.replaceChildren();
    build();
    expect(q('[data-row="bottom"]').getAttribute('aria-pressed')).toBe('true');
    expect(q('.xylo-bar').getAttribute('data-note')).toBe('C5');
    expect(view.element.dataset.mode).toBe('read');
    expect(view.element.classList.contains('hide-names')).toBe(true);
  });

  it('falls back to the defaults for damaged saved values', () => {
    view.deactivate();
    view.dispose();
    document.body.replaceChildren();
    localStorage.setItem('xylo.row', 'diagonal');
    localStorage.setItem('xylo.octave', '99');
    localStorage.setItem('xylo.mode', 'chaos');
    build();
    expect(q('[data-row="home"]').getAttribute('aria-pressed')).toBe('true');
    expect(q('.xylo-bar').getAttribute('data-note')).toBe('C4');
    expect(view.element.dataset.mode).toBe('free');
  });
});

describe('free play', () => {
  it('shows a tip and no staff', () => {
    expect(q('.xylo-tip').hasAttribute('hidden')).toBe(false);
    expect(q('.xylo-card').hasAttribute('hidden')).toBe(true);
    expect(renderNote).not.toHaveBeenCalled();
  });
});

describe('read and play', () => {
  beforeEach(() => setMode('read'));

  it('draws a note that has a bar', () => {
    expect(q('.xylo-card').hasAttribute('hidden')).toBe(false);
    expect(renderNote).toHaveBeenCalledTimes(1);
    const [drawn, clef] = renderNote.mock.calls[0];
    expect(drawn).toBe(pitch());
    expect(clef).toBe('treble');
    expect(qa<HTMLElement>('.xylo-bar').map((b) => b.dataset.note)).toContain(pitch());
  });

  it('marks a right answer, tells the app and asks the next note after a moment', () => {
    const asked = pitch();
    press(['KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyG', 'KeyH', 'KeyJ', 'KeyK', 'KeyL', 'Semicolon', 'Quote'][
      ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5', 'D5', 'E5', 'F5'].indexOf(asked)
    ]);
    expect(view.element.dataset.result).toBe('correct');
    expect(readAnswers).toEqual([[true, asked]]);
    expect(stats.get(asked)).toMatchObject({ seen: 1, correct: 1 });
    vi.advanceTimersByTime(500);
    expect(view.element.dataset.result).toBeUndefined();
    expect(pitch()).not.toBe(asked);
  });

  it('marks a wrong answer, shows which bar was right, and then moves on', () => {
    const asked = pitch();
    const wrong = wrongPitch();
    hub.noteOn(wrong, 'screen');
    expect(view.element.dataset.result).toBe('wrong');
    expect(readAnswers).toEqual([[false, asked]]);
    expect(bar(asked).dataset.hint).toBe('true');
    expect(q('.xylo-feedback').textContent).toContain(asked[0]);
    vi.advanceTimersByTime(5000);
    expect(view.element.dataset.result).toBeUndefined();
  });

  it('counts only the first note played for each question', () => {
    const asked = pitch();
    hub.noteOn(wrongPitch(), 'screen');
    hub.noteOn(asked, 'screen');
    expect(readAnswers).toHaveLength(1);
    expect(view.element.dataset.result).toBe('wrong');
  });

  it('accepts the answer from a MIDI keyboard too', () => {
    hub.noteOn(pitch(), 'midi');
    expect(view.element.dataset.result).toBe('correct');
  });

  it('shows the streak of right answers', () => {
    for (let i = 0; i < 2; i++) {
      hub.noteOn(pitch(), 'screen');
      vi.advanceTimersByTime(500);
    }
    expect(q('.xylo-progress').textContent).toContain('2');
  });

  it('only highlights the bar to play when the hint is on', () => {
    expect(qa('.xylo-bar[data-hint="true"]')).toHaveLength(0);
    const hint = q<HTMLInputElement>('[data-option="hints"]');
    hint.click();
    expect(bar(pitch()).dataset.hint).toBe('true');
    hint.click();
    expect(qa('.xylo-bar[data-hint="true"]')).toHaveLength(0);
  });

  it('chooses notes from the bars of the new row after a row change', () => {
    q<HTMLButtonElement>('[data-row="bottom"]').click();
    const names = qa<HTMLElement>('.xylo-bar').map((b) => b.dataset.note);
    for (let i = 0; i < 15; i++) {
      expect(names).toContain(pitch());
      hub.noteOn(pitch(), 'screen');
      vi.advanceTimersByTime(500);
    }
  });
});

describe('play a song', () => {
  beforeEach(() => setMode('song'));

  const songNotes = (id: string) => {
    const melody: string[] = [];
    const doc = new DOMParser().parseFromString(getSongById(id)!.xml, 'text/xml');
    for (const note of Array.from(doc.getElementsByTagName('note'))) {
      if (note.getElementsByTagName('rest').length || note.getElementsByTagName('staff')[0]?.textContent === '2') continue;
      melody.push(note.getElementsByTagName('step')[0].textContent! + note.getElementsByTagName('octave')[0].textContent!);
    }
    return melody;
  };

  it('offers the songs that fit the row and starts the first one', () => {
    const ids = qa<HTMLElement>('.xylo-songs [data-song]').map((b) => b.dataset.song);
    expect(ids).toEqual(expect.arrayContaining(['mary-lamb', 'twinkle', 'ode-to-joy']));
    expect(ids).not.toContain('minuet-g');
    expect(q('.xylo-progress').textContent).toContain('1');
    expect(renderNote).toHaveBeenCalled();
    expect(pitch()).toBe(songNotes(ids[0]!)[0]);
  });

  it('moves to the next note when the right bar is hit', () => {
    const notes = songNotes('mary-lamb');
    q<HTMLButtonElement>('[data-song="mary-lamb"]').click();
    expect(pitch()).toBe(notes[0]);
    hub.noteOn(notes[0], 'screen');
    expect(pitch()).toBe(notes[1]);
  });

  it('counts a wrong bar as a mistake and stays on the note', () => {
    q<HTMLButtonElement>('[data-song="mary-lamb"]').click();
    const first = pitch();
    hub.noteOn(first === 'B4' ? 'C4' : 'B4', 'screen');
    expect(pitch()).toBe(first);
    expect(q('.xylo-progress').textContent).toContain('1');
    expect(q('.xylo-feedback').textContent).not.toBe('');
  });

  it('highlights the next bar only with the hint on', () => {
    q<HTMLButtonElement>('[data-song="mary-lamb"]').click();
    expect(qa('.xylo-bar[data-hint="true"]')).toHaveLength(0);
    q<HTMLInputElement>('[data-option="hints"]').click();
    expect(bar(pitch()).dataset.hint).toBe('true');
  });

  it('finishes with stars and calls the app', () => {
    q<HTMLButtonElement>('[data-song="mary-lamb"]').click();
    const notes = songNotes('mary-lamb');
    for (const note of notes) hub.noteOn(note, 'screen');
    expect(view.element.dataset.result).toBe('done');
    expect(finished).toEqual([['mary-lamb', 3, 0]]);
    expect(qa('.xylo-stars .star.on')).toHaveLength(3);
    expect(q('.xylo-stars').getAttribute('aria-label')).toBe('3 of 3 stars');
    expect(q('.xylo-again').hasAttribute('hidden')).toBe(false);
  });

  it('gives fewer stars after many mistakes', () => {
    q<HTMLButtonElement>('[data-song="mary-lamb"]').click();
    const notes = songNotes('mary-lamb');
    for (let i = 0; i < 15; i++) hub.noteOn('B4', 'screen');
    for (const note of notes) hub.noteOn(note, 'screen');
    expect(finished).toHaveLength(1);
    expect(finished[0][1]).toBe(1);
    expect(finished[0][2]).toBe(15);
  });

  it('can play the same song again', () => {
    q<HTMLButtonElement>('[data-song="mary-lamb"]').click();
    for (const note of songNotes('mary-lamb')) hub.noteOn(note, 'screen');
    q<HTMLButtonElement>('.xylo-again').click();
    expect(view.element.dataset.result).toBeUndefined();
    expect(pitch()).toBe(songNotes('mary-lamb')[0]);
    expect(q('.xylo-again').hasAttribute('hidden')).toBe(true);
  });

  it('says so when no song fits the row', () => {
    view.deactivate();
    view.dispose();
    document.body.replaceChildren();
    build({ songs: BUILT_IN_SONGS.filter((s) => s.id === 'minuet-g') });
    setMode('song');
    expect(qa('.xylo-songs [data-song]')).toHaveLength(0);
    expect(q('.xylo-feedback').textContent).not.toBe('');
  });
});

describe('language', () => {
  it('writes the texts again in Persian', () => {
    setLocale('fa');
    view.refresh();
    expect(q('h2').textContent).toBe('زایلوفون');
    expect(q('[data-mode="read"]').textContent).toBe('بخوان و بنواز');
    expect(q('.back-btn').textContent).toContain('بازگشت');
  });
});
