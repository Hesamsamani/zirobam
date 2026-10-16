import { getLocale, t, type MessageKey } from '../i18n';
import { checkBackup, type BackupFile, type CheckResult, type RestoreResult } from './backup';

export interface BackupPanelDeps {
  /** Gathers the progress, settings and scores into a backup. */
  create(): Promise<BackupFile>;
  /** Writes a checked backup back. */
  restore(backup: BackupFile): Promise<RestoreResult>;
  /** Offers a file to the student: the file name and its text. */
  download(fileName: string, text: string): void;
  fileName(): string;
  /** Opens the page again, so the restored progress shows everywhere. */
  reload(): void;
}

/** A piece of the options panel or of a screen: save a backup file, restore one after a check and a question. */
export class BackupPanel {
  readonly element: HTMLElement;
  private readonly deps: BackupPanelDeps;
  private readonly heading: HTMLElement;
  private readonly hint: HTMLElement;
  private readonly saveButton: HTMLButtonElement;
  private readonly restoreButton: HTMLButtonElement;
  private readonly input: HTMLInputElement;
  private readonly status: HTMLElement;
  private readonly ask: HTMLElement;
  /** The file that is waiting for the student's answer. */
  private pending: Extract<CheckResult, { ok: true }> | null = null;

  /** `inOptions` gives the panel the look of a group of the options panel. */
  constructor(deps: BackupPanelDeps, inOptions = false) {
    this.deps = deps;
    this.element = document.createElement('section');
    this.element.className = inOptions ? 'backup-panel options-group' : 'backup-panel';

    this.heading = document.createElement('h3');
    this.heading.className = 'backup-title';
    this.hint = document.createElement('p');
    this.hint.className = 'backup-hint';

    this.saveButton = document.createElement('button');
    this.saveButton.type = 'button';
    this.saveButton.className = 'backup-btn backup-save';
    this.restoreButton = document.createElement('button');
    this.restoreButton.type = 'button';
    this.restoreButton.className = 'backup-btn backup-restore';
    const buttons = document.createElement('div');
    buttons.className = 'backup-buttons';
    buttons.append(this.saveButton, this.restoreButton);

    this.input = document.createElement('input');
    this.input.type = 'file';
    this.input.accept = '.json,application/json';
    this.input.hidden = true;
    this.input.className = 'backup-file';

    this.status = document.createElement('p');
    this.status.className = 'backup-status';
    this.status.setAttribute('role', 'status');
    this.ask = document.createElement('div');
    this.ask.className = 'backup-ask';
    this.ask.setAttribute('role', 'group');
    this.ask.hidden = true;

    this.element.append(this.heading, this.hint, buttons, this.input, this.ask, this.status);

    this.saveButton.addEventListener('click', () => void this.save());
    this.restoreButton.addEventListener('click', () => {
      this.input.value = ''; // the same file can be chosen twice in a row
      this.input.click();
    });
    this.input.addEventListener('change', () => {
      const file = this.input.files?.[0];
      if (file) void this.choose(file);
    });
    this.refresh();
  }

  /** Writes the texts again, after the language changed. */
  refresh(): void {
    this.heading.textContent = t('backup.title');
    this.hint.textContent = t('backup.hint');
    this.saveButton.textContent = t('backup.save');
    this.restoreButton.textContent = t('backup.restore');
    if (this.pending) this.showQuestion(this.pending);
  }

  private say(key: MessageKey | '', params?: Record<string, string | number>): void {
    this.status.textContent = key === '' ? '' : t(key, params);
  }

  private async save(): Promise<void> {
    this.hideQuestion();
    try {
      const backup = await this.deps.create();
      this.deps.download(this.deps.fileName(), JSON.stringify(backup));
      this.say('backup.saved', { settings: Object.keys(backup.storage).length, scores: backup.scores.length });
    } catch {
      this.say('backup.err.failed');
    }
  }

  private async choose(file: File): Promise<void> {
    this.hideQuestion();
    this.say('');
    let text: string;
    try {
      text = await file.text();
    } catch {
      this.say('backup.err.read');
      return;
    }
    const checked = checkBackup(text);
    if (!checked.ok) {
      this.say(`backup.err.${checked.reason === 'notJson' ? 'notBackup' : checked.reason}` as MessageKey);
      return;
    }
    if (checked.summary.settings === 0 && checked.summary.scores === 0) {
      this.say('backup.err.nothing');
      return;
    }
    this.pending = checked;
    this.showQuestion(checked);
  }

  private showQuestion(checked: Extract<CheckResult, { ok: true }>): void {
    const { settings, scores, exportedAt } = checked.summary;
    const date = exportedAt ? new Date(exportedAt).toLocaleDateString(getLocale() === 'fa' ? 'fa-IR' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
    const text = document.createElement('p');
    text.className = 'backup-ask-text';
    text.textContent = date ? t('backup.confirmDated', { date, settings, scores }) : t('backup.confirm', { settings, scores });
    const yes = document.createElement('button');
    yes.type = 'button';
    yes.className = 'backup-btn backup-yes';
    yes.textContent = t('backup.confirmYes');
    yes.addEventListener('click', () => void this.apply(checked));
    const no = document.createElement('button');
    no.type = 'button';
    no.className = 'backup-btn backup-no';
    no.textContent = t('backup.confirmNo');
    no.addEventListener('click', () => this.hideQuestion());
    this.ask.replaceChildren(text, yes, no);
    this.ask.hidden = false;
    no.focus();
  }

  private hideQuestion(): void {
    this.pending = null;
    this.ask.hidden = true;
    this.ask.replaceChildren();
  }

  private async apply(checked: Extract<CheckResult, { ok: true }>): Promise<void> {
    this.hideQuestion();
    try {
      const result = await this.deps.restore(checked.backup);
      this.status.textContent = t('backup.done', { settings: result.settings, scores: result.scores });
      if (result.skipped > 0) this.status.textContent += ` ${t('backup.skipped', { n: result.skipped })}`;
      this.deps.reload();
    } catch {
      this.say('backup.err.damaged');
    }
  }
}
