import { t, type MessageKey } from '../i18n';

/** The "back to menu" button at the top of every screen except the menu itself. It follows the language by itself. */
export function createBackButton(onBack: () => void, labelKey: MessageKey = 'menu.back'): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'back-btn';

  const arrow = document.createElement('span');
  arrow.className = 'back-arrow';
  arrow.setAttribute('aria-hidden', 'true');
  arrow.textContent = '‹';

  const label = document.createElement('span');
  label.dataset.i18n = labelKey;
  label.textContent = t(labelKey);

  button.append(arrow, label);
  button.addEventListener('click', onBack);
  return button;
}
