let hideTimer: ReturnType<typeof setTimeout> | null = null;

function noticeElement(): HTMLElement {
  let el = document.getElementById('notice');
  if (!el) {
    el = document.createElement('div');
    el.id = 'notice';
    el.className = 'notice';
    el.hidden = true;
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    document.body.appendChild(el);
  }
  return el;
}

/** A short message at the bottom of the screen that fades after a few seconds. Screen readers announce it. */
export function showNotice(message: string, durationMs = 6000): void {
  const el = noticeElement();
  el.textContent = message;
  el.hidden = false;
  if (hideTimer) clearTimeout(hideTimer);
  hideTimer = setTimeout(hideNotice, durationMs);
}

export function hideNotice(): void {
  if (hideTimer) clearTimeout(hideTimer);
  hideTimer = null;
  const el = document.getElementById('notice');
  if (el) el.hidden = true;
}
