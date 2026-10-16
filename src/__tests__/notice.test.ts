import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { showNotice, hideNotice } from '../ui/notice';

describe('notice', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.body.replaceChildren();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows the message in a polite status region', () => {
    showNotice('Hello');
    const el = document.getElementById('notice')!;
    expect(el.textContent).toBe('Hello');
    expect(el.hidden).toBe(false);
    expect(el.getAttribute('role')).toBe('status');
    expect(el.getAttribute('aria-live')).toBe('polite');
  });

  it('reuses the same element for a second message', () => {
    showNotice('One');
    showNotice('Two');
    expect(document.querySelectorAll('#notice')).toHaveLength(1);
    expect(document.getElementById('notice')!.textContent).toBe('Two');
  });

  it('hides itself after the given time', () => {
    showNotice('Hello', 3000);
    vi.advanceTimersByTime(2999);
    expect(document.getElementById('notice')!.hidden).toBe(false);
    vi.advanceTimersByTime(2);
    expect(document.getElementById('notice')!.hidden).toBe(true);
  });

  it('keeps a newer message visible for its full time', () => {
    showNotice('First', 3000);
    vi.advanceTimersByTime(2000);
    showNotice('Second', 3000);
    vi.advanceTimersByTime(2000);
    expect(document.getElementById('notice')!.hidden).toBe(false);
    vi.advanceTimersByTime(1100);
    expect(document.getElementById('notice')!.hidden).toBe(true);
  });

  it('can be hidden at once', () => {
    showNotice('Hello');
    hideNotice();
    expect(document.getElementById('notice')!.hidden).toBe(true);
  });

  it('does nothing when hiding before any message was shown', () => {
    expect(() => hideNotice()).not.toThrow();
  });
});
