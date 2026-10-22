import { onLocaleChange, t } from '../i18n';

let current: { element: HTMLElement; stop: () => void } | null = null;

/**
 * "A new version of ZiroBam is ready", with Reload and Later. A polite status message that stays until it is answered:
 * the new version does not take over a page that is being used unless the person says so (see `updateWatcher.ts`).
 */
export function showUpdateBanner(apply: () => void): void {
  if (current) {
    if (current.element.isConnected) return;
    current.stop(); // it was removed from the page by someone else
  }
  const element = document.createElement('div');
  element.className = 'update-banner';
  element.setAttribute('role', 'status');
  const text = document.createElement('span');
  text.className = 'update-text';
  const actions = document.createElement('div');
  actions.className = 'update-actions';
  const reload = document.createElement('button');
  reload.type = 'button';
  reload.className = 'update-reload';
  const later = document.createElement('button');
  later.type = 'button';
  later.className = 'update-later';
  actions.append(reload, later);
  element.append(text, actions);

  const write = (): void => {
    text.textContent = t('pwa.update.ready');
    reload.textContent = t('pwa.update.reload');
    later.textContent = t('pwa.update.later');
  };
  write();
  const stopLocale = onLocaleChange(write);

  const close = (): void => {
    stopLocale();
    element.remove();
    current = null;
  };
  reload.addEventListener('click', () => {
    if (reload.disabled) return;
    reload.disabled = true;
    element.setAttribute('aria-busy', 'true');
    apply();
  });
  later.addEventListener('click', close);

  document.body.append(element);
  current = { element, stop: close };
}
