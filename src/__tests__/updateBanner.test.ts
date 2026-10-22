import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initLocale, setLocale, t } from '../i18n';
import { showUpdateBanner } from '../pwa/updateBanner';

const $ = (selector: string) => document.querySelector<HTMLElement>(selector)!;

beforeEach(() => {
  initLocale();
  setLocale('en');
  document.body.replaceChildren();
});

afterEach(() => document.body.replaceChildren());

describe('the update banner', () => {
  it('says that a new version is ready and offers to reload, as a polite status message', () => {
    showUpdateBanner(vi.fn());
    const banner = $('.update-banner');
    expect(banner.getAttribute('role')).toBe('status');
    expect(banner.textContent).toContain(t('pwa.update.ready'));
    expect($('.update-reload').textContent).toBe(t('pwa.update.reload'));
    expect($('.update-later').textContent).toBe(t('pwa.update.later'));
  });

  it('applies the update when Reload is pressed, once, and shows that it is working', () => {
    const apply = vi.fn();
    showUpdateBanner(apply);
    $('.update-reload').click();
    $('.update-reload').click();
    expect(apply).toHaveBeenCalledTimes(1);
    expect(($('.update-reload') as HTMLButtonElement).disabled).toBe(true);
    expect($('.update-banner').getAttribute('aria-busy')).toBe('true');
  });

  it('goes away on Later, and does not come back by itself', () => {
    const apply = vi.fn();
    showUpdateBanner(apply);
    $('.update-later').click();
    expect(document.querySelector('.update-banner')).toBeNull();
    expect(apply).not.toHaveBeenCalled();
  });

  it('is one banner, however many times it is offered', () => {
    showUpdateBanner(vi.fn());
    showUpdateBanner(vi.fn());
    expect(document.querySelectorAll('.update-banner')).toHaveLength(1);
  });

  it('follows the language', () => {
    showUpdateBanner(vi.fn());
    const english = $('.update-banner').textContent;
    setLocale('fa');
    expect($('.update-banner').textContent).not.toBe(english);
    expect($('.update-reload').textContent).toBe(t('pwa.update.reload'));
    setLocale('en');
    expect($('.update-reload').textContent).toBe('Reload');
  });
});
