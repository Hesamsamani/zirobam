import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { seededRng } from '../core/rng';
import { ChordsView, type ChordsViewDeps } from '../chords/chordsView';
import { initLocale, setLocale, setPersianDigits } from '../i18n';
import { NoteInputHub } from '../input/noteInput';
import { NoteStats } from '../learn/noteStats';
import { ascendFrom } from '../theory/spell';

function setup(overrides: Partial<ChordsViewDeps> = {}) {
  vi.useFakeTimers();
  const hub = new NoteInputHub();
  const data = new Map<string, string>();
  const stats = new NoteStats({ getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) }, 'chords.stats.v1');
  const onAnswer = vi.fn();
  const deps: ChordsViewDeps = {
    hub,
    formatName: (note) => note.replace('#', '♯').replace(/(?<=[A-G])b/, '♭'),
    stats,
    onBack: vi.fn(),
    onAnswer,
    random: seededRng(1),
    ...overrides,
  };
  const view = new ChordsView(deps);
  document.body.replaceChildren(view.element);
  view.activate();
  const press = (...notes: string[]) => notes.forEach((noteName) => hub.onNoteOn.emit({ noteName, source: 'midi' }));
  const release = (...notes: string[]) => notes.forEach((noteName) => hub.onNoteOff.emit({ noteName, source: 'midi' }));
  const settle = () => vi.advanceTimersByTime(200);
  return { view, hub, stats, onAnswer, press, release, settle, deps };
}

const $ = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector)!;
const all = <T extends HTMLElement>(selector: string) => Array.from(document.querySelectorAll<T>(selector));

beforeEach(() => {
  initLocale();
  setLocale('en');
  setPersianDigits(false);
});
afterEach(() => {
  vi.useRealTimers();
  document.body.replaceChildren();
});

describe('the chord reader: naming a chord', () => {
  it('has two tabs and asks for three keys at the start', () => {
    setup();
    expect(all('.ch-tabs .sc-tab').map((b) => b.textContent)).toEqual(['Name my chord', 'Quiz']);
    expect($('.ch-kind').textContent).toBe('Press three or more keys together.');
    expect($('.ch-name').textContent).toBe('');
  });

  it('names the chord once the keys have stopped moving, with its kind and notes', () => {
    const { press, settle } = setup();
    press('C4', 'E4', 'G4');
    expect($('.ch-name').textContent).toBe('');
    settle();
    expect($('.ch-name').textContent).toBe('C');
    expect($('.ch-kind').textContent).toBe('Major');
    expect($('.ch-notes').textContent).toBe('Notes: C E G');
  });

  it('writes the name with the notes as the student reads them, and names a turn by its bass', () => {
    const { press, release, settle } = setup();
    press('Bb3', 'D4', 'F4');
    settle();
    expect($('.ch-name').textContent).toBe('B♭');
    release('Bb3', 'D4', 'F4');
    press('D4', 'F4', 'Bb4');
    settle();
    expect($('.ch-name').textContent).toBe('B♭/D');
  });

  it('marks the keys that are down on the keyboard picture', () => {
    const { press } = setup();
    press('C4', 'E4');
    expect(all('.ch-keys .lk-key.marked').map((k) => k.dataset.note)).toEqual(['C4', 'E4']);
  });

  it('says so when the notes make no chord, and keeps the last chord when the keys are let go', () => {
    const { press, release, settle } = setup();
    press('C4', 'C#4', 'D4');
    settle();
    expect($('.ch-kind').textContent).toBe('These notes do not make a chord in the dictionary.');
    release('C4', 'C#4', 'D4');
    press('A3', 'C4', 'E4');
    settle();
    expect($('.ch-name').textContent).toBe('Am');
    release('A3', 'C4', 'E4');
    settle();
    expect($('.ch-name').textContent).toBe('Am');
  });

  it('does not listen while the screen is not shown', () => {
    const { view, press, settle } = setup();
    view.deactivate();
    press('C4', 'E4', 'G4');
    settle();
    expect($('.ch-name').textContent).toBe('');
  });
});

describe('the chord reader: the quiz', () => {
  function toQuiz(overrides: Partial<ChordsViewDeps> = {}) {
    const s = setup(overrides);
    $('.ch-tabs [data-tab="quiz"]').click();
    const q = () => s.view.current().question!;
    const play = () => ascendFrom(q().notes, 4);
    return { ...s, q, play };
  }

  it('asks for a chord of the first stage and shows its name', () => {
    const { q } = toQuiz();
    expect(['major', 'minor']).toContain(q().def.id);
    expect($('.ch-target').textContent).toBe(`${q().root.replace('#', '♯').replace(/(?<=[A-G])b/, '♭')}${q().def.symbol}`);
    expect($('.ch-ask').textContent).toBe('Play this chord');
    expect(all('.ch-stages [data-stage]').map((b) => (b as HTMLButtonElement).disabled)).toEqual([false, true, true, true, true]);
  });

  it('says "Right!" for the right chord, counts it, and asks the next one', () => {
    const { press, settle, q, play, onAnswer, stats } = toQuiz();
    const first = q().symbol;
    press(...play());
    settle();
    expect($('.ch-status').textContent).toBe('Right!');
    expect($('.ch-status').dataset.tone).toBe('good');
    expect(onAnswer).toHaveBeenCalledWith(true, expect.objectContaining({ symbol: first }));
    expect(stats.recent(1)).toMatchObject({ answered: 1, accuracy: 1 });
    vi.advanceTimersByTime(1200);
    expect(q().symbol).not.toBe(first);
    expect($('.ch-status').textContent).toBe('');
  });

  it('shows the notes after a wrong chord, and goes on when asked', () => {
    const { press, settle, q, onAnswer, stats } = toQuiz();
    const first = q();
    // three notes that are not the chord
    press('C#4', 'F4', 'A4');
    settle();
    expect(onAnswer).toHaveBeenCalledWith(false, expect.objectContaining({ symbol: first.symbol }));
    expect($('.ch-status').dataset.tone).toBe('bad');
    expect($('.ch-status').textContent).toMatch(/^Not quite\. The notes are /);
    expect(stats.recent(1).accuracy).toBe(0);
    expect(all('.ch-keys .lk-key.marked').length).toBeGreaterThanOrEqual(first.notes.length);
    expect($<HTMLButtonElement>('.ch-next').hidden).toBe(false);
    $('.ch-next').click();
    expect($('.ch-status').textContent).toBe('');
  });

  it('waits while the hand is still arriving: one key of three is no answer', () => {
    const { press, settle, play, onAnswer } = toQuiz();
    const notes = play();
    press(notes[0]);
    settle();
    expect(onAnswer).not.toHaveBeenCalled();
    expect($('.ch-status').textContent).toBe('');
    press(...notes.slice(1));
    settle();
    expect(onAnswer).toHaveBeenCalledTimes(1);
  });

  it('counts the first answer only', () => {
    const { press, release, settle, play, onAnswer } = toQuiz();
    press('C#4', 'F4', 'A4');
    settle();
    release('C#4', 'F4', 'A4');
    press(...play());
    settle();
    expect(onAnswer).toHaveBeenCalledTimes(1);
  });

  it('shows the notes when asked', () => {
    const { q } = toQuiz();
    $('.ch-show').click();
    expect(all('.ch-keys .lk-key.marked').length).toBe(q().notes.length);
  });

  it('opens the next stage after twenty answers that are almost all right', () => {
    const { press, release, settle, play, view } = toQuiz();
    let last: string[] = [];
    for (let i = 0; i < 20; i++) {
      release(...last);
      last = play();
      press(...last);
      settle();
      vi.advanceTimersByTime(1200);
    }
    expect(all('.ch-stages [data-stage="2"]')[0].hasAttribute('disabled')).toBe(false);
    expect(view.current().stage).toBe(1);
    $('.ch-stages [data-stage="2"]').click();
    expect(view.current().stage).toBe(2);
  });
});

describe('the chord reader: language', () => {
  it('is in Persian, with the chord name and the keys left to right', () => {
    setLocale('fa');
    setPersianDigits(true);
    const { view, press, settle } = setup();
    view.refresh();
    expect($('.view-title').textContent).toBe('آکوردخوان');
    expect(all('.ch-tabs .sc-tab').map((b) => b.textContent)).toEqual(['نام آکوردم', 'آزمون']);
    press('C4', 'E4', 'G4');
    settle();
    expect($('.ch-name').getAttribute('dir')).toBe('ltr');
    expect($('.ch-keys').getAttribute('dir')).toBe('ltr');
    expect($('.ch-kind').textContent).not.toBe('');
  });
});
