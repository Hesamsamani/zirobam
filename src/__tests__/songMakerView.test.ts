import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SongMakerView, type SongMakerDeps } from '../songs/songMakerView';
import { buildDraft } from '../songs/songMaker';
import { initLocale, setLocale } from '../i18n';

const SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="640px" height="210px"><g class="note"/></svg>';

function setup(overrides: Partial<SongMakerDeps> = {}) {
  const toolkit = { setOptions: vi.fn(), loadData: vi.fn(), renderToSVG: vi.fn(() => SVG) };
  const deps: SongMakerDeps = {
    toolkit,
    onBack: vi.fn(),
    open: vi.fn(async () => null),
    save: vi.fn(async () => 'saved' as const),
    practise: vi.fn(),
    newId: () => 'maker-test',
    onSaved: vi.fn(),
    ...overrides,
  };
  const view = new SongMakerView(deps);
  document.body.replaceChildren(view.element);
  return { view, deps, toolkit };
}

const $ = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector)!;
const type = (selector: string, value: string) => {
  const el = $<HTMLInputElement | HTMLTextAreaElement>(selector);
  el.value = value;
  el.dispatchEvent(new Event('input', { bubbles: true }));
};
const note = (letter: string) => $(`.maker-note[data-letter="${letter}"]`).click();
const chip = (text: string) => Array.from(document.querySelectorAll<HTMLButtonElement>('.maker-chip')).find((b) => b.textContent === text)!;

beforeEach(() => {
  localStorage.clear();
  initLocale();
  setLocale('en');
});

describe('the song maker screen', () => {
  it('starts empty, with a hint where the staff will be', async () => {
    const { view } = setup();
    await view.show(null);
    expect($<HTMLTextAreaElement>('#makerNotes').value).toBe('');
    expect($('.maker-empty').textContent).toMatch(/Add some notes/);
    expect($('.maker-problem').textContent).toBe('');
  });

  it('adds a note with the buttons, using the chosen octave, sign and length', async () => {
    const { view } = setup();
    await view.show(null);
    note('C');
    expect($<HTMLTextAreaElement>('#makerNotes').value).toBe('C4q');
    chip('5').click();
    chip('♯').click();
    chip('Half').click();
    note('F');
    expect($<HTMLTextAreaElement>('#makerNotes').value).toBe('C4q F#5h');
    chip('Dotted').click();
    note('G');
    $('.maker-rest').click();
    expect($<HTMLTextAreaElement>('#makerNotes').value).toBe('C4q F#5h G#5h. rh.');
  });

  it('keeps the choices shown on the buttons', async () => {
    const { view } = setup();
    await view.show(null);
    expect(chip('4').getAttribute('aria-pressed')).toBe('true');
    chip('3').click();
    expect(chip('3').getAttribute('aria-pressed')).toBe('true');
    expect(chip('4').getAttribute('aria-pressed')).toBe('false');
    chip('Sixteenth').click();
    expect(chip('Dotted').disabled).toBe(true);
  });

  it('closes a measure by itself when it is full', async () => {
    const { view } = setup();
    await view.show(null);
    chip('Half').click();
    note('C');
    note('D');
    expect($<HTMLTextAreaElement>('#makerNotes').value).toBe('C4h D4h |');
  });

  it('deletes the last note and clears everything', async () => {
    const { view } = setup();
    await view.show(null);
    note('C');
    note('D');
    $('.maker-tool[data-action="delete"]').click();
    expect($<HTMLTextAreaElement>('#makerNotes').value).toBe('C4q');
    $('.maker-tool[data-action="clear"]').click();
    expect($<HTMLTextAreaElement>('#makerNotes').value).toBe('');
  });

  it('draws what was written, and only the first four measures of a long song', async () => {
    const { view, toolkit } = setup();
    await view.show(null);
    type('#makerNotes', 'C4w | D4w | E4w | F4w | G4w | A4w');
    expect($('.maker-preview svg')).not.toBeNull();
    const last = String(toolkit.loadData.mock.calls.at(-1)![0]);
    expect(last.match(/<measure /g)).toHaveLength(4);
    expect($('.maker-more').textContent).toBe('Showing the first 4 of 6 measures.');
    expect($('.maker-count').textContent).toBe('Measures: 6');
  });

  it('does not nag about the measure that is still being typed', async () => {
    const { view } = setup();
    await view.show(null);
    type('#makerNotes', 'C4q D4q');
    expect($('.maker-problem').textContent).toBe('');
    type('#makerNotes', 'C4q D4q | E4w');
    expect($('.maker-problem').textContent).toMatch(/Measure 1 has 2 beats, but this time signature needs 4/);
  });

  it('says which note it cannot read', async () => {
    const { view } = setup();
    await view.show(null);
    type('#makerNotes', 'C4q X4q');
    expect($('.maker-problem').textContent).toMatch(/cannot read "X4q"/);
    expect($('#makerNotes').getAttribute('aria-invalid')).toBe('true');
  });

  it('asks for a sign where the key has one', async () => {
    const { view } = setup();
    await view.show(null);
    $<HTMLSelectElement>('#makerKey').value = '1';
    type('#makerNotes', 'G4q A4q B4q F4q');
    expect($('.maker-problem').textContent).toMatch(/Write F#4, or Fn4 for a natural/);
  });

  it('refuses to save without a name, and says so', async () => {
    const { view, deps } = setup();
    await view.show(null);
    type('#makerNotes', 'C4w');
    $('.maker-save').click();
    await Promise.resolve();
    expect(deps.save).not.toHaveBeenCalled();
    expect($('.maker-problem').textContent).toMatch(/Give the song a name/);
  });

  it('refuses to save an empty song', async () => {
    const { view, deps } = setup();
    await view.show(null);
    type('#makerName', 'Empty');
    $('.maker-save').click();
    await Promise.resolve();
    expect(deps.save).not.toHaveBeenCalled();
    expect($('.maker-problem').textContent).toMatch(/at least one note/);
  });

  it('saves the song and practises it', async () => {
    const { view, deps } = setup();
    await view.show(null);
    type('#makerName', 'My tune');
    $<HTMLSelectElement>('#makerTime').value = '3';
    type('#makerNotes', 'C4q D4q E4q | G4h.');
    $('.maker-practise').click();
    await vi.waitFor(() => expect(deps.practise).toHaveBeenCalledWith('maker-test'));
    expect(deps.save).toHaveBeenCalledOnce();
    const [id, title, xml] = vi.mocked(deps.save).mock.calls[0];
    expect(id).toBe('maker-test');
    expect(title).toBe('My tune');
    expect(xml).toContain('<beats>3</beats>');
    expect(deps.onSaved).toHaveBeenCalledWith('maker-test');
    expect($('.maker-status').textContent).toBe('Saved in My scores.');
  });

  it('keeps the same id when it is saved again', async () => {
    const { view, deps } = setup({ newId: vi.fn().mockReturnValueOnce('maker-one').mockReturnValueOnce('maker-two') });
    await view.show(null);
    type('#makerName', 'My tune');
    type('#makerNotes', 'C4w');
    $('.maker-save').click();
    await vi.waitFor(() => expect(deps.save).toHaveBeenCalledTimes(1));
    $('.maker-save').click();
    await vi.waitFor(() => expect(deps.save).toHaveBeenCalledTimes(2));
    expect(vi.mocked(deps.save).mock.calls.map((c) => c[0])).toEqual(['maker-one', 'maker-one']);
  });

  it('says when there is no room, and does not practise', async () => {
    const { view, deps } = setup({ save: vi.fn(async () => 'full' as const) });
    await view.show(null);
    type('#makerName', 'My tune');
    type('#makerNotes', 'C4w');
    $('.maker-practise').click();
    await vi.waitFor(() => expect($('.maker-status').textContent).toMatch(/no room left/));
    expect(deps.practise).not.toHaveBeenCalled();
  });

  it('warns when the browser cannot keep the song', async () => {
    const { view } = setup({ save: vi.fn(async () => 'memory' as const) });
    await view.show(null);
    type('#makerName', 'My tune');
    type('#makerNotes', 'C4w');
    $('.maker-save').click();
    await vi.waitFor(() => expect($('.maker-status').textContent).toMatch(/does not keep files/));
  });

  it('opens a saved song for editing', async () => {
    const built = buildDraft({ title: 'Old tune', fifths: 1, beats: 3, melody: 'G4q A4q B4q | G4h.' });
    if (!built.ok) throw new Error('should build');
    const { view, deps } = setup({ open: vi.fn(async () => built.xml) });
    await view.show('maker-old');
    expect($<HTMLInputElement>('#makerName').value).toBe('Old tune');
    expect($<HTMLSelectElement>('#makerKey').value).toBe('1');
    expect($<HTMLSelectElement>('#makerTime').value).toBe('3');
    expect($<HTMLTextAreaElement>('#makerNotes').value).toBe('G4q A4q B4q | G4h.');
    $('.maker-save').click();
    await vi.waitFor(() => expect(deps.save).toHaveBeenCalled());
    expect(vi.mocked(deps.save).mock.calls[0][0]).toBe('maker-old'); // it replaces the song it came from
  });

  it('says so when the song to edit is gone, and starts a new one', async () => {
    const { view } = setup();
    await view.show('maker-missing');
    expect($('.maker-status').textContent).toBe('That song is not here any more.');
    expect($<HTMLTextAreaElement>('#makerNotes').value).toBe('');
  });

  it('keeps an unfinished song when the page is closed', async () => {
    const first = setup();
    await first.view.show(null);
    type('#makerName', 'Half done');
    type('#makerNotes', 'C4q D4q');
    const second = setup();
    await second.view.show(null);
    expect($<HTMLInputElement>('#makerName').value).toBe('Half done');
    expect($<HTMLTextAreaElement>('#makerNotes').value).toBe('C4q D4q');
  });

  it('forgets the draft once the song is saved', async () => {
    const { view, deps } = setup();
    await view.show(null);
    type('#makerName', 'Done');
    type('#makerNotes', 'C4w');
    $('.maker-save').click();
    await vi.waitFor(() => expect(deps.save).toHaveBeenCalled());
    const next = setup();
    await next.view.show(null);
    expect($<HTMLInputElement>('#makerName').value).toBe('');
  });

  it('shows letters in the note names the student chose', async () => {
    const { view } = setup({ formatName: (letter) => ({ C: 'Do', D: 'Re' })[letter] ?? letter });
    await view.show(null);
    expect($('.maker-note[data-letter="C"]').textContent).toBe('Do');
    expect($('.maker-note[data-letter="E"]').textContent).toBe('E');
  });

  it('speaks Persian, and keeps the notes box left to right', async () => {
    setLocale('fa');
    const { view } = setup();
    await view.show(null);
    expect($('.maker-save').textContent).toBe('ذخیره');
    expect($('#makerNotes').getAttribute('dir')).toBe('ltr');
    expect($('.maker-preview').getAttribute('dir')).toBe('ltr');
    type('#makerNotes', 'C4q D4q | E4w');
    expect($('.maker-problem').textContent).toMatch(/میزان ۱ دارای ۲ ضرب است/);
  });

  it('goes back to the songs', async () => {
    const { view, deps } = setup();
    await view.show(null);
    $('.back-btn').click();
    expect(deps.onBack).toHaveBeenCalled();
    expect($('.back-btn').textContent).toMatch(/Back to songs/);
  });
});
