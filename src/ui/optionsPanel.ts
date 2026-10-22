const PANEL_ID = 'optionsPanel';
const CONTROLLERS = `[aria-controls="${PANEL_ID}"]`;

/**
 * The Settings panel: opened by any button that says `aria-controls="optionsPanel"` (the three dots of the control bar,
 * the Settings tile of the home screen, the Settings button of the side rail), closed by its own close button, by
 * Escape, or by a click outside it. Every one of those buttons keeps `aria-expanded` right.
 */
export class OptionsPanel {
  private readonly doc: Document;
  private readonly listeners = new Set<(open: boolean) => void>();
  private opener: HTMLElement | null = null;

  constructor(doc: Document = document) {
    this.doc = doc;
    this.doc.addEventListener('click', this.onClick);
    this.doc.addEventListener('keydown', this.onKey);
  }

  private get panel(): HTMLElement | null {
    return this.doc.getElementById(PANEL_ID);
  }

  isOpen(): boolean {
    const panel = this.panel;
    return panel !== null && !panel.hidden;
  }

  open(opener?: HTMLElement): void {
    const panel = this.panel;
    if (!panel || this.isOpen()) return;
    if (opener) this.opener = opener;
    panel.hidden = false;
    this.syncButtons();
    this.emit();
  }

  close(): void {
    const panel = this.panel;
    if (!panel || !this.isOpen()) return;
    panel.hidden = true;
    this.syncButtons();
    this.emit();
  }

  toggle(opener?: HTMLElement): void {
    if (this.isOpen()) this.close();
    else this.open(opener);
  }

  onChange(listener: (open: boolean) => void): () => void {
    this.listeners.add(listener);
    return () => void this.listeners.delete(listener);
  }

  destroy(): void {
    this.doc.removeEventListener('click', this.onClick);
    this.doc.removeEventListener('keydown', this.onKey);
  }

  private syncButtons(): void {
    const open = String(this.isOpen());
    for (const button of this.doc.querySelectorAll(CONTROLLERS)) button.setAttribute('aria-expanded', open);
  }

  private emit(): void {
    const open = this.isOpen();
    for (const listener of [...this.listeners]) listener(open);
  }

  private readonly onClick = (event: Event): void => {
    const panel = this.panel;
    if (!panel || !this.isOpen()) return;
    const target = event.target as Element | null;
    if (!target) return;
    if (target.closest('#optionsClose') && panel.contains(target)) {
      this.close();
      return;
    }
    if (panel.contains(target) || target.closest(CONTROLLERS)) return;
    this.close();
  };

  private readonly onKey = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape' || !this.isOpen()) return;
    const panel = this.panel!;
    const focusInside = panel.contains(this.doc.activeElement);
    this.close();
    if (focusInside) this.opener?.focus();
  };
}
