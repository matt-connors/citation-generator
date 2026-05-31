// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import React from 'react';
import Dropdown from '../../src/components/react/Dropdown';

const OPTIONS = [
  { label: 'APA 7th edition', value: 'apa-7' },
  { label: 'MLA 9th edition', value: 'mla-9', default: true },
  { label: 'Chicago 18th edition', value: 'chicago-18' },
];

beforeEach(() => {
  if (!(window as any).matchMedia) {
    (window as any).matchMedia = (q: string) => ({
      matches: false, media: q, onchange: null,
      addListener: () => {}, removeListener: () => {},
      addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false,
    });
  }
});

describe('Dropdown search filter', () => {
  it('resets the filter and clears the search box each time it opens', () => {
    const { container } = render(<Dropdown options={OPTIONS} className="" />);
    const openBtn = container.querySelector('button') as HTMLButtonElement; // the trigger
    const search = () => container.querySelector('input[type="text"]') as HTMLInputElement;
    const optionCount = () => container.querySelectorAll('ul li').length;

    fireEvent.click(openBtn);
    expect(optionCount()).toBe(3);
    fireEvent.change(search(), { target: { value: 'apa' } });
    expect(optionCount()).toBe(1);

    // Close, then reopen — the filter must reset (regression: it used to persist).
    fireEvent.click(openBtn);
    fireEvent.click(openBtn);
    expect(search().value).toBe('');
    expect(optionCount()).toBe(3);
  });

  it('does not mutate the shared options array when sorting alphabetically', () => {
    const before = OPTIONS.map((o) => o.value).join(',');
    render(<Dropdown options={OPTIONS} className="" />);
    expect(OPTIONS.map((o) => o.value).join(',')).toBe(before);
  });
});
