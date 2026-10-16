import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BackupPanel, type BackupPanelDeps } from '../backup/backupView';
import { BACKUP_APP, type BackupFile } from '../backup/backup';
import { initLocale, setLocale } from '../i18n';

const backup = (over: Partial<BackupFile> = {}): BackupFile => ({
  app: BACKUP_APP,
  version: 1,
  exportedAt: '2026-10-16T10:00:00.000Z',
  storage: { 'game.v1': '{}', 'ui.locale': 'fa' },
  scores: [{ id: 'maker-1', title: 'Tune', kind: 'maker', addedAt: 1, content: { encoding: 'text', data: '<x/>' } }],
  ...over,
});

function setup(over: Partial<BackupPanelDeps> = {}) {
  const deps: BackupPanelDeps = {
    create: vi.fn(async () => backup()),
    restore: vi.fn(async () => ({ settings: 2, scores: 1, skipped: 0 })),
    download: vi.fn(),
    fileName: () => 'music-notes-trainer-backup-2026-10-16.json',
    reload: vi.fn(),
    ...over,
  };
  const panel = new BackupPanel(deps);
  document.body.replaceChildren(panel.element);
  return { panel, deps };
}

const $ = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector)!;
const flush = async () => {
  for (let i = 0; i < 10; i++) await Promise.resolve();
};

/** A file the panel can read; jsdom's File has no text(), so a small stand-in is used. */
function chooseFile(content: string, name = 'backup.json') {
  const input = $<HTMLInputElement>('.backup-file');
  const file = { name, text: async () => content } as unknown as File;
  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  input.dispatchEvent(new Event('change'));
}

beforeEach(() => {
  localStorage.clear();
  initLocale();
  setLocale('en');
});

describe('BackupPanel: saving', () => {
  it('hands the student a file with everything in it', async () => {
    const { deps } = setup();
    $('.backup-save').click();
    await flush();
    expect(deps.download).toHaveBeenCalledOnce();
    const [name, text] = vi.mocked(deps.download).mock.calls[0];
    expect(name).toBe('music-notes-trainer-backup-2026-10-16.json');
    expect(JSON.parse(text)).toMatchObject({ app: BACKUP_APP, version: 1 });
    expect($('.backup-status').textContent).toBe('Backup saved. Settings: 2. Scores: 1.');
  });

  it('says so when the backup cannot be made', async () => {
    setup({ create: vi.fn(async () => Promise.reject(new Error('db'))) });
    $('.backup-save').click();
    await flush();
    expect($('.backup-status').textContent).toBe('The backup could not be made.');
  });
});

describe('BackupPanel: restoring', () => {
  it('asks first, with what is in the file, and restores only after a yes', async () => {
    const { deps } = setup();
    chooseFile(JSON.stringify(backup()));
    await flush();
    expect($('.backup-ask').hidden).toBe(false);
    expect($('.backup-ask-text').textContent).toMatch(/saved on 16 October 2026, contains settings \(2\) and scores \(1\)/);
    expect(deps.restore).not.toHaveBeenCalled();
    $('.backup-yes').click();
    await flush();
    expect(deps.restore).toHaveBeenCalledOnce();
    expect($('.backup-status').textContent).toBe('Restored: settings 2, scores 1. The page reloads now.');
    expect(deps.reload).toHaveBeenCalledOnce();
    expect($('.backup-ask').hidden).toBe(true);
  });

  it('restores nothing when the student cancels', async () => {
    const { deps } = setup();
    chooseFile(JSON.stringify(backup()));
    await flush();
    $('.backup-no').click();
    expect(deps.restore).not.toHaveBeenCalled();
    expect(deps.reload).not.toHaveBeenCalled();
    expect($('.backup-ask').hidden).toBe(true);
  });

  it('says how many scores did not fit', async () => {
    setup({ restore: vi.fn(async () => ({ settings: 2, scores: 0, skipped: 3 })) });
    chooseFile(JSON.stringify(backup()));
    await flush();
    $('.backup-yes').click();
    await flush();
    expect($('.backup-status').textContent).toContain('no room: 3');
  });

  it('refuses a file that is not a backup, without asking', async () => {
    const { deps } = setup();
    chooseFile('{"hello":"world"}');
    await flush();
    expect($('.backup-status').textContent).toBe('This file is not a backup made by this app.');
    expect($('.backup-ask').hidden).toBe(true);
    chooseFile('not json at all');
    await flush();
    expect($('.backup-status').textContent).toBe('This file is not a backup made by this app.');
    expect(deps.restore).not.toHaveBeenCalled();
  });

  it('refuses a backup of a newer version and an empty one', async () => {
    setup();
    chooseFile(JSON.stringify({ ...backup(), version: 9 }));
    await flush();
    expect($('.backup-status').textContent).toMatch(/newer version/);
    chooseFile(JSON.stringify(backup({ storage: {}, scores: [] })));
    await flush();
    expect($('.backup-status').textContent).toBe('There is nothing in this file to restore.');
  });

  it('says so when the file cannot be read', async () => {
    setup();
    const input = $<HTMLInputElement>('.backup-file');
    Object.defineProperty(input, 'files', { value: [{ name: 'x.json', text: async () => Promise.reject(new Error('io')) }], configurable: true });
    input.dispatchEvent(new Event('change'));
    await flush();
    expect($('.backup-status').textContent).toBe('The file could not be read.');
  });

  it('keeps the page when the restore fails', async () => {
    const { deps } = setup({ restore: vi.fn(async () => Promise.reject(new Error('quota'))) });
    chooseFile(JSON.stringify(backup()));
    await flush();
    $('.backup-yes').click();
    await flush();
    expect(deps.reload).not.toHaveBeenCalled();
    expect($('.backup-status').textContent).toBe('The file is damaged and cannot be restored.');
  });
});

describe('BackupPanel: language', () => {
  it('speaks Persian and follows a change of language', async () => {
    setLocale('fa');
    const { panel } = setup();
    expect($('.backup-save').textContent).toBe('ذخیره‌ی نسخه‌ی پشتیبان');
    chooseFile(JSON.stringify(backup()));
    await flush();
    expect($('.backup-ask-text').textContent).toContain('۲ تنظیم و ۱ نت');
    setLocale('en');
    panel.refresh();
    expect($('.backup-save').textContent).toBe('Save a backup');
    expect($('.backup-ask-text').textContent).toContain('settings (2) and scores (1)');
  });

  it('has the look of an options group when it lives in the options panel', () => {
    const panel = new BackupPanel(
      { create: vi.fn(), restore: vi.fn(), download: vi.fn(), fileName: () => 'x', reload: vi.fn() } as unknown as BackupPanelDeps,
      true,
    );
    expect(panel.element.classList.contains('options-group')).toBe(true);
  });
});
