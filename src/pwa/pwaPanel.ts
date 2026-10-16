import { t } from '../i18n';
import type { InstallPrompt } from './installPrompt';

export interface PwaPanelDeps {
  prompt: Pick<InstallPrompt, 'available' | 'install' | 'onChange'>;
}

/**
 * A group of the options panel about using the app without internet and installing it. It shows only what is true:
 * the offline note once the app is saved in the browser, the install button while the browser offers to install it.
 * Where neither applies (the development server, a browser that cannot do either) the group is not shown.
 */
export class PwaPanel {
  readonly element: HTMLElement;
  private readonly deps: PwaPanelDeps;
  private readonly heading: HTMLElement;
  private readonly offline: HTMLElement;
  private readonly hint: HTMLElement;
  private readonly button: HTMLButtonElement;
  private readonly status: HTMLElement;
  private offlineReady = false;
  private installed = false;

  constructor(deps: PwaPanelDeps) {
    this.deps = deps;
    this.element = document.createElement('section');
    this.element.className = 'pwa-panel options-group';
    this.element.hidden = true;

    this.heading = document.createElement('h3');
    this.heading.className = 'pwa-title';
    this.offline = document.createElement('p');
    this.offline.className = 'pwa-offline';
    this.hint = document.createElement('p');
    this.hint.className = 'pwa-hint';
    this.button = document.createElement('button');
    this.button.type = 'button';
    this.button.className = 'backup-btn pwa-install';
    this.status = document.createElement('p');
    this.status.className = 'pwa-status';
    this.status.setAttribute('role', 'status');
    this.element.append(this.heading, this.offline, this.hint, this.button, this.status);

    this.button.addEventListener('click', () => void this.install());
    deps.prompt.onChange(() => this.refresh());
    this.refresh();
  }

  /** The service worker has stored the app: it works without internet from now on. */
  markOfflineReady(): void {
    this.offlineReady = true;
    this.refresh();
  }

  refresh(): void {
    this.heading.textContent = t('pwa.title');
    this.offline.textContent = this.offlineReady ? t('pwa.offlineReady') : '';
    this.offline.hidden = !this.offlineReady;
    const canInstall = this.deps.prompt.available();
    this.hint.textContent = t('pwa.installHint');
    this.hint.hidden = !canInstall;
    this.button.textContent = t('pwa.install');
    this.button.hidden = !canInstall;
    this.status.textContent = this.installed ? t('pwa.installed') : '';
    this.element.hidden = !(this.offlineReady || canInstall || this.installed);
  }

  private async install(): Promise<void> {
    const result = await this.deps.prompt.install();
    if (result === 'accepted') this.installed = true;
    this.refresh();
  }
}
