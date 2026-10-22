import { EventEmitter } from '../core/events';
import { storageGet, storageSet } from '../core/safeStorage';

/** The part of a Document Picture-in-Picture window that is used. */
export interface PipWindow {
  document: Document;
  addEventListener(type: 'pagehide', listener: () => void): void;
  close(): void;
}

/** `window.documentPictureInPicture` (Chrome and Edge 116+): a small window that stays above all others. */
export interface PipApi {
  requestWindow(options: { width: number; height: number }): Promise<PipWindow>;
}

export interface FloatingWindowDeps {
  /** What to show in the window. It is moved there and moved back when the window closes. */
  content: HTMLElement;
  title(): string;
  closeLabel(): string;
  dragLabel(): string;
  /** Replaces the browser's Picture-in-Picture API (for tests); null means "not available". */
  pipApi?: PipApi | null;
  /** How much room the side rail takes at each side of the page, so the panel in the page never sits under it. */
  insets?(): { left: number; right: number };
}

const POSITION_KEY = 'metronome.pos';
const PIP_SIZE = { width: 300, height: 430 };
const EDGE = 8;

type Kind = 'pip' | 'page';

function pipApi(win: Window): PipApi | undefined {
  return (win as unknown as { documentPictureInPicture?: PipApi }).documentPictureInPicture;
}

function savedPosition(): { x: number; y: number } | null {
  try {
    const parsed: unknown = JSON.parse(storageGet(POSITION_KEY) ?? 'null');
    if (!parsed || typeof parsed !== 'object') return null;
    const { x, y } = parsed as { x?: unknown; y?: unknown };
    return typeof x === 'number' && typeof y === 'number' && Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
  } catch {
    return null;
  }
}

/**
 * A small window for the metronome. In Chrome and Edge it is a real Picture-in-Picture window that stays
 * on top of every other window, so it can sit over a music app or a PDF. Elsewhere it is a draggable
 * panel inside the page.
 */
export class FloatingWindow {
  private readonly deps: FloatingWindowDeps;
  private readonly win: Window;
  private readonly changes = new EventEmitter<boolean>();
  private current: Kind | null = null;
  private pip: PipWindow | null = null;
  private box: HTMLElement | null = null;
  private opening = false;

  constructor(deps: FloatingWindowDeps) {
    this.deps = deps;
    this.win = window;
  }

  isOpen(): boolean {
    return this.current !== null;
  }

  kind(): Kind | null {
    return this.current;
  }

  onChange(listener: (open: boolean) => void): () => void {
    return this.changes.on(listener);
  }

  async toggle(): Promise<void> {
    if (this.isOpen()) this.close();
    else await this.open();
  }

  /** Must be called from a click or key press: browsers only allow a Picture-in-Picture window then. */
  async open(): Promise<void> {
    if (this.isOpen() || this.opening) return;
    this.opening = true;
    try {
      const api = 'pipApi' in this.deps ? this.deps.pipApi ?? undefined : pipApi(this.win);
      if (api) {
        try {
          this.attachPip(await api.requestWindow(PIP_SIZE));
          return;
        } catch {
          // refused or failed: use the panel inside the page instead
        }
      }
      this.openInPage();
    } finally {
      this.opening = false;
    }
  }

  close(): void {
    if (this.current === 'pip') {
      this.pip?.close();
      // a real window reports through pagehide; make sure the state is right either way
      this.finish();
    } else if (this.current === 'page') {
      this.finish();
    }
  }

  /** Copies the language and direction of the page into the Picture-in-Picture window. */
  refresh(): void {
    if (this.pip) this.syncDocument(this.pip.document);
    this.box?.setAttribute('aria-label', this.deps.title());
  }

  private finish(): void {
    if (this.current === null) return;
    this.deps.content.remove();
    this.box?.remove();
    this.box = null;
    this.pip = null;
    this.current = null;
    this.changes.emit(false);
  }

  // ----- Picture-in-Picture -----

  private attachPip(pip: PipWindow): void {
    this.pip = pip;
    this.current = 'pip';
    const target = pip.document;
    for (const node of Array.from(document.head.querySelectorAll('link[rel="stylesheet"], style'))) {
      target.head.appendChild(node.cloneNode(true));
    }
    this.syncDocument(target);
    target.body.classList.add('metro-pip');
    target.body.appendChild(this.deps.content);
    pip.addEventListener('pagehide', () => this.finish());
    this.changes.emit(true);
  }

  private syncDocument(target: Document): void {
    target.documentElement.lang = document.documentElement.lang;
    target.documentElement.dir = document.documentElement.dir;
    target.title = this.deps.title();
  }

  // ----- panel inside the page -----

  private openInPage(): void {
    const box = document.createElement('div');
    box.className = 'metro-float';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-label', this.deps.title());

    const bar = document.createElement('div');
    bar.className = 'metro-float-bar';
    bar.title = this.deps.dragLabel();
    const grip = document.createElement('span');
    grip.className = 'metro-float-title';
    grip.textContent = this.deps.title();
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'metro-float-close';
    close.setAttribute('aria-label', this.deps.closeLabel());
    close.textContent = '×';
    close.addEventListener('click', () => this.close());
    bar.append(grip, close);
    box.append(bar, this.deps.content);
    document.body.appendChild(box);

    const saved = savedPosition();
    this.place(box, saved ?? { x: this.win.innerWidth - 320 - this.insets().right, y: 80 });
    this.enableDragging(box, bar);

    this.box = box;
    this.current = 'page';
    this.changes.emit(true);
  }

  private insets(): { left: number; right: number } {
    return this.deps.insets?.() ?? { left: 0, right: 0 };
  }

  private place(box: HTMLElement, position: { x: number; y: number }): { x: number; y: number } {
    const { left, right } = this.insets();
    const maxX = Math.max(left + EDGE, this.win.innerWidth - (box.offsetWidth || 280) - EDGE - right);
    const maxY = Math.max(EDGE, this.win.innerHeight - (box.offsetHeight || 200) - EDGE);
    const x = Math.max(left, Math.min(maxX, position.x));
    const y = Math.max(0, Math.min(maxY, position.y));
    box.style.left = `${x}px`;
    box.style.top = `${y}px`;
    return { x, y };
  }

  private enableDragging(box: HTMLElement, bar: HTMLElement): void {
    let drag: { startX: number; startY: number; left: number; top: number } | null = null;

    bar.addEventListener('pointerdown', (e) => {
      const event = e as PointerEvent;
      if ((event.target as HTMLElement).closest('button')) return;
      drag = { startX: event.clientX, startY: event.clientY, left: parseFloat(box.style.left), top: parseFloat(box.style.top) };
      event.preventDefault();
    });
    const move = (e: Event) => {
      if (!drag) return;
      const event = e as PointerEvent;
      this.place(box, { x: drag.left + event.clientX - drag.startX, y: drag.top + event.clientY - drag.startY });
    };
    const end = () => {
      if (!drag) return;
      drag = null;
      storageSet(POSITION_KEY, JSON.stringify({ x: parseFloat(box.style.left), y: parseFloat(box.style.top) }));
    };
    this.win.addEventListener('pointermove', move);
    this.win.addEventListener('pointerup', end);
    this.win.addEventListener('pointercancel', end);
  }
}
