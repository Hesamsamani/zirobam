import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InstallPrompt, type BeforeInstallPromptEvent } from '../pwa/installPrompt';
import { PwaPanel } from '../pwa/pwaPanel';
import { initLocale, setLocale } from '../i18n';

function offerEvent(outcome: 'accepted' | 'dismissed' = 'accepted') {
  const event = new Event('beforeinstallprompt', { cancelable: true }) as BeforeInstallPromptEvent & { prompted: number };
  event.prompted = 0;
  Object.assign(event, {
    prompt: vi.fn(async () => {
      event.prompted++;
    }),
    userChoice: Promise.resolve({ outcome }),
  });
  return event;
}

describe('InstallPrompt', () => {
  it('is not available until the browser makes its offer, and keeps the offer for later', () => {
    const target = new EventTarget();
    const prompt = new InstallPrompt(target);
    expect(prompt.available()).toBe(false);
    const event = offerEvent();
    target.dispatchEvent(event);
    expect(prompt.available()).toBe(true);
    expect(event.defaultPrevented).toBe(true); // the browser's own bar stays away
    expect(event.prompted).toBe(0);
  });

  it('shows the question when asked, once', async () => {
    const target = new EventTarget();
    const prompt = new InstallPrompt(target);
    const event = offerEvent('accepted');
    target.dispatchEvent(event);
    expect(await prompt.install()).toBe('accepted');
    expect(event.prompted).toBe(1);
    expect(prompt.available()).toBe(false);
    expect(await prompt.install()).toBe('unavailable');
  });

  it('says when the student turned the offer down', async () => {
    const target = new EventTarget();
    const prompt = new InstallPrompt(target);
    target.dispatchEvent(offerEvent('dismissed'));
    expect(await prompt.install()).toBe('dismissed');
  });

  it('forgets the offer once the app is installed', () => {
    const target = new EventTarget();
    const prompt = new InstallPrompt(target);
    target.dispatchEvent(offerEvent());
    target.dispatchEvent(new Event('appinstalled'));
    expect(prompt.available()).toBe(false);
  });

  it('tells its listeners about changes, until they stop listening', () => {
    const target = new EventTarget();
    const prompt = new InstallPrompt(target);
    const listener = vi.fn();
    const stop = prompt.onChange(listener);
    target.dispatchEvent(offerEvent());
    expect(listener).toHaveBeenCalledTimes(1);
    stop();
    target.dispatchEvent(new Event('appinstalled'));
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('copes with a browser that fails to show the question', async () => {
    const target = new EventTarget();
    const prompt = new InstallPrompt(target);
    const event = offerEvent();
    event.prompt = vi.fn(async () => Promise.reject(new Error('no'))) as unknown as () => Promise<void>;
    target.dispatchEvent(event);
    expect(await prompt.install()).toBe('dismissed');
  });
});

describe('PwaPanel', () => {
  beforeEach(() => {
    localStorage.clear();
    initLocale();
    setLocale('en');
  });

  function setup() {
    const target = new EventTarget();
    const prompt = new InstallPrompt(target);
    const panel = new PwaPanel({ prompt });
    document.body.replaceChildren(panel.element);
    return { target, panel, prompt };
  }
  const $ = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector)!;
  const flush = async () => {
    for (let i = 0; i < 6; i++) await Promise.resolve();
  };

  it('is not shown when there is nothing to say (the development server, an old browser)', () => {
    setup();
    expect($('.pwa-panel').hidden).toBe(true);
  });

  it('says the app works without internet once the worker has stored it', () => {
    const { panel } = setup();
    panel.markOfflineReady();
    expect($('.pwa-panel').hidden).toBe(false);
    expect($('.pwa-offline').textContent).toMatch(/works without internet/);
    expect($('.pwa-install').hidden).toBe(true);
  });

  it('shows the install button while the browser offers to install the app, and hides it after', async () => {
    const { target } = setup();
    target.dispatchEvent(offerEvent('accepted'));
    expect($('.pwa-panel').hidden).toBe(false);
    expect($('.pwa-install').hidden).toBe(false);
    expect($('.pwa-install').textContent).toBe('Install the app');
    $('.pwa-install').click();
    await flush();
    expect($('.pwa-install').hidden).toBe(true);
    expect($('.pwa-status').textContent).toMatch(/Installed/);
  });

  it('puts the button back after a no, when the browser offers again', async () => {
    const { target } = setup();
    target.dispatchEvent(offerEvent('dismissed'));
    $('.pwa-install').click();
    await flush();
    expect($('.pwa-install').hidden).toBe(true);
    expect($('.pwa-status').textContent).toBe('');
    target.dispatchEvent(offerEvent());
    expect($('.pwa-install').hidden).toBe(false);
  });

  it('speaks Persian', () => {
    setLocale('fa');
    const { panel } = setup();
    panel.markOfflineReady();
    expect($('.pwa-title').textContent).toBe('استفاده بدون اینترنت');
    expect($('.pwa-offline').textContent).toContain('بدون اینترنت');
  });
});
