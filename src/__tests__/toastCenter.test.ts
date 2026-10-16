import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { initLocale, setLocale } from '../i18n';
import { ToastCenter } from '../game/toastCenter';

let center: ToastCenter;
const toasts = () => Array.from(document.querySelectorAll<HTMLElement>('.toast'));

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  initLocale();
  document.body.replaceChildren();
  center = new ToastCenter();
});

afterEach(() => {
  vi.useRealTimers();
  document.body.replaceChildren();
});

describe('ToastCenter', () => {
  it('keeps its toasts in a polite status region', () => {
    center.show({ kind: 'goal', title: 'Daily goal reached!' });
    const region = document.getElementById('toasts')!;
    expect(region.getAttribute('role')).toBe('status');
    expect(region.getAttribute('aria-live')).toBe('polite');
    expect(region.contains(toasts()[0])).toBe(true);
  });

  it('shows a title, an optional detail and its kind', () => {
    center.show({ kind: 'badge', title: 'Badge earned: First note', detail: 'Answer your first note correctly.' });
    const toast = toasts()[0];
    expect(toast.dataset.kind).toBe('badge');
    expect(toast.querySelector('.toast-title')!.textContent).toBe('Badge earned: First note');
    expect(toast.querySelector('.toast-detail')!.textContent).toBe('Answer your first note correctly.');
    center.show({ kind: 'goal', title: 'No detail' });
    expect(toasts()[1].querySelector('.toast-detail')).toBeNull();
  });

  it('goes away by itself', () => {
    center.show({ kind: 'goal', title: 'Hello', durationMs: 2000 });
    vi.advanceTimersByTime(1900);
    expect(toasts()).toHaveLength(1);
    vi.advanceTimersByTime(600);
    expect(toasts()).toHaveLength(0);
  });

  it('shows at most four toasts, dropping the oldest', () => {
    for (let i = 1; i <= 6; i++) center.show({ kind: 'badge', title: `Badge ${i}`, durationMs: 60000 });
    const titles = toasts().filter((t) => !t.classList.contains('leaving')).map((t) => t.querySelector('.toast-title')!.textContent);
    expect(titles).toEqual(['Badge 3', 'Badge 4', 'Badge 5', 'Badge 6']);
  });

  it('adds up XP that arrives in quick succession into one toast', () => {
    center.showXp(2);
    center.showXp(2);
    center.showXp(3);
    expect(toasts()).toHaveLength(1);
    expect(toasts()[0].querySelector('.toast-title')!.textContent).toBe('+7 XP');
    expect(toasts()[0].dataset.kind).toBe('xp');
  });

  it('starts a new XP toast after the old one is gone', () => {
    center.showXp(2);
    vi.advanceTimersByTime(3000);
    center.showXp(5);
    expect(toasts()).toHaveLength(1);
    expect(toasts()[0].querySelector('.toast-title')!.textContent).toBe('+5 XP');
  });

  it('keeps the XP toast alive while more XP arrives', () => {
    center.showXp(2);
    vi.advanceTimersByTime(1000);
    center.showXp(2);
    vi.advanceTimersByTime(1000);
    expect(toasts()).toHaveLength(1);
    expect(toasts()[0].querySelector('.toast-title')!.textContent).toBe('+4 XP');
  });

  it('writes the amount in Persian digits in Persian', () => {
    setLocale('fa');
    center.showXp(12);
    expect(toasts()[0].querySelector('.toast-title')!.textContent).toBe('امتیاز: +۱۲');
  });

  it('can be cleared at once', () => {
    center.show({ kind: 'goal', title: 'A' });
    center.showXp(2);
    center.clear();
    expect(toasts()).toHaveLength(0);
  });
});
