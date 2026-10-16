import { describe, it, expect, beforeEach, vi } from 'vitest';
import { initLocale, setLocale } from '../i18n';
import { GameStore } from '../game/gameStore';
import { GameHud } from '../game/gameHud';
import { ProgressView } from '../game/progressView';
import { BADGES } from '../game/achievements';

function makeStore() {
  return new GameStore({ storage: null, now: () => new Date('2026-10-16T12:00:00'), beginnerSongIds: ['mary-lamb'] });
}

beforeEach(() => {
  localStorage.clear();
  initLocale();
  document.body.replaceChildren();
});

describe('GameHud', () => {
  it('shows the rank, the way to the next one, today\'s goal and the streak', () => {
    const store = makeStore();
    for (let i = 0; i < 3; i++) store.recordLevelPassed(1); // 30 XP
    const hud = new GameHud(store);
    document.body.appendChild(hud.element);
    expect(hud.element.querySelector('.hud-rank-name')!.textContent).toBe('Rank 1');
    expect(hud.element.querySelector('.hud-rank-note')!.textContent).toBe('20 XP to rank 2');
    expect((hud.element.querySelector('.hud-bar-fill') as HTMLElement).style.width).toBe('60%');
    expect(hud.element.querySelector('.hud-goal-text')!.textContent).toBe('Today: 30 of 50 XP');
    expect(hud.element.querySelector('.hud-streak-text')!.textContent).toBe('Days in a row: 0');
  });

  it('gives the progress bar and the goal ring spoken values', () => {
    const store = makeStore();
    store.recordLevelPassed(1);
    const hud = new GameHud(store);
    const bar = hud.element.querySelector('.hud-bar')!;
    expect(bar.getAttribute('role')).toBe('progressbar');
    expect(bar.getAttribute('aria-valuenow')).toBe('20');
    const ring = hud.element.querySelector('.hud-ring')!;
    expect(ring.getAttribute('role')).toBe('img');
    expect(ring.getAttribute('aria-label')).toBe('Today: 10 of 50 XP');
  });

  it('says so when the daily goal is reached', () => {
    const store = makeStore();
    store.setGoal(20);
    store.recordLevelPassed(1);
    store.recordLevelPassed(1);
    const hud = new GameHud(store);
    expect(hud.element.querySelector('.hud-goal-text')!.textContent).toBe('Daily goal reached');
    expect(hud.element.dataset.goalDone).toBe('true');
    expect(hud.element.querySelector('.hud-streak-text')!.textContent).toBe('Days in a row: 1');
  });

  it('follows the store while it is on screen', () => {
    const store = makeStore();
    const hud = new GameHud(store);
    store.recordLevelPassed(1);
    expect(hud.element.querySelector('.hud-goal-text')!.textContent).toBe('Today: 10 of 50 XP');
  });

  it('stops following after dispose', () => {
    const store = makeStore();
    const hud = new GameHud(store);
    hud.dispose();
    store.recordLevelPassed(1);
    expect(hud.element.querySelector('.hud-goal-text')!.textContent).toBe('Today: 0 of 50 XP');
  });

  it('uses Persian words and digits in Persian', () => {
    const store = makeStore();
    store.recordLevelPassed(1);
    setLocale('fa');
    const hud = new GameHud(store);
    expect(hud.element.querySelector('.hud-rank-name')!.textContent).toBe('رتبه‌ی ۱');
    expect(hud.element.querySelector('.hud-goal-text')!.textContent).toBe('امروز: ۱۰ از ۵۰ امتیاز');
  });
});

describe('ProgressView', () => {
  function build(store = makeStore()) {
    const onBack = vi.fn();
    const view = new ProgressView({ store, onBack });
    document.body.appendChild(view.element);
    return { view, store, onBack };
  }
  const q = <T extends Element>(view: ProgressView, sel: string) => view.element.querySelector(sel) as T;
  const qa = <T extends Element>(view: ProgressView, sel: string) => Array.from(view.element.querySelectorAll(sel)) as T[];

  it('is the progress screen section with a back button', () => {
    const { view, onBack } = build();
    expect(view.element.id).toBe('progressView');
    expect(view.element.dataset.views).toBe('progress');
    q<HTMLButtonElement>(view, '.back-btn').click();
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('lists every badge, all locked at first', () => {
    const { view } = build();
    expect(qa(view, '.pv-badge')).toHaveLength(BADGES.length);
    expect(qa<HTMLElement>(view, '.pv-badge').every((b) => b.dataset.state === 'locked')).toBe(true);
    expect(q(view, '.pv-count').textContent).toBe(`0 of ${BADGES.length} earned`);
    expect(q(view, '[data-badge="first-note"] .pv-badge-status').textContent).toBe('Not earned yet');
  });

  it('shows a badge as earned, with the day it was earned', () => {
    const store = makeStore();
    store.recordAnswer(true);
    const { view } = build(store);
    const badge = q<HTMLElement>(view, '[data-badge="first-note"]');
    expect(badge.dataset.state).toBe('earned');
    expect(badge.querySelector('.pv-badge-status')!.textContent).toBe('Earned 16 October 2026');
    expect(q(view, '.pv-count').textContent).toBe(`1 of ${BADGES.length} earned`);
  });

  it('gives each badge a name and what it is for', () => {
    const { view } = build();
    const badge = q<HTMLElement>(view, '[data-badge="combo-10"]');
    expect(badge.querySelector('.pv-badge-title')!.textContent).toBe('On a roll');
    expect(badge.querySelector('.pv-badge-desc')!.textContent).toBe('Give 10 right answers in a row.');
    expect(badge.querySelector('svg path')).not.toBeNull();
  });

  it('shows the numbers behind the progress', () => {
    const store = makeStore();
    for (let i = 0; i < 7; i++) store.recordAnswer(true);
    store.recordSongFinished('mary-lamb', 3);
    const { view } = build(store);
    const row = (name: string) => q<HTMLElement>(view, `[data-stat="${name}"] dd`).textContent;
    expect(row('correct')).toBe('7');
    expect(row('bestCombo')).toBe('7');
    expect(row('songs')).toBe('1');
    expect(row('xylo')).toBe('0');
  });

  it('lets the player pick the daily goal', () => {
    const { view, store } = build();
    expect(q(view, '[data-goal="50"]').getAttribute('aria-pressed')).toBe('true');
    q<HTMLButtonElement>(view, '[data-goal="100"]').click();
    expect(store.goal()).toBe(100);
    expect(q(view, '[data-goal="100"]').getAttribute('aria-pressed')).toBe('true');
    expect(q(view, '[data-goal="50"]').getAttribute('aria-pressed')).toBe('false');
  });

  it('asks before erasing, in the page and not with a browser dialog', () => {
    const store = makeStore();
    store.recordSongFinished('mary-lamb', 3);
    const { view } = build(store);
    const confirm = q<HTMLElement>(view, '.pv-confirm');
    expect(confirm.hidden).toBe(true);
    q<HTMLButtonElement>(view, '.pv-reset').click();
    expect(confirm.hidden).toBe(false);
    expect(confirm.textContent).toContain('Erase all XP, badges and stars?');
    q<HTMLButtonElement>(view, '.pv-reset-no').click();
    expect(confirm.hidden).toBe(true);
    expect(store.totalXp()).toBeGreaterThan(0);

    q<HTMLButtonElement>(view, '.pv-reset').click();
    q<HTMLButtonElement>(view, '.pv-reset-yes').click();
    expect(store.totalXp()).toBe(0);
    expect(store.hasBadge('first-song')).toBe(false);
    expect(q<HTMLElement>(view, '.pv-confirm').hidden).toBe(true); // the page was drawn again
    expect(q(view, '.pv-count').textContent).toBe(`0 of ${BADGES.length} earned`);
  });

  it('follows the store while it is on screen', () => {
    const { view, store } = build();
    store.recordAnswer(true);
    expect(q<HTMLElement>(view, '[data-badge="first-note"]').dataset.state).toBe('earned');
  });

  it('writes the page again in Persian, with Persian dates and digits', () => {
    const store = makeStore();
    store.recordAnswer(true);
    const { view } = build(store);
    setLocale('fa');
    view.refresh();
    expect(q(view, 'h2').textContent).toBe('پیشرفت');
    expect(q(view, '[data-badge="first-note"] .pv-badge-title').textContent).toBe('نخستین نت');
    expect(q(view, '[data-badge="first-note"] .pv-badge-status').textContent).toMatch(/^به دست آمد: [۰-۹؀-ۿ\s]+$/);
    expect(q(view, '[data-stat="correct"] dd').textContent).toBe('۱');
  });
});
