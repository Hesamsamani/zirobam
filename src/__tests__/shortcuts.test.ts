import { describe, it, expect } from 'vitest';
import { isSpaceReserved } from '../input/shortcuts';

function el(html: string): HTMLElement {
  const holder = document.createElement('div');
  holder.append(new DOMParser().parseFromString(html, 'text/html').body.firstElementChild!);
  return holder.firstElementChild as HTMLElement;
}

describe('isSpaceReserved', () => {
  it('is false for the page itself, so Space can start and stop the exercise', () => {
    expect(isSpaceReserved(document.body)).toBe(false);
    expect(isSpaceReserved(document)).toBe(false);
    expect(isSpaceReserved(null)).toBe(false);
    expect(isSpaceReserved(el('<div></div>'))).toBe(false);
  });

  it('is true where Space already means something', () => {
    expect(isSpaceReserved(el('<input type="number">'))).toBe(true);
    expect(isSpaceReserved(el('<select></select>'))).toBe(true);
    expect(isSpaceReserved(el('<textarea></textarea>'))).toBe(true);
    expect(isSpaceReserved(el('<button>Options</button>'))).toBe(true);
    expect(isSpaceReserved(el('<a href="#x">x</a>'))).toBe(true);
    expect(isSpaceReserved(el('<summary>x</summary>'))).toBe(true);
    expect(isSpaceReserved(el('<div role="button"></div>'))).toBe(true);
    expect(isSpaceReserved(el('<div contenteditable="true"></div>'))).toBe(true);
  });

  it('is true for a child of a button', () => {
    const button = el('<button><span id="inner">x</span></button>');
    expect(isSpaceReserved(button.querySelector('#inner'))).toBe(true);
  });
});
