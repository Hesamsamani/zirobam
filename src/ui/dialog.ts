import { t } from '../i18n';

export interface DialogOptions {
  /** The heading; it also names the dialog for screen readers. */
  title: string;
  body: HTMLElement;
  /** An extra class, for the styles of one feature. */
  className?: string;
  /** Called once after the dialog has closed, however it was closed. */
  onClose?: () => void;
}

export interface DialogHandle {
  readonly element: HTMLDialogElement;
  close(): void;
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

let counter = 0;

function focusables(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => !el.closest('[hidden]'));
}

/**
 * A modal dialog: it traps Tab, closes with Escape, the Close button or a click on the backdrop,
 * and gives the focus back to what opened it. Uses the native `showModal()` where there is one.
 */
export function openDialog(options: DialogOptions): DialogHandle {
  const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;

  const dialog = document.createElement('dialog');
  dialog.className = options.className ? `app-dialog ${options.className}` : 'app-dialog';
  dialog.setAttribute('aria-modal', 'true');

  const heading = document.createElement('h2');
  heading.className = 'app-dialog-title';
  heading.id = `appDialogTitle${++counter}`;
  heading.textContent = options.title;
  dialog.setAttribute('aria-labelledby', heading.id);

  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.className = 'app-dialog-close';
  closeButton.textContent = t('dialog.close');

  const header = document.createElement('header');
  header.className = 'app-dialog-header';
  header.append(heading, closeButton);

  const content = document.createElement('div');
  content.className = 'app-dialog-body';
  content.append(options.body);

  // the panel fills the dialog, so a click that lands on the dialog itself is a click on the backdrop
  const panel = document.createElement('div');
  panel.className = 'app-dialog-panel';
  panel.append(header, content);
  dialog.append(panel);

  let closed = false;
  const close = (): void => {
    if (closed) return;
    closed = true;
    if (typeof dialog.close === 'function' && dialog.open) dialog.close();
    dialog.remove();
    if (opener?.isConnected) opener.focus();
    options.onClose?.();
  };

  closeButton.addEventListener('click', close);
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) close();
  });
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    close();
  });
  // a native dialog can also be closed from inside (<form method="dialog">)
  dialog.addEventListener('close', close);
  dialog.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
      return;
    }
    if (event.key !== 'Tab') return;
    const items = focusables(dialog);
    if (items.length === 0) {
      event.preventDefault();
      return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    const outside = !dialog.contains(active);
    if (event.shiftKey && (active === first || outside)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (active === last || outside)) {
      event.preventDefault();
      first.focus();
    }
  });

  document.body.append(dialog);
  if (typeof dialog.showModal === 'function') dialog.showModal();
  else dialog.setAttribute('open', '');
  (focusables(options.body)[0] ?? closeButton).focus();

  return { element: dialog, close };
}
