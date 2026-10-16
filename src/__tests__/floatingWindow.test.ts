import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FloatingWindow, type PipApi, type PipWindow } from '../metronome/floatingWindow';

function pointer(type: string, x: number, y: number, target: EventTarget) {
  target.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y }));
}

function fakePipWindow() {
  const listeners: Record<string, Array<() => void>> = {};
  const pip = {
    document: document.implementation.createHTMLDocument('pip'),
    addEventListener: (type: string, fn: () => void) => {
      (listeners[type] ??= []).push(fn);
    },
    close: vi.fn(() => {
      for (const fn of listeners.pagehide ?? []) fn();
    }),
    closeFromOutside() {
      for (const fn of listeners.pagehide ?? []) fn();
    },
  };
  return pip satisfies PipWindow & { closeFromOutside(): void };
}

let content: HTMLElement;
let changes: boolean[];

function make(api: PipApi | null = null) {
  const floating = new FloatingWindow({
    content,
    title: () => 'Metronome',
    closeLabel: () => 'Close the metronome',
    dragLabel: () => 'Drag to move',
    pipApi: api,
  });
  floating.onChange((open) => changes.push(open));
  return floating;
}

beforeEach(() => {
  localStorage.clear();
  document.body.replaceChildren();
  document.head.replaceChildren();
  document.documentElement.lang = 'en';
  document.documentElement.dir = 'ltr';
  content = document.createElement('div');
  content.id = 'content';
  changes = [];
});

afterEach(() => {
  document.body.replaceChildren();
});

describe('in-page window (no Picture-in-Picture)', () => {
  it('opens a floating panel with the content', async () => {
    const floating = make();
    expect(floating.isOpen()).toBe(false);
    await floating.open();
    const box = document.querySelector('.metro-float')!;
    expect(box.contains(content)).toBe(true);
    expect(floating.isOpen()).toBe(true);
    expect(floating.kind()).toBe('page');
    expect(changes).toEqual([true]);
    expect(box.getAttribute('role')).toBe('dialog');
    expect(box.getAttribute('aria-label')).toBe('Metronome');
  });

  it('closes with its button and gives the content back', async () => {
    const floating = make();
    await floating.open();
    document.querySelector<HTMLButtonElement>('.metro-float-close')!.click();
    expect(document.querySelector('.metro-float')).toBeNull();
    expect(content.isConnected).toBe(false);
    expect(floating.isOpen()).toBe(false);
    expect(changes).toEqual([true, false]);
  });

  it('opens and closes with toggle', async () => {
    const floating = make();
    await floating.toggle();
    expect(floating.isOpen()).toBe(true);
    await floating.toggle();
    expect(floating.isOpen()).toBe(false);
  });

  it('does not open a second time', async () => {
    const floating = make();
    await floating.open();
    await floating.open();
    expect(document.querySelectorAll('.metro-float')).toHaveLength(1);
    expect(changes).toEqual([true]);
  });

  it('can be dragged by its bar and remembers where it was left', async () => {
    const floating = make();
    await floating.open();
    const box = document.querySelector<HTMLElement>('.metro-float')!;
    const bar = box.querySelector<HTMLElement>('.metro-float-bar')!;
    pointer('pointerdown', 100, 100, bar);
    const startLeft = parseFloat(box.style.left);
    const startTop = parseFloat(box.style.top);
    pointer('pointermove', 120, 110, window);
    expect(parseFloat(box.style.left)).toBe(startLeft + 20);
    expect(parseFloat(box.style.top)).toBe(startTop + 10);
    pointer('pointerup', 120, 110, window);
    pointer('pointermove', 400, 400, window); // no longer dragging
    expect(parseFloat(box.style.left)).toBe(startLeft + 20);

    floating.close();
    await floating.open();
    const again = document.querySelector<HTMLElement>('.metro-float')!;
    expect(parseFloat(again.style.left)).toBe(startLeft + 20);
    expect(parseFloat(again.style.top)).toBe(startTop + 10);
  });

  it('cannot be dragged out of the screen', async () => {
    const floating = make();
    await floating.open();
    const box = document.querySelector<HTMLElement>('.metro-float')!;
    pointer('pointerdown', 100, 100, box.querySelector('.metro-float-bar')!);
    pointer('pointermove', -5000, -5000, window);
    expect(parseFloat(box.style.left)).toBeGreaterThanOrEqual(0);
    expect(parseFloat(box.style.top)).toBeGreaterThanOrEqual(0);
    pointer('pointermove', 50000, 50000, window);
    expect(parseFloat(box.style.left)).toBeLessThanOrEqual(window.innerWidth);
    expect(parseFloat(box.style.top)).toBeLessThanOrEqual(window.innerHeight);
  });

  it('ignores a damaged saved position', async () => {
    localStorage.setItem('metronome.pos', '{"x":"left","y":null}');
    const floating = make();
    await floating.open();
    const box = document.querySelector<HTMLElement>('.metro-float')!;
    expect(Number.isFinite(parseFloat(box.style.left))).toBe(true);
    expect(Number.isFinite(parseFloat(box.style.top))).toBe(true);
  });
});

describe('Picture-in-Picture window', () => {
  it('shows the content in a separate always-on-top window with the page styles', async () => {
    const style = document.createElement('style');
    style.textContent = '.metro-panel { color: red; }';
    document.head.appendChild(style);
    const pip = fakePipWindow();
    const requestWindow = vi.fn(async () => pip);
    const floating = make({ requestWindow });
    await floating.open();
    expect(requestWindow).toHaveBeenCalledTimes(1);
    expect(floating.kind()).toBe('pip');
    expect(pip.document.body.contains(content)).toBe(true);
    expect(document.querySelector('.metro-float')).toBeNull();
    expect(pip.document.head.querySelector('style')!.textContent).toBe('.metro-panel { color: red; }');
    expect(pip.document.title).toBe('Metronome');
    expect(changes).toEqual([true]);
  });

  it('gives the window the language and direction of the page', async () => {
    document.documentElement.lang = 'fa';
    document.documentElement.dir = 'rtl';
    const pip = fakePipWindow();
    await make({ requestWindow: async () => pip }).open();
    expect(pip.document.documentElement.lang).toBe('fa');
    expect(pip.document.documentElement.dir).toBe('rtl');
  });

  it('asks for a small window', async () => {
    const requestWindow = vi.fn(async (_options: { width: number; height: number }) => fakePipWindow());
    await make({ requestWindow }).open();
    const [options] = requestWindow.mock.calls[0];
    expect(options.width).toBeLessThanOrEqual(360);
    expect(options.height).toBeLessThanOrEqual(480);
  });

  it('takes the content back when the window is closed by the user', async () => {
    const pip = fakePipWindow();
    const floating = make({ requestWindow: async () => pip });
    await floating.open();
    pip.closeFromOutside();
    expect(floating.isOpen()).toBe(false);
    expect(content.isConnected).toBe(false);
    expect(changes).toEqual([true, false]);
  });

  it('closes the window when close() is called', async () => {
    const pip = fakePipWindow();
    const floating = make({ requestWindow: async () => pip });
    await floating.open();
    floating.close();
    expect(pip.close).toHaveBeenCalledTimes(1);
    expect(floating.isOpen()).toBe(false);
  });

  it('falls back to the in-page panel when the browser refuses the window', async () => {
    const floating = make({
      requestWindow: async () => {
        throw new DOMException('Not allowed', 'NotAllowedError');
      },
    });
    await floating.open();
    expect(floating.kind()).toBe('page');
    expect(document.querySelector('.metro-float')!.contains(content)).toBe(true);
  });

  it('can be reopened after it was closed', async () => {
    const floating = make({ requestWindow: async () => fakePipWindow() });
    await floating.open();
    floating.close();
    await floating.open();
    expect(floating.isOpen()).toBe(true);
  });

  it('updates the window language when refresh() is called', async () => {
    const pip = fakePipWindow();
    const floating = make({ requestWindow: async () => pip });
    await floating.open();
    document.documentElement.lang = 'fa';
    document.documentElement.dir = 'rtl';
    floating.refresh();
    expect(pip.document.documentElement.dir).toBe('rtl');
  });
});
