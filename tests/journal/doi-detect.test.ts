import { describe, it, expect } from 'vitest';
import * as cheerio from 'cheerio';
import { extractDoi, validateDoi } from '../../functions/lib/journal/doi-detect';

describe('validateDoi', () => {
  it('accepts standard DOI format', () => {
    expect(validateDoi('10.1038/s41586-021-03828-1')).toBe('10.1038/s41586-021-03828-1');
  });
  it('strips a doi.org URL prefix', () => {
    expect(validateDoi('https://doi.org/10.1038/s41586-021-03828-1'))
      .toBe('10.1038/s41586-021-03828-1');
  });
  it('strips copied URL wrappers, query strings, and trailing sentence punctuation', () => {
    expect(validateDoi('<https://doi.org/10.1038/s41586-021-03828-1?utm_source=x>.'))
      .toBe('10.1038/s41586-021-03828-1');
    expect(validateDoi('10.1038/s41586-021-03828-1,'))
      .toBe('10.1038/s41586-021-03828-1');
  });
  it('strips a "doi:" prefix', () => {
    expect(validateDoi('doi:10.1038/foo')).toBe('10.1038/foo');
  });
  it('keeps balanced suffix punctuation but removes unmatched closing wrappers', () => {
    expect(validateDoi('10.1002/(SICI)1097-4571(199505)46:4<327::AID-ASI5>3.0.CO;2-0'))
      .toBe('10.1002/(SICI)1097-4571(199505)46:4<327::AID-ASI5>3.0.CO;2-0');
    expect(validateDoi('(10.1038/foo)')).toBe('10.1038/foo');
    expect(validateDoi('10.1038/foo).')).toBe('10.1038/foo');
  });
  it('returns null for garbage', () => {
    expect(validateDoi('not a doi')).toBeNull();
    expect(validateDoi('')).toBeNull();
  });
});

describe('extractDoi (from HTML)', () => {
  it('finds citation_doi meta', () => {
    const $ = cheerio.load(`<meta name="citation_doi" content="10.1038/foo" />`);
    expect(extractDoi($)).toBe('10.1038/foo');
  });
  it('finds dc.identifier when it looks like a DOI', () => {
    const $ = cheerio.load(`<meta name="dc.identifier" content="doi:10.1038/bar" />`);
    expect(extractDoi($)).toBe('10.1038/bar');
  });
  it('falls back to scanning text content for a DOI pattern', () => {
    const $ = cheerio.load(`<p>See https://doi.org/10.1038/baz for details.</p>`);
    expect(extractDoi($)).toBe('10.1038/baz');
  });
  it('removes sentence punctuation from DOI text matches', () => {
    const $ = cheerio.load(`<p>DOI: 10.1038/baz.</p>`);
    expect(extractDoi($)).toBe('10.1038/baz');
  });
  it('returns null when no DOI present', () => {
    const $ = cheerio.load(`<p>plain text</p>`);
    expect(extractDoi($)).toBeNull();
  });
});
