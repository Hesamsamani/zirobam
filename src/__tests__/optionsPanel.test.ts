import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OptionsPanel } from '../ui/optionsPanel';

let panel: OptionsPanel;

function fixture(): void {
  const parsed = new DOMParser().parseFromString(
    `<body>
    <button id="a" aria-controls="optionsPanel" aria-expanded="false">A</button>
    <button id="b" aria-controls="optionsPanel" aria-expanded="false">B</button>
    <div id="optionsPanel" hidden><button id="optionsClose">x</button><button id="inside">in</button></div>
    <button id="outside">out</button></body>`,
    'text/html',
  );
  document.body.replaceChildren(...Array.from(parsed.body.children).map((child) => document.importNode(child, true)));
}

const el = (id: string) => document.getElementById(id)!;
const press = (key: string) => document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));

beforeEach(() => {
  fixture();
  panel = new OptionsPanel(document);
});

afterEach(() => {
  panel.destroy();
  document.body.replaceChildren();
});

describe('OptionsPanel', () => {
  it('starts closed, and opening and closing show and hide it and tell every button that controls it', () => {
    expect(panel.isOpen()).toBe(false);
    panel.open(el('a'));
    expect(panel.isOpen()).toBe(true);
    expect(el('optionsPanel').hidden).toBe(false);
    expect(el('a').getAttribute('aria-expanded')).toBe('true');
    expect(el('b').getAttribute('aria-expanded')).toBe('true');
    panel.close();
    expect(el('optionsPanel').hidden).toBe(true);
    expect(el('a').getAttribute('aria-expanded')).toBe('false');
    expect(el('b').getAttribute('aria-expanded')).toBe('false');
  });

  it('toggles', () => {
    panel.toggle(el('a'));
    expect(panel.isOpen()).toBe(true);
    panel.toggle(el('b'));
    expect(panel.isOpen()).toBe(false);
  });

  it('closes on a click outside, and not on a click inside or on a button that controls it', () => {
    panel.open(el('a'));
    el('inside').click();
    expect(panel.isOpen()).toBe(true);
    el('a').click(); // the button does its own toggling; the outside rule must not close it first
    expect(panel.isOpen()).toBe(true);
    el('b').click();
    expect(panel.isOpen()).toBe(true);
    el('outside').click();
    expect(panel.isOpen()).toBe(false);
  });

  it('closes with its own close button', () => {
    panel.open(el('a'));
    el('optionsClose').click();
    expect(panel.isOpen()).toBe(false);
  });

  it('closes with Escape and gives the focus back to the button that opened it, when the focus was inside', () => {
    panel.open(el('b'));
    el('inside').focus();
    press('Escape');
    expect(panel.isOpen()).toBe(false);
    expect(document.activeElement).toBe(el('b'));
  });

  it('leaves the focus alone when Escape comes from somewhere else, and does nothing while closed', () => {
    panel.open(el('a'));
    el('outside').focus();
    press('Escape');
    expect(panel.isOpen()).toBe(false);
    expect(document.activeElement).toBe(el('outside'));
    const spy = vi.fn();
    panel.onChange(spy);
    press('Escape');
    expect(spy).not.toHaveBeenCalled();
  });

  it('tells those who listen, once for each change', () => {
    const spy = vi.fn();
    const stop = panel.onChange(spy);
    panel.open();
    panel.open();
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenLastCalledWith(true);
    panel.close();
    panel.close();
    expect(spy).toHaveBeenCalledTimes(2);
    expect(spy).toHaveBeenLastCalledWith(false);
    stop();
    panel.open();
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('does not throw where the page has no panel', () => {
    document.body.replaceChildren();
    const none = new OptionsPanel(document);
    expect(() => {
      none.open();
      none.toggle();
      none.close();
    }).not.toThrow();
    expect(none.isOpen()).toBe(false);
    none.destroy();
  });
});
