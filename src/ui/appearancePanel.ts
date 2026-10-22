import { ACCENTS, isAccent, isThemeChoice, type Accent, type Appearance } from './appearance';

/**
 * Wires the Appearance group of the settings panel (the markup is in index.html, next to the other groups, so its
 * texts follow the language like theirs): the theme list and the six accent swatches, which are a radio group.
 */
export function bindAppearance(appearance: Appearance, root: ParentNode = document): void {
  const select = root.querySelector<HTMLSelectElement>('#themeSelect');
  const swatches = Array.from(root.querySelectorAll<HTMLButtonElement>('.accent-swatches [data-accent]'));
  if (!select || swatches.length === 0) return;

  const sync = (): void => {
    select.value = appearance.choice();
    for (const swatch of swatches) {
      const chosen = swatch.dataset.accent === appearance.accent();
      swatch.setAttribute('aria-checked', String(chosen));
      swatch.tabIndex = chosen ? 0 : -1;
    }
  };

  select.addEventListener('change', () => {
    if (isThemeChoice(select.value)) appearance.setTheme(select.value);
  });

  for (const swatch of swatches) {
    swatch.addEventListener('click', () => {
      const accent = swatch.dataset.accent;
      if (isAccent(accent)) appearance.setAccent(accent);
    });
    swatch.addEventListener('keydown', (event) => {
      const rtl = swatch.ownerDocument.documentElement.dir === 'rtl';
      const forward = rtl ? 'ArrowLeft' : 'ArrowRight';
      const backward = rtl ? 'ArrowRight' : 'ArrowLeft';
      const at = swatches.indexOf(swatch);
      let to = -1;
      if (event.key === forward || event.key === 'ArrowDown') to = (at + 1) % swatches.length;
      else if (event.key === backward || event.key === 'ArrowUp') to = (at - 1 + swatches.length) % swatches.length;
      else if (event.key === 'Home') to = 0;
      else if (event.key === 'End') to = swatches.length - 1;
      if (to < 0) return;
      event.preventDefault();
      const accent: Accent | undefined = ACCENTS[to];
      if (accent) appearance.setAccent(accent);
      swatches[to].focus();
    });
  }

  appearance.onChange(sync);
  sync();
}
