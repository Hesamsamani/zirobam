import { formatNumber, t } from '../i18n';

export type ToastKind = 'xp' | 'rank' | 'badge' | 'goal';

export interface ToastOptions {
  kind: ToastKind;
  title: string;
  detail?: string;
  durationMs?: number;
}

const MAX_TOASTS = 4;
const FADE_MS = 250;
const XP_MERGE_MS = 1800;

interface Live {
  el: HTMLElement;
  timer: ReturnType<typeof setTimeout>;
}

/** Short messages for rewards (XP, rank, badges, the daily goal) that fade away by themselves. */
export class ToastCenter {
  private readonly live: Live[] = [];
  private xp: { live: Live; amount: number } | null = null;

  private root(): HTMLElement {
    let region = document.getElementById('toasts');
    if (!region) {
      region = document.createElement('div');
      region.id = 'toasts';
      region.className = 'toasts';
      region.setAttribute('role', 'status');
      region.setAttribute('aria-live', 'polite');
      document.body.appendChild(region);
    }
    return region;
  }

  show(options: ToastOptions): HTMLElement {
    const region = this.root();
    const el = document.createElement('div');
    el.className = 'toast';
    el.dataset.kind = options.kind;
    const title = document.createElement('div');
    title.className = 'toast-title';
    title.textContent = options.title;
    el.appendChild(title);
    if (options.detail) {
      const detail = document.createElement('div');
      detail.className = 'toast-detail';
      detail.textContent = options.detail;
      el.appendChild(detail);
    }
    region.appendChild(el);

    const entry: Live = { el, timer: setTimeout(() => this.dismiss(entry), options.durationMs ?? 4200) };
    this.live.push(entry);
    while (this.live.length > MAX_TOASTS) this.dismiss(this.live[0], true);
    return el;
  }

  /** XP that comes in quick succession is added up into one toast instead of stacking. */
  showXp(amount: number): void {
    if (amount <= 0) return;
    const text = (n: number) => t('game.toast.xp', { n: formatNumber(n) });
    if (this.xp && this.live.includes(this.xp.live)) {
      this.xp.amount += amount;
      this.xp.live.el.querySelector('.toast-title')!.textContent = text(this.xp.amount);
      clearTimeout(this.xp.live.timer);
      this.xp.live.timer = setTimeout(() => this.dismiss(this.xp!.live), XP_MERGE_MS);
      return;
    }
    const el = this.show({ kind: 'xp', title: text(amount), durationMs: XP_MERGE_MS });
    const entry = this.live.find((l) => l.el === el)!;
    this.xp = { live: entry, amount };
  }

  clear(): void {
    for (const entry of [...this.live]) this.dismiss(entry, true);
  }

  private dismiss(entry: Live, immediately = false): void {
    const index = this.live.indexOf(entry);
    if (index < 0) return;
    this.live.splice(index, 1);
    clearTimeout(entry.timer);
    if (this.xp?.live === entry) this.xp = null;
    if (immediately) {
      entry.el.classList.add('leaving');
      entry.el.remove();
      return;
    }
    entry.el.classList.add('leaving');
    setTimeout(() => entry.el.remove(), FADE_MS);
  }
}
