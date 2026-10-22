import type { View } from '../app/router';
import { t, type Locale, type MessageKey } from '../i18n';
import type { Theme } from '../ui/appearance';
import { makeIcon } from '../ui/icons';
import { NAV_GROUPS, NAV_ITEMS, RAIL_QUERY, navIdForView, type NavId, type NavItem } from './navItems';

export type NavMode = 'rail' | 'drawer';

/** The strip the rail takes at the side of the page (a 64px rail, 12px from the edge, and a 12px gap): `--rail-space` in `nav.css`. */
export const RAIL_SPACE_PX = 88;

export interface SideNavDeps {
  doc?: Document;
  /** For the tests. Defaults to `window.matchMedia`. */
  matchMedia?(query: string): MediaQueryList;
  /** The address of a screen, for example `#/lessons`. */
  hrefOf(view: View): string;
  /** Opens the floating metronome. Runs straight from the click, as browsers require. */
  openMetronome(): void;
  /** Opens or closes the Settings panel. `opener` is the button, so the panel can give the focus back to it. */
  toggleSettings(opener: HTMLElement): void;
  toggleLanguage(): void;
  toggleTheme(): void;
  locale(): Locale;
  theme(): Theme;
}

function make<K extends keyof HTMLElementTagNameMap>(doc: Document, tag: K, className: string): HTMLElementTagNameMap[K] {
  const el = doc.createElement(tag);
  el.className = className;
  return el;
}

const SVG_NS = 'http://www.w3.org/2000/svg';

/** The mark of ZiroBam: a heavy Z (treble above, bass below) with a notehead where the diagonal lands. The colours are in nav.css. */
function brandMark(doc: Document): SVGSVGElement {
  const svg = doc.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '8 8 48 48');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.classList.add('nav-mark');
  const z = doc.createElementNS(SVG_NS, 'polygon');
  z.setAttribute('points', '12,14 52,14 52,23 28,41 52,41 52,50 12,50 12,41 36,23 12,23');
  z.setAttribute('class', 'mark-z');
  const note = doc.createElementNS(SVG_NS, 'ellipse');
  note.setAttribute('cx', '19.5');
  note.setAttribute('cy', '45.5');
  note.setAttribute('rx', '7.4');
  note.setAttribute('ry', '5.4');
  note.setAttribute('transform', 'rotate(-22 19.5 45.5)');
  note.setAttribute('class', 'mark-note');
  svg.append(z, note);
  return svg;
}

/**
 * The navigation that stays on every screen: a slim rail of icons at the edge of the page that widens over the page
 * (it does not push it) when the pointer or the keyboard focus is on it, and on a phone a drawer that opens from a
 * handle at the edge. At its foot are the quick buttons for the language and the theme, and Settings.
 */
export class SideNav {
  readonly element: HTMLElement;
  readonly handle: HTMLButtonElement;
  readonly scrim: HTMLElement;
  private readonly doc: Document;
  private readonly deps: SideNavDeps;
  private readonly query: MediaQueryList | null;
  private readonly skip: HTMLButtonElement;
  private readonly scroll: HTMLElement;
  private readonly brand: HTMLButtonElement;
  private readonly brandLabel: HTMLElement;
  private readonly groups = new Map<string, HTMLElement>();
  private readonly items = new Map<NavId, { root: HTMLElement; label: HTMLElement; item: NavItem }>();
  private readonly languageButton: HTMLButtonElement;
  private readonly languageLabel: HTMLElement;
  private readonly themeButton: HTMLButtonElement;
  private readonly themeIcon: HTMLElement;
  private readonly themeLabel: HTMLElement;
  private readonly settingsButton: HTMLButtonElement;
  private readonly settingsLabel: HTMLElement;
  private modeNow: NavMode = 'rail';
  private drawerOpen = false;
  private pinned = false;
  private currentId: NavId | null = null;
  private resizeObserver: ResizeObserver | null = null;

  constructor(deps: SideNavDeps) {
    this.deps = deps;
    this.doc = deps.doc ?? document;
    const doc = this.doc;
    const matchMedia = deps.matchMedia ?? (typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia.bind(window) : undefined);
    this.query = matchMedia ? matchMedia(RAIL_QUERY) : null;

    this.element = make(doc, 'nav', 'side-nav');
    this.element.id = 'sideNav';

    this.skip = make(doc, 'button', 'nav-skip');
    this.skip.type = 'button';
    this.skip.addEventListener('click', () => this.skipToContent());

    this.brand = make(doc, 'button', 'nav-brand');
    this.brand.type = 'button';
    const brandIcon = make(doc, 'span', 'nav-icon');
    brandIcon.append(brandMark(doc));
    this.brandLabel = make(doc, 'span', 'nav-label nav-wordmark');
    this.brand.append(brandIcon, this.brandLabel);
    this.brand.addEventListener('click', () => {
      if (this.modeNow === 'drawer') this.closeDrawer(true);
      else {
        this.pinned = !this.pinned;
        this.syncBrand();
      }
    });

    const scroll = make(doc, 'div', 'nav-scroll');
    this.scroll = scroll;
    scroll.dataset.fade = 'none';
    scroll.addEventListener('scroll', () => this.syncFade());
    for (const group of NAV_GROUPS) {
      const box = make(doc, 'div', 'nav-group');
      box.setAttribute('role', 'group');
      this.groups.set(group, box);
      for (const item of NAV_ITEMS.filter((i) => i.group === group)) box.append(this.buildItem(item));
      scroll.append(box);
    }

    const foot = make(doc, 'div', 'nav-foot');
    const language = this.buildQuick('language');
    this.languageButton = language.button;
    this.languageLabel = language.label;
    this.languageButton.addEventListener('click', () => this.deps.toggleLanguage());
    const theme = this.buildQuick('theme');
    this.themeButton = theme.button;
    this.themeIcon = theme.icon;
    this.themeLabel = theme.label;
    this.themeButton.addEventListener('click', () => this.deps.toggleTheme());
    const settings = this.buildQuick('settings');
    this.settingsButton = settings.button;
    this.settingsLabel = settings.label;
    this.settingsButton.setAttribute('aria-controls', 'optionsPanel');
    this.settingsButton.setAttribute('aria-expanded', 'false');
    settings.icon.append(makeIcon('settings'));
    this.settingsButton.addEventListener('click', () => {
      this.deps.toggleSettings(this.settingsButton);
      this.closeDrawer(false);
    });
    foot.append(this.languageButton, this.themeButton, this.settingsButton);

    this.element.append(this.skip, this.brand, scroll, foot);

    this.handle = make(doc, 'button', 'nav-handle');
    this.handle.type = 'button';
    this.handle.setAttribute('aria-controls', 'sideNav');
    this.handle.setAttribute('aria-expanded', 'false');
    this.handle.append(makeIcon('chevron'));
    this.handle.addEventListener('click', () => (this.drawerOpen ? this.closeDrawer(true) : this.openDrawer()));

    this.scrim = make(doc, 'div', 'nav-scrim');
    this.scrim.hidden = true;
    this.scrim.addEventListener('click', () => this.closeDrawer(true));

    this.doc.addEventListener('keydown', this.onKey);
    this.query?.addEventListener('change', this.onDevice);
    // the list is longer than a laptop screen: its edges fade where there is more, and it follows a change of size
    const view = this.doc.defaultView;
    if (view && typeof view.ResizeObserver === 'function') {
      this.resizeObserver = new view.ResizeObserver(() => this.syncFade());
      this.resizeObserver.observe(scroll);
    }
    this.modeNow = this.query?.matches === false ? 'drawer' : 'rail';
    this.refresh();
  }

  /** Puts the rail, the handle and the scrim on the page. The rail comes first, so it is the first thing a keyboard reaches. */
  mount(parent: HTMLElement = this.doc.body): void {
    parent.prepend(this.element);
    parent.append(this.handle, this.scrim);
    this.applyMode();
  }

  destroy(): void {
    this.doc.removeEventListener('keydown', this.onKey);
    this.query?.removeEventListener('change', this.onDevice);
    this.resizeObserver?.disconnect();
  }

  mode(): NavMode {
    return this.modeNow;
  }

  isDrawerOpen(): boolean {
    return this.drawerOpen;
  }

  /** How much room the rail takes at each side of the page (zero while it is a drawer), for the things that float above the page. */
  reservedInsets(): { left: number; right: number } {
    if (this.modeNow !== 'rail') return { left: 0, right: 0 };
    return this.doc.documentElement.dir === 'rtl' ? { left: 0, right: RAIL_SPACE_PX } : { left: RAIL_SPACE_PX, right: 0 };
  }

  /** Marks the place of the screen that is shown. */
  setCurrent(view: View): void {
    this.currentId = navIdForView(view);
    for (const [id, entry] of this.items) {
      if (id === this.currentId) entry.root.setAttribute('aria-current', 'page');
      else entry.root.removeAttribute('aria-current');
    }
    // the list may be longer than the screen: the place you are at is always one you can see
    if (this.currentId) this.keepInView(this.items.get(this.currentId)!.root);
  }

  openDrawer(): void {
    if (this.modeNow !== 'drawer' || this.drawerOpen) return;
    this.drawerOpen = true;
    this.element.dataset.open = 'true';
    this.element.removeAttribute('inert');
    this.scrim.hidden = false;
    this.doc.getElementById('app')?.setAttribute('inert', '');
    this.doc.body.classList.add('nav-locked');
    this.handle.setAttribute('aria-expanded', 'true');
    this.syncBrand();
    (this.items.get(this.currentId ?? 'home')?.root ?? this.items.get('home')!.root).focus();
  }

  closeDrawer(restoreFocus: boolean): void {
    if (!this.drawerOpen) return;
    this.drawerOpen = false;
    this.element.dataset.open = 'false';
    this.scrim.hidden = true;
    this.doc.getElementById('app')?.removeAttribute('inert');
    this.doc.body.classList.remove('nav-locked');
    this.handle.setAttribute('aria-expanded', 'false');
    this.element.toggleAttribute('inert', this.modeNow === 'drawer');
    this.syncBrand();
    if (restoreFocus) this.handle.focus();
  }

  /** Writes the texts again, after the language or the theme changed. */
  refresh(): void {
    const label = (key: MessageKey) => t(key);
    this.element.setAttribute('aria-label', label('nav.label'));
    this.skip.textContent = label('nav.skip');
    this.brandLabel.textContent = label('menu.title');
    this.handle.setAttribute('aria-label', label('nav.open'));
    for (const [group, box] of this.groups) box.setAttribute('aria-label', label(`nav.group.${group}` as MessageKey));
    for (const { label: el, item } of this.items.values()) el.textContent = label(item.label);

    // the language button names the language it would switch to, in that language
    const toPersian = this.deps.locale() === 'en';
    this.languageLabel.textContent = toPersian ? 'فارسی' : 'English';
    this.languageLabel.setAttribute('lang', toPersian ? 'fa' : 'en');
    this.languageButton.setAttribute('title', label(toPersian ? 'nav.language.toFa' : 'nav.language.toEn'));

    const next = this.deps.theme() === 'dark' ? 'light' : 'dark';
    this.themeButton.dataset.next = next;
    this.themeIcon.replaceChildren(makeIcon(next === 'light' ? 'sun' : 'moon'));
    this.themeLabel.textContent = label(next === 'light' ? 'nav.theme.toLight' : 'nav.theme.toDark');

    this.settingsLabel.textContent = label('menu.settings.title');
    this.syncBrand();
  }

  private buildItem(item: NavItem): HTMLElement {
    const doc = this.doc;
    let root: HTMLElement;
    if ('view' in item.target) {
      const link = make(doc, 'a', 'nav-item');
      link.href = this.deps.hrefOf(item.target.view);
      link.addEventListener('click', () => this.closeDrawer(false));
      root = link;
    } else {
      const button = make(doc, 'button', 'nav-item');
      button.type = 'button';
      button.addEventListener('click', () => {
        this.deps.openMetronome();
        this.closeDrawer(false);
      });
      root = button;
    }
    root.dataset.nav = item.id;
    const icon = make(doc, 'span', 'nav-icon');
    icon.append(makeIcon(item.icon));
    const label = make(doc, 'span', 'nav-label');
    root.append(icon, label);
    this.items.set(item.id, { root, label, item });
    return root;
  }

  private buildQuick(action: 'language' | 'theme' | 'settings') {
    const button = make(this.doc, 'button', 'nav-item nav-quick');
    button.type = 'button';
    button.dataset.navAction = action;
    const icon = make(this.doc, 'span', 'nav-icon');
    if (action === 'language') icon.append(makeIcon('language'));
    const label = make(this.doc, 'span', 'nav-label');
    button.append(icon, label);
    return { button, icon, label };
  }

  private skipToContent(): void {
    // the title of the screen that is shown: an h1 on the home screen and the stand, an h2 on the other screens
    const heading = Array.from(this.doc.querySelectorAll<HTMLElement>('h1, h2')).find((h) => !h.closest('.view-hidden, [hidden], #sideNav, #optionsPanel'));
    if (!heading) return;
    heading.tabIndex = -1;
    heading.focus();
  }

  /**
   * Scrolls the list just enough to show `el`. It does not use `scrollIntoView`: that also moves the starting point
   * of the next Tab press to `el`, and the first stop of the rail would no longer be the first.
   */
  private keepInView(el: HTMLElement): void {
    const list = this.scroll.getBoundingClientRect();
    const box = el.getBoundingClientRect();
    const room = 8;
    if (box.bottom > list.bottom) this.scroll.scrollTop += box.bottom - list.bottom + room;
    else if (box.top < list.top) this.scroll.scrollTop -= list.top - box.top + room;
  }

  /** Says which edge of the list has more behind it (`data-fade` is none, top, bottom or both), for the fade at that edge. */
  private syncFade(): void {
    const { scrollTop, clientHeight, scrollHeight } = this.scroll;
    const more = scrollHeight - clientHeight > 1;
    const above = more && scrollTop > 1;
    const below = more && scrollTop + clientHeight < scrollHeight - 1;
    this.scroll.dataset.fade = above && below ? 'both' : above ? 'top' : below ? 'bottom' : 'none';
  }

  /** The brand button pins the rail open (rail) or closes the drawer (drawer). */
  private syncBrand(): void {
    this.element.dataset.pinned = String(this.pinned);
    if (this.modeNow === 'drawer') {
      this.brand.removeAttribute('aria-expanded');
      this.brand.setAttribute('aria-label', t('nav.close'));
    } else {
      this.brand.setAttribute('aria-expanded', String(this.pinned));
      this.brand.setAttribute('aria-label', t(this.pinned ? 'nav.collapse' : 'nav.expand'));
    }
  }

  private applyMode(): void {
    const mode: NavMode = this.query?.matches === false ? 'drawer' : 'rail';
    if (mode !== this.modeNow) {
      if (this.drawerOpen) this.closeDrawer(false);
      this.modeNow = mode;
    }
    this.doc.body.dataset.nav = mode;
    this.element.dataset.mode = mode;
    this.handle.hidden = mode === 'rail';
    this.element.toggleAttribute('inert', mode === 'drawer' && !this.drawerOpen);
    this.syncBrand();
    this.syncFade();
  }

  private readonly onDevice = (): void => this.applyMode();

  private readonly onKey = (event: KeyboardEvent): void => {
    if (event.key === 'Escape' && this.drawerOpen) this.closeDrawer(true);
  };
}
