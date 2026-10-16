import { t, usesPersianDigits, type Locale } from '../i18n';
import { toPersianDigits } from '../i18n/digits';
import { formatNoteName, type NoteNameSystem } from '../i18n/noteNames';
import type { NotationToolkit } from '../learn/noteCard';
import { courseText, resolveNoteTokens } from './courseText';
import type { StaffExample } from './exampleXml';
import { buildFingersPicture } from './fingersPicture';
import { buildKeysPicture } from './keysPicture';
import { renderStaffPicture } from './staffPicture';
import type { Bi, Block } from './types';

export interface BlockContext {
  locale: Locale;
  system: NoteNameSystem;
  /** The notation engine. Without it the staff pictures stay empty (tests). */
  toolkit: NotationToolkit | null;
  /** Sounds one key of a keyboard picture. */
  playNote?(note: string): void;
  /** Plays an example. `onDone` is called when it ends; the returned function stops it early. */
  playExample?(spec: StaffExample, onDone: () => void): () => void;
}

function make<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

/** Digits follow the language: Persian digits in Persian text when the setting is on. */
function digits(text: string): string {
  return usesPersianDigits() ? toPersianDigits(text) : text;
}

function figure(kind: string): HTMLElement {
  const el = make('figure', `lesson-figure lesson-fig-${kind}`);
  el.dataset.kind = kind;
  return el;
}

function addCaption(parent: HTMLElement, caption: Bi | undefined, ctx: BlockContext): void {
  if (!caption) return;
  parent.appendChild(make('figcaption', 'lesson-caption', courseText(caption, ctx.locale, ctx.system)));
}

function staffFigure(block: Extract<Block, { type: 'staff' }>, ctx: BlockContext): HTMLElement {
  const root = figure('staff');
  const holder = make('div', 'lesson-staff');
  holder.setAttribute('dir', 'ltr');
  root.appendChild(holder);

  if (ctx.toolkit) {
    renderStaffPicture(holder, {
      toolkit: ctx.toolkit,
      spec: block.spec,
      names: block.names ?? false,
      formatName: (note, withOctave) => {
        const name = formatNoteName(note, ctx.system, { octave: withOctave });
        return withOctave && ctx.system === 'solfege-fa' ? digits(name) : name;
      },
      description: t('course.staffLabel'),
    });
  }

  const { playExample } = ctx;
  if (block.listen && playExample) {
    const button = make('button', 'lesson-play', t('course.play'));
    button.type = 'button';
    button.setAttribute('aria-pressed', 'false');
    let stop: (() => void) | null = null;
    const reset = () => {
      stop = null;
      button.textContent = t('course.play');
      button.setAttribute('aria-pressed', 'false');
    };
    button.addEventListener('click', () => {
      if (stop) {
        const cancel = stop;
        reset();
        cancel();
        return;
      }
      button.textContent = t('course.stop');
      button.setAttribute('aria-pressed', 'true');
      stop = playExample(block.spec, reset);
    });
    root.appendChild(button);
  }
  addCaption(root, block.caption, ctx);
  return root;
}

function keysFigure(block: Extract<Block, { type: 'keys' }>, ctx: BlockContext): HTMLElement {
  const root = figure('keys');
  root.appendChild(
    buildKeysPicture({
      from: block.from,
      to: block.to,
      names: block.names ?? 'none',
      marks: block.marks,
      formatName: (note) => formatNoteName(note, ctx.system),
      formatMark: (text) => digits(resolveNoteTokens(text, ctx.system)),
      onPlay: ctx.playNote,
      ariaLabel: t('course.keysLabel'),
    })
  );
  addCaption(root, block.caption, ctx);
  return root;
}

function fingersFigure(block: Extract<Block, { type: 'fingers' }>, ctx: BlockContext): HTMLElement {
  const root = figure('fingers');
  root.appendChild(
    buildFingersPicture({
      ariaLabel: t('course.handsLabel'),
      left: t('course.leftHand'),
      right: t('course.rightHand'),
      formatNumber: (n) => digits(String(n)),
    })
  );
  addCaption(root, block.caption, ctx);
  return root;
}

/** Builds the page element for one block of a lesson. */
export function renderBlock(block: Block, ctx: BlockContext): HTMLElement {
  const text = (bi: Bi) => courseText(bi, ctx.locale, ctx.system);
  switch (block.type) {
    case 'text':
      return make('p', 'lesson-p', text(block.text));
    case 'heading':
      return make('h3', 'lesson-h', text(block.text));
    case 'tip': {
      const el = make('aside', 'lesson-tip');
      el.setAttribute('role', 'note');
      el.append(make('strong', 'lesson-tip-label', t('course.tip')), make('span', 'lesson-tip-text', text(block.text)));
      return el;
    }
    case 'list': {
      const ul = make('ul', 'lesson-list');
      for (const item of block.items) ul.appendChild(make('li', 'lesson-li', text(item)));
      return ul;
    }
    case 'terms': {
      const dl = make('dl', 'lesson-terms');
      for (const item of block.items) {
        const row = make('div', 'lesson-term');
        row.append(make('dt', 'lesson-term-symbol', digits(item.symbol)), make('dd', 'lesson-term-text', text(item.text)));
        dl.appendChild(row);
      }
      return dl;
    }
    case 'staff':
      return staffFigure(block, ctx);
    case 'keys':
      return keysFigure(block, ctx);
    case 'fingers':
      return fingersFigure(block, ctx);
  }
}
