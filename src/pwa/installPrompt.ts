/** What the browser gives the page when the app can be installed (not in every browser's types). */
export interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export type InstallResult = 'accepted' | 'dismissed' | 'unavailable';

/**
 * Keeps the browser's offer to install the app until the student asks for it.
 * The offer only comes in browsers that can install the app, and only before it is installed.
 */
export class InstallPrompt {
  private offer: BeforeInstallPromptEvent | null = null;
  private readonly listeners = new Set<() => void>();

  constructor(target: EventTarget = window) {
    target.addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault(); // no pop-up of the browser's own: the button in the options does it
      this.offer = event as BeforeInstallPromptEvent;
      this.emit();
    });
    target.addEventListener('appinstalled', () => {
      this.offer = null;
      this.emit();
    });
  }

  /** True while the browser is ready to install the app. */
  available(): boolean {
    return this.offer !== null;
  }

  onChange(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => void this.listeners.delete(listener);
  }

  /** Shows the browser's install question. The offer can be used once. */
  async install(): Promise<InstallResult> {
    const offer = this.offer;
    if (!offer) return 'unavailable';
    this.offer = null;
    this.emit();
    try {
      await offer.prompt();
      return (await offer.userChoice).outcome;
    } catch {
      return 'dismissed';
    }
  }

  private emit(): void {
    for (const listener of [...this.listeners]) listener();
  }
}
