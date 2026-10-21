import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { seededRng } from '../core/rng';
import { initLocale, setLocale, setPersianDigits } from '../i18n';
import { NoteStats } from '../learn/noteStats';
import { PersianView, type PersianViewDeps } from '../persian/persianView';

function setup(overrides: Partial<PersianViewDeps> = {}, ready = true) {
  vi.useFakeTimers();
  const voice = { ready: vi.fn(async () => ready), play: vi.fn(), stopAll: vi.fn() };
  const data = new Map<string, string>();
  const stats = new NoteStats({ getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) }, 'persian.stats.v1');
  const deps: PersianViewDeps = {
    voice,
    stats,
    formatName: (note) => note.replace('#', '♯').replace(/(?<=[A-G])b/, '♭'),
    openScale: vi.fn(),
    openLessons: vi.fn(),
    onBack: vi.fn(),
    onAnswer: vi.fn(),
    random: seededRng(2),
    ...overrides,
  };
  const view = new PersianView(deps);
  document.body.replaceChildren(view.element);
  view.activate();
  const flush = async () => {
    for (let i = 0; i < 12; i++) await Promise.resolve();
  };
  return { view, deps, voice, stats, flush };
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

describe('the Persian music page: the modes', () => {
  it('has a card for each of the twelve modes, with its root and what it is', () => {
    setup();
    const cards = all('.pr-mode');
    expect(cards).toHaveLength(12);
    const shur = $('.pr-mode[data-scale="shur"]');
    expect(shur.querySelector('.pr-mode-name')!.textContent).toBe('Shur');
    expect(shur.querySelector('.pr-mode-root')!.textContent).toBe('D');
    expect(shur.querySelector('.pr-mode-kind')!.textContent).toBe('Dastgah');
    expect($('.pr-mode[data-scale="segah"] .pr-mode-root').textContent).toBe('E koron'.replace(' koron', 'k'));
    expect($('.pr-mode[data-scale="afshari"] .pr-mode-kind').textContent).toBe('Avaz of Shur');
    expect($('.pr-mode[data-scale="bayat-esfahan"] .pr-mode-kind').textContent).toBe('Avaz of Homayun');
  });

  it('opens a mode in the dictionary on its usual root, and the lessons', () => {
    const { deps } = setup();
    $('.pr-mode[data-scale="shur"]').click();
    expect(deps.openScale).toHaveBeenCalledWith('D', 'shur');
    $('.pr-mode[data-scale="segah"]').click();
    expect(deps.openScale).toHaveBeenLastCalledWith('Ek', 'segah');
    $('.pr-lessons').click();
    expect(deps.openLessons).toHaveBeenCalled();
  });

  it('says that the pitches are a model', () => {
    setup();
    expect($('.pr-draft').textContent).toMatch(/approximate model/);
  });
});

describe('the Persian music page: ear training', () => {
  it('asks a question of the first stage, plays it and offers two answers', async () => {
    const { view, voice, flush } = setup();
    await flush();
    const q = view.current().question!;
    expect(q.kind).toBe('order');
    expect($('.pr-prompt').textContent).toBe('Two notes. Which one is lower?');
    expect(all('.pr-choice').map((b) => b.textContent)).toEqual(['The first', 'The second']);
    expect(voice.play).not.toHaveBeenCalled(); // the first question waits to be heard
    $('.pr-hear').click();
    await flush();
    expect(voice.play.mock.calls.map((c) => c[0])).toEqual(q.plan.map((s) => s.note));
  });

  it('says "Right!", counts it and asks the next one', async () => {
    const onAnswer = vi.fn();
    const { view, stats } = setup({ onAnswer });
    const q = view.current().question!;
    $(`.pr-choice[data-answer="${q.answer}"]`).click();
    expect($('.pr-status').textContent).toBe('Right!');
    expect($('.pr-status').dataset.tone).toBe('good');
    expect(onAnswer).toHaveBeenCalledWith(true);
    expect(stats.recent(1)).toMatchObject({ answered: 1, accuracy: 1 });
    expect(all('.pr-choice').every((b) => (b as HTMLButtonElement).disabled)).toBe(true);
    vi.advanceTimersByTime(1500);
    expect(view.current().question!.key).not.toBe(q.key);
    expect($('.pr-status').textContent).toBe('');
  });

  it('names the answer after a wrong one and waits for Next', () => {
    const onAnswer = vi.fn();
    const { view } = setup({ onAnswer });
    const q = view.current().question!;
    const wrong = q.choices.find((c) => c !== q.answer)!;
    $(`.pr-choice[data-answer="${wrong}"]`).click();
    expect(onAnswer).toHaveBeenCalledWith(false);
    expect($('.pr-status').dataset.tone).toBe('bad');
    expect($('.pr-status').textContent).toMatch(/^Not this time\. The answer is: /);
    expect($<HTMLButtonElement>('.pr-next').hidden).toBe(false);
    vi.advanceTimersByTime(3000);
    expect(view.current().question).toBe(q);
    $('.pr-next').click();
    expect(view.current().question).not.toBe(q);
  });

  it('opens only the first stage, and the next after twenty right answers', () => {
    const { view } = setup();
    expect(all('.pr-stages [data-stage]').map((b) => (b as HTMLButtonElement).disabled)).toEqual([false, true, true, true]);
    for (let i = 0; i < 20; i++) {
      $(`.pr-choice[data-answer="${view.current().question!.answer}"]`).click();
      vi.advanceTimersByTime(1500);
    }
    expect(($('.pr-stages [data-stage="2"]') as HTMLButtonElement).disabled).toBe(false);
    $('.pr-stages [data-stage="2"]').click();
    expect(view.current().question!.kind).toBe('koronOrFlat');
    expect(all('.pr-choice').map((b) => b.textContent)).toEqual(['Koron', 'Flat']);
  });

  it('says so when the piano cannot be loaded', async () => {
    const { flush } = setup({}, false);
    $('.pr-hear').click();
    await flush();
    expect($('.pr-status').textContent).toBe('The piano sounds could not be loaded, so there is nothing to listen to.');
  });

  it('stops the sound when the page is left', () => {
    const { view, voice } = setup();
    view.deactivate();
    expect(voice.stopAll).toHaveBeenCalled();
  });
});

describe('the Persian music page: language', () => {
  it('is in Persian, with Persian digits', () => {
    setLocale('fa');
    setPersianDigits(true);
    const { view } = setup();
    view.refresh();
    expect($('.view-title').textContent).toBe('موسیقی ایرانی');
    expect($('.pr-stages [data-stage="1"]').textContent).toBe('مرحله‌ی ۱');
    expect($('.pr-mode[data-scale="shur"] .pr-mode-name').textContent).toBe('دستگاه شور');
    expect($('.pr-mode-root').getAttribute('dir')).toBe('ltr');
  });
});
