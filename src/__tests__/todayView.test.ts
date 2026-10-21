import { beforeEach, describe, expect, it, vi } from 'vitest';
import { initLocale, setLocale, setPersianDigits } from '../i18n';
import { MainMenu } from '../menu/mainMenu';
import { buildTodayPlan } from '../today/planner';
import { TodayStore } from '../today/todayStore';
import { TodayView } from '../today/todayView';

const quiet = { total: 0, hits: 0, early: 0, late: 0, missed: 0, lean: 'none' as const };

function setup(dueKeys: string[] = ['note:C4', 'note:Bb3'], dayIndex = 0) {
  const data = new Map<string, string>();
  const store = new TodayStore(() => buildTodayPlan({ dueKeys, rhythm: quiet, dayIndex }), { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) }, () => '2026-10-21');
  const open = vi.fn();
  const onAllDone = vi.fn();
  const view = new TodayView({ store, open, onAllDone, onBack: vi.fn() });
  document.body.replaceChildren(view.element);
  return { store, view, open, onAllDone };
}

const $ = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector)!;
const all = <T extends HTMLElement>(selector: string) => Array.from(document.querySelectorAll<T>(selector));

beforeEach(() => {
  initLocale();
  setLocale('en');
  setPersianDigits(false);
  document.body.replaceChildren();
});

describe('the Today screen', () => {
  it('lists the blocks of the plan with their time and the reason, and how much is done', () => {
    setup();
    expect($('.view-title').textContent).toBe('Today');
    expect($('.view-subtitle').textContent).toBe('A short plan for today, made from what you practised: about 7 minutes.');
    expect(all('.td-block').map((li) => li.dataset.kind)).toEqual(['notes', 'levels', 'scales']);
    const first = $('.td-block[data-kind="notes"]');
    expect(first.querySelector('.td-name')!.textContent).toBe('Note quiz');
    expect(first.querySelector('.td-minutes')!.textContent).toBe('2 min');
    expect(first.querySelector('.td-reason')!.textContent).toBe('2 to go over again, as the practice memory says.');
    expect($('.td-block[data-kind="levels"] .td-reason').textContent).toBe('Reading and playing is the heart of practice.');
    expect($('.td-progress').textContent).toBe('0 of 3 done');
  });

  it('opens the screen a block is about', () => {
    const { open } = setup();
    $('.td-block[data-kind="notes"] .td-start').click();
    expect(open).toHaveBeenCalledWith('notes');
    $('.td-block[data-kind="levels"] .td-start').click();
    expect(open).toHaveBeenLastCalledWith('levels');
  });

  it('ticks a block off and takes it off again, and says when it is all done, once', () => {
    const { onAllDone, store } = setup();
    $('.td-block[data-kind="notes"] .td-done').click();
    expect($('.td-block[data-kind="notes"]').dataset.done).toBe('true');
    expect($('.td-progress').textContent).toBe('1 of 3 done');
    expect($('.td-block[data-kind="notes"] .td-done').textContent).toBe('Not done');
    $('.td-block[data-kind="notes"] .td-done').click();
    expect(store.progress().done).toBe(0);
    for (const kind of ['notes', 'levels', 'scales']) $(`.td-block[data-kind="${kind}"] .td-done`).click();
    expect(onAllDone).toHaveBeenCalledTimes(1);
    expect($('.td-all').textContent).toBe('All done for today. Well done!');
  });

  it('makes another plan when asked', () => {
    const { store } = setup();
    $('.td-block[data-kind="levels"] .td-done').click();
    $('.td-remake').click();
    expect(store.progress().done).toBe(0);
  });

  it('is in Persian, with Persian digits', () => {
    setLocale('fa');
    setPersianDigits(true);
    setup();
    expect($('.view-title').textContent).toBe('امروز');
    expect($('.td-progress').textContent).toBe('۰ از ۳ انجام شد');
    expect($('.td-block[data-kind="notes"] .td-minutes').textContent).toBe('۲ دقیقه');
  });
});

describe('the card on the home screen', () => {
  function home(today?: () => { done: number; total: number; minutes: number }) {
    const navigate = vi.fn();
    const menu = new MainMenu({
      navigate,
      openSettings: () => undefined,
      openMetronome: () => undefined,
      levelLabel: () => '1a',
      resume: () => ({ view: 'levels', title: 'Level 1a', detail: 'Continue' }),
      today,
    });
    document.body.replaceChildren(menu.element);
    return { menu, navigate };
  }

  it('shows how far the plan is above the Continue card, and opens it', () => {
    const { navigate } = home(() => ({ done: 1, total: 3, minutes: 7 }));
    const card = $('.menu-today');
    expect(card.querySelector('.menu-today-title')!.textContent).toBe('Today: 1 of 3 done');
    expect(card.querySelector('.menu-today-detail')!.textContent).toBe('Your plan of about 7 minutes');
    expect(card.nextElementSibling).toBe($('.menu-resume'));
    card.click();
    expect(navigate).toHaveBeenCalledWith('today');
  });

  it('is not a tile, and has no card when there is no plan', () => {
    home(() => ({ done: 0, total: 2, minutes: 5 }));
    expect(all('.menu-today.menu-tile')).toHaveLength(0);
    document.body.replaceChildren();
    home();
    expect(document.querySelector('.menu-today')).toBeNull();
  });

  it('follows the plan when it is refreshed', () => {
    let done = 0;
    const { menu } = home(() => ({ done, total: 3, minutes: 7 }));
    done = 2;
    menu.refresh();
    expect($('.menu-today-title').textContent).toBe('Today: 2 of 3 done');
  });
});
