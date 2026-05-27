import { describe, expect, it } from 'vitest';
import { createSlugifier } from '../../src/lib/slugify';

describe('createSlugifier', () => {
  it('lowercases and hyphenates spaces', () => {
    const slugify = createSlugifier();
    expect(slugify('Common Mistakes')).toBe('common-mistakes');
  });

  it('strips punctuation', () => {
    const slugify = createSlugifier();
    expect(slugify("Don't Do This!")).toBe('dont-do-this');
  });

  it('removes diacritics', () => {
    const slugify = createSlugifier();
    expect(slugify('Référence Citée')).toBe('reference-citee');
  });

  it('collapses repeated whitespace and hyphens', () => {
    const slugify = createSlugifier();
    expect(slugify('A   B---C')).toBe('a-b-c');
  });

  it('returns stable suffix on collision', () => {
    const slugify = createSlugifier();
    expect(slugify('Book')).toBe('book');
    expect(slugify('Book')).toBe('book-2');
    expect(slugify('Book')).toBe('book-3');
  });

  it('handles empty and all-punctuation input', () => {
    const slugify = createSlugifier();
    expect(slugify('')).toBe('section');
    expect(slugify('!!!')).toBe('section');
    expect(slugify('!!!')).toBe('section-2');
  });

  it('different instances do not share collision state', () => {
    const a = createSlugifier();
    const b = createSlugifier();
    expect(a('Book')).toBe('book');
    expect(b('Book')).toBe('book');
  });
});
