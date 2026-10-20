import { describe, it, expect, vi, beforeEach } from 'vitest';
import { openDialog } from '../ui/dialog';
import { initLocale, setLocale } from '../i18n';

// jsdom has no <dialog>.showModal(), so these tests run the fallback path (the `open` attribute);
// the real showModal() path is covered by the end-to-end tests.

function body(...children: HTMLElement[]): HTMLElement {
  const el = document.createElement('div');
  el.append(...children);
  return el;
}
function button(text: string): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = text;
  return b;
}
const key = (target: Element, name: string, init: KeyboardEventInit = {}) => {
  const event = new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(event);
  return event;
};
const dialogs = () => document.querySelectorAll('dialog');

beforeEach(() => {
  localStorage.clear();
  document.body.replaceChildren();
  initLocale();
});

describe('openDialog', () => {
  it('shows a dialog named by its title, with the content inside', () => {
    const content = button('Play');
    const handle = openDialog({ title: 'Chord details', body: body(content) });
    const dialog = dialogs()[0];
    expect(dialogs()).toHaveLength(1);
    expect(dialog).toBe(handle.element);
    expect(dialog.hasAttribute('open')).toBe(true);
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    const heading = dialog.querySelector('h2')!;
    expect(heading.textContent).toBe('Chord details');
    expect(dialog.getAttribute('aria-labelledby')).toBe(heading.id);
    expect(dialog.contains(content)).toBe(true);
  });

  it('gives each dialog its own heading id', () => {
    openDialog({ title: 'One', body: body() });
    openDialog({ title: 'Two', body: body() });
    const ids = Array.from(document.querySelectorAll('dialog h2')).map((h) => h.id);
    expect(new Set(ids).size).toBe(2);
  });

  it('puts the focus on the first control of the content', () => {
    const first = button('First');
    openDialog({ title: 'T', body: body(first, button('Second')) });
    expect(document.activeElement).toBe(first);
  });

  it('puts the focus on the Close button when the content has no control', () => {
    openDialog({ title: 'T', body: body() });
    expect(document.activeElement).toBe(document.querySelector('.app-dialog-close'));
  });

  it('has a Close button that closes it, in both languages', () => {
    openDialog({ title: 'T', body: body() });
    expect(document.querySelector('.app-dialog-close')!.textContent).toBe('Close');
    document.body.replaceChildren();
    setLocale('fa');
    openDialog({ title: 'T', body: body() });
    expect(document.querySelector('.app-dialog-close')!.textContent).toBe('بستن');
    setLocale('en');
  });

  it('closes with the Close button, removes itself and calls onClose once', () => {
    const onClose = vi.fn();
    openDialog({ title: 'T', body: body(), onClose });
    (document.querySelector('.app-dialog-close') as HTMLButtonElement).click();
    expect(dialogs()).toHaveLength(0);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes with Escape', () => {
    const onClose = vi.fn();
    const inner = button('Inner');
    openDialog({ title: 'T', body: body(inner), onClose });
    const event = key(inner, 'Escape');
    expect(event.defaultPrevented).toBe(true);
    expect(dialogs()).toHaveLength(0);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes when the native cancel event fires (Escape in a real browser)', () => {
    const onClose = vi.fn();
    const handle = openDialog({ title: 'T', body: body(), onClose });
    const cancel = new Event('cancel', { cancelable: true });
    handle.element.dispatchEvent(cancel);
    expect(cancel.defaultPrevented).toBe(true);
    expect(dialogs()).toHaveLength(0);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes when the backdrop (the dialog itself) is clicked, but not when the content is', () => {
    const inner = button('Inner');
    const handle = openDialog({ title: 'T', body: body(inner) });
    inner.click();
    expect(dialogs()).toHaveLength(1);
    handle.element.click();
    expect(dialogs()).toHaveLength(0);
  });

  it('calls onClose only once, however many times it is closed', () => {
    const onClose = vi.fn();
    const handle = openDialog({ title: 'T', body: body(), onClose });
    handle.close();
    handle.close();
    key(document.body, 'Escape');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('gives the focus back to the control that opened it', () => {
    const opener = button('Open');
    document.body.append(opener);
    opener.focus();
    const handle = openDialog({ title: 'T', body: body(button('Inside')) });
    expect(document.activeElement).not.toBe(opener);
    handle.close();
    expect(document.activeElement).toBe(opener);
  });

  it('does not fail when the opener has left the page', () => {
    const opener = button('Open');
    document.body.append(opener);
    opener.focus();
    const handle = openDialog({ title: 'T', body: body() });
    opener.remove();
    expect(() => handle.close()).not.toThrow();
  });

  describe('keeping the Tab key inside', () => {
    function setup() {
      const a = button('A');
      const b = button('B');
      openDialog({ title: 'T', body: body(a, b) });
      const close = document.querySelector('.app-dialog-close') as HTMLButtonElement;
      return { a, b, close };
    }

    it('Tab on the last control wraps to the first', () => {
      const { b, close } = setup();
      b.focus();
      const event = key(b, 'Tab');
      expect(event.defaultPrevented).toBe(true);
      expect(document.activeElement).toBe(close);
    });

    it('Shift+Tab on the first control wraps to the last', () => {
      const { b, close } = setup();
      close.focus();
      const event = key(close, 'Tab', { shiftKey: true });
      expect(event.defaultPrevented).toBe(true);
      expect(document.activeElement).toBe(b);
    });

    it('Tab in the middle is left to the browser', () => {
      const { a } = setup();
      a.focus();
      const event = key(a, 'Tab');
      expect(event.defaultPrevented).toBe(false);
    });

    it('skips disabled controls when it looks for the ends', () => {
      const a = button('A');
      const b = button('B');
      b.disabled = true;
      openDialog({ title: 'T', body: body(a, b) });
      a.focus();
      const event = key(a, 'Tab');
      expect(event.defaultPrevented).toBe(true);
      expect(document.activeElement).toBe(document.querySelector('.app-dialog-close'));
    });
  });

  it('adds the extra class for feature styles', () => {
    const handle = openDialog({ title: 'T', body: body(), className: 'chord-dialog' });
    expect(handle.element.classList.contains('app-dialog')).toBe(true);
    expect(handle.element.classList.contains('chord-dialog')).toBe(true);
  });
});
