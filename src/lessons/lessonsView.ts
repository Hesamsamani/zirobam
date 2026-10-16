import { createBackButton } from '../menu/backButton';
import { formatNumber, getLocale, t, type MessageKey } from '../i18n';
import { getNoteNameSystem } from '../i18n/noteNames';
import type { NotationToolkit } from '../learn/noteCard';
import { courseText } from './courseText';
import { UNITS, findLesson, neighbours, unitOf } from './curriculum';
import type { StaffExample } from './exampleXml';
import { renderBlock, type BlockContext } from './lessonBlocks';
import type { LessonProgress } from './lessonProgress';
import type { Lesson, LessonAction, Unit } from './types';

export interface LessonsViewDeps {
  /** The notation engine for the staff pictures. */
  toolkit: NotationToolkit | null;
  progress: LessonProgress;
  /** From the list back to the main menu. */
  onBack(): void;
  /** Shows a lesson (or the list for null); the page changes the address, then calls show(). */
  open(lessonId: string | null): void;
  /** The student wants to try what they read: go to the quiz, the levels and so on. */
  onAction(action: LessonAction): void;
  /** A lesson was marked as read. `firstTime` is false when it had been read before. */
  onRead?(lessonId: string, firstTime: boolean): void;
  playNote?(note: string): void;
  playExample?(spec: StaffExample, onDone: () => void): () => void;
}

const ACTION_LABEL: Readonly<Record<LessonAction, MessageKey>> = {
  quiz: 'menu.learn.title',
  levels: 'menu.levels.title',
  songs: 'menu.songs.title',
  metronome: 'menu.metronome.title',
  xylophone: 'menu.xylophone.title',
};

function make<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

function button(className: string, text: string, onClick: () => void): HTMLButtonElement {
  const el = make('button', className, text);
  el.type = 'button';
  el.addEventListener('click', onClick);
  return el;
}

/** A button with an arrow that points the other way in right-to-left text. */
function arrowButton(className: string, text: string, direction: 'back' | 'forward', onClick: () => void): HTMLButtonElement {
  const el = button(className, '', onClick);
  const arrow = make('span', `nav-arrow nav-arrow-${direction}`, direction === 'back' ? '‹' : '›');
  arrow.setAttribute('aria-hidden', 'true');
  const label = make('span', 'nav-label', text);
  el.append(...(direction === 'back' ? [arrow, label] : [label, arrow]));
  return el;
}

/** The lessons screen: the list of units and lessons, and one lesson at a time. */
export class LessonsView {
  readonly element: HTMLElement;
  private readonly deps: LessonsViewDeps;
  private readonly body: HTMLElement;
  private currentId: string | null = null;
  private notFound = false;
  private playing: { stop: () => void; reset: () => void } | null = null;

  constructor(deps: LessonsViewDeps) {
    this.deps = deps;
    this.element = make('section', 'lessons-view');
    this.element.id = 'lessonsView';
    this.element.dataset.views = 'lessons';
    this.body = make('div', 'lessons-body');
    this.element.appendChild(this.body);
    this.render(false);
  }

  /** Shows one lesson, or the list when `lessonId` is null or does not exist. */
  show(lessonId: string | null): void {
    this.stop();
    this.currentId = lessonId;
    this.notFound = lessonId !== null && findLesson(lessonId) === null;
    this.render(true);
  }

  /** Writes everything again after the language or the note names changed. */
  refresh(): void {
    this.stop();
    this.render(false);
  }

  /** Stops an example that is playing. Called when the lesson changes and when the screen is left. */
  stop(): void {
    const active = this.playing;
    this.playing = null;
    if (!active) return;
    active.stop();
    active.reset();
  }

  private render(moveFocus: boolean): void {
    const lesson = findLesson(this.currentId);
    if (lesson) this.renderLesson(lesson, moveFocus);
    else this.renderIndex();
    if (moveFocus) {
      const scroller = document.scrollingElement ?? document.documentElement;
      scroller.scrollTop = 0;
    }
  }

  // ----- the list -----

  private renderIndex(): void {
    const locale = getLocale();
    const { progress } = this.deps;

    const header = make('header', 'view-header');
    header.append(
      createBackButton(this.deps.onBack),
      make('h2', 'view-title', t('course.title')),
      make('p', 'view-subtitle', t('course.subtitle'))
    );

    const summary = make('section', 'course-summary');
    summary.appendChild(make('p', 'course-progress-text', t('course.progress', { n: progress.count(), total: progress.total() })));
    const bar = make('div', 'course-bar');
    bar.setAttribute('role', 'progressbar');
    bar.setAttribute('aria-valuemin', '0');
    bar.setAttribute('aria-valuemax', String(progress.total()));
    bar.setAttribute('aria-valuenow', String(progress.count()));
    bar.setAttribute('aria-label', t('course.title'));
    const fill = make('span', 'course-bar-fill');
    fill.style.width = `${Math.round((progress.count() / Math.max(1, progress.total())) * 100)}%`;
    bar.appendChild(fill);
    summary.appendChild(bar);

    const next = progress.firstUnread();
    if (next) {
      const lesson = findLesson(next)!;
      const label = progress.count() === 0 ? t('course.start') : t('course.continue', { title: courseText(lesson.title, locale) });
      summary.appendChild(button('course-continue', label, () => this.deps.open(next)));
    } else {
      summary.appendChild(make('p', 'course-done', t('course.finished')));
    }

    const list = make('div', 'course-list');
    for (const unit of UNITS) list.appendChild(this.buildUnit(unit));

    const parts: HTMLElement[] = [header];
    if (this.notFound) {
      const notice = make('p', 'course-notice', t('course.notFound'));
      notice.setAttribute('role', 'status');
      parts.push(notice);
    }
    parts.push(summary, list);
    this.body.replaceChildren(...parts);
    this.element.dataset.page = 'list';
  }

  private buildUnit(unit: Unit): HTMLElement {
    const locale = getLocale();
    const read = unit.lessons.filter((lesson) => this.deps.progress.isRead(lesson.id)).length;
    const section = make('section', 'course-unit');
    section.dataset.unit = unit.id;

    const head = make('header', 'course-unit-head');
    head.append(
      make('h3', 'course-unit-title', courseText(unit.title, locale)),
      make('p', 'course-unit-summary', courseText(unit.summary, locale)),
      make('p', 'course-unit-progress', t('course.unitProgress', { n: read, total: unit.lessons.length }))
    );

    const items = make('ol', 'lesson-cards');
    unit.lessons.forEach((lesson, index) => {
      const item = document.createElement('li');
      const card = make('button', 'lesson-card');
      card.type = 'button';
      card.dataset.lesson = lesson.id;
      if (this.deps.progress.isRead(lesson.id)) card.dataset.read = 'true';

      const number = make('span', 'lesson-card-num', formatNumber(index + 1));
      number.setAttribute('aria-hidden', 'true');
      const text = make('span', 'lesson-card-text');
      text.append(
        make('span', 'lesson-card-title', courseText(lesson.title, locale)),
        make('span', 'lesson-card-summary', courseText(lesson.summary, locale))
      );
      const meta = make('span', 'lesson-card-meta');
      meta.appendChild(make('span', 'lesson-card-time', t('course.minutes', { n: lesson.minutes })));
      if (card.dataset.read) meta.appendChild(make('span', 'lesson-card-read', t('course.read')));
      card.append(number, text, meta);
      card.addEventListener('click', () => this.deps.open(lesson.id));
      item.appendChild(card);
      items.appendChild(item);
    });

    section.append(head, items);
    return section;
  }

  // ----- one lesson -----

  private blockContext(): BlockContext {
    const { playExample } = this.deps;
    return {
      locale: getLocale(),
      system: getNoteNameSystem(),
      toolkit: this.deps.toolkit,
      playNote: this.deps.playNote,
      playExample: playExample
        ? (spec, onDone) => {
            this.stop(); // one example at a time
            const stop = playExample(spec, () => {
              this.playing = null;
              onDone();
            });
            this.playing = { stop, reset: onDone };
            return () => {
              this.playing = null;
              stop();
            };
          }
        : undefined,
    };
  }

  private renderLesson(lesson: Lesson, moveFocus: boolean): void {
    const locale = getLocale();
    const unit = unitOf(lesson);
    const position = unit.lessons.indexOf(lesson) + 1;
    const { previous, next } = neighbours(lesson.id);
    const isRead = this.deps.progress.isRead(lesson.id);

    const crumbs = make('nav', 'lesson-crumbs');
    crumbs.setAttribute('aria-label', t('course.title'));
    crumbs.appendChild(arrowButton('lesson-all back-btn', t('course.all'), 'back', () => this.deps.open(null)));
    const where = make('p', 'lesson-where');
    where.append(
      make('span', 'lesson-where-unit', courseText(unit.title, locale)),
      ' ',
      make('span', 'lesson-where-n', t('course.lessonOf', { n: position, total: unit.lessons.length })),
      ' ',
      make('span', 'lesson-where-time', t('course.minutes', { n: lesson.minutes }))
    );
    if (isRead) where.append(' ', make('span', 'lesson-read-mark', `✓ ${t('course.read')}`));
    crumbs.appendChild(where);

    const title = make('h2', 'lesson-title', courseText(lesson.title, locale));
    title.tabIndex = -1;

    const ctx = this.blockContext();
    const content = make('div', 'lesson-content');
    for (const block of lesson.blocks) content.appendChild(renderBlock(block, ctx));

    const page = make('article', 'lesson-page');
    page.dataset.lesson = lesson.id;
    page.dataset.unit = unit.id;
    page.append(crumbs, title, content);

    if (lesson.actions && lesson.actions.length > 0) {
      const tryIt = make('section', 'lesson-try');
      tryIt.appendChild(make('h3', 'lesson-try-title', t('course.try')));
      const row = make('div', 'lesson-try-row');
      for (const action of lesson.actions) {
        const go = button('lesson-try-btn', t(ACTION_LABEL[action]), () => this.deps.onAction(action));
        go.dataset.action = action;
        row.appendChild(go);
      }
      tryIt.appendChild(row);
      page.appendChild(tryIt);
    }

    const nav = make('nav', 'lesson-nav');
    nav.setAttribute('aria-label', t('course.title'));
    const prev = arrowButton('lesson-prev', t('course.prev'), 'back', () => previous && this.deps.open(previous.id));
    prev.disabled = !previous;
    const finishLesson = () => {
      const firstTime = this.deps.progress.markRead(lesson.id);
      this.deps.onRead?.(lesson.id, firstTime);
      this.deps.open(next ? next.id : null);
    };
    const forward = next
      ? arrowButton('lesson-next', t('course.next'), 'forward', finishLesson)
      : button('lesson-next', t('course.finish'), finishLesson);
    nav.append(prev, forward);
    page.appendChild(nav);

    this.body.replaceChildren(page);
    this.element.dataset.page = 'lesson';
    if (moveFocus) title.focus({ preventScroll: true });
  }
}

