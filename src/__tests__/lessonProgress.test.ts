import { describe, it, expect, beforeEach } from 'vitest';
import { LessonProgress } from '../lessons/lessonProgress';

const IDS = ['a', 'b', 'c', 'd'];

describe('LessonProgress', () => {
  beforeEach(() => localStorage.clear());

  it('starts with nothing read', () => {
    const progress = new LessonProgress(IDS);
    expect(progress.count()).toBe(0);
    expect(progress.total()).toBe(4);
    expect(progress.isRead('a')).toBe(false);
    expect(progress.firstUnread()).toBe('a');
  });

  it('says whether a lesson was read for the first time', () => {
    const progress = new LessonProgress(IDS);
    expect(progress.markRead('b')).toBe(true);
    expect(progress.markRead('b')).toBe(false);
    expect(progress.isRead('b')).toBe(true);
    expect(progress.count()).toBe(1);
  });

  it('ignores lessons that are not in the course', () => {
    const progress = new LessonProgress(IDS);
    expect(progress.markRead('zzz')).toBe(false);
    expect(progress.count()).toBe(0);
  });

  it('remembers across a reload', () => {
    new LessonProgress(IDS).markRead('c');
    const again = new LessonProgress(IDS);
    expect(again.isRead('c')).toBe(true);
    expect(again.all()).toEqual(['c']);
  });

  it('forgets saved lessons that no longer exist', () => {
    localStorage.setItem('lessons.read.v1', JSON.stringify(['a', 'old-lesson', 7, null]));
    const progress = new LessonProgress(IDS);
    expect(progress.all()).toEqual(['a']);
  });

  it('starts fresh from damaged storage', () => {
    localStorage.setItem('lessons.read.v1', '{not json');
    expect(new LessonProgress(IDS).count()).toBe(0);
    localStorage.setItem('lessons.read.v1', '{"a":true}');
    expect(new LessonProgress(IDS).count()).toBe(0);
  });

  it('points at the first lesson not read yet, wherever it is', () => {
    const progress = new LessonProgress(IDS);
    progress.markRead('a');
    progress.markRead('c');
    expect(progress.firstUnread()).toBe('b');
    progress.markRead('b');
    progress.markRead('d');
    expect(progress.firstUnread()).toBeNull();
    expect(progress.isComplete()).toBe(true);
  });

  it('can be reset', () => {
    const progress = new LessonProgress(IDS);
    progress.markRead('a');
    progress.reset();
    expect(progress.count()).toBe(0);
    expect(new LessonProgress(IDS).count()).toBe(0);
  });

  it('keeps working when storage is blocked', () => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new Error('blocked');
    };
    try {
      const progress = new LessonProgress(IDS);
      expect(progress.markRead('a')).toBe(true);
      expect(progress.isRead('a')).toBe(true);
    } finally {
      Storage.prototype.setItem = original;
    }
  });
});
