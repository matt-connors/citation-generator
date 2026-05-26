import { describe, it, expect } from 'vitest';
import * as cheerio from 'cheerio';
import { openGraphSignal } from '../../../functions/lib/extract/signals/opengraph';

describe('openGraphSignal', () => {
  it('reads og:title, og:site_name, og:url', () => {
    const $ = cheerio.load(`
      <meta property="og:title" content="The Title" />
      <meta property="og:site_name" content="Example Site" />
      <meta property="og:url" content="https://example.com/p" />`);
    const r = openGraphSignal($);
    expect(r.fields.title).toBe('The Title');
    expect(r.fields['container-title']).toBe('Example Site');
    expect(r.fields.URL).toBe('https://example.com/p');
    expect(r.confidence.title).toBeCloseTo(0.75);
  });

  it('reads article:published_time', () => {
    const $ = cheerio.load(`<meta property="article:published_time" content="2026-05-26T10:00:00Z" />`);
    const r = openGraphSignal($);
    expect(r.fields.issued).toEqual({ 'date-parts': [[2026, 5, 26]] });
  });

  it('reads article:author only when it is a name, not a URL', () => {
    const $1 = cheerio.load(`<meta property="article:author" content="Jane Doe" />`);
    expect(openGraphSignal($1).fields.author).toEqual([{ family: 'Doe', given: 'Jane' }]);

    const $2 = cheerio.load(`<meta property="article:author" content="https://example.com/author/jane" />`);
    expect(openGraphSignal($2).fields.author).toBeUndefined();
  });

  it('returns empty when no OG tags', () => {
    const $ = cheerio.load(`<html></html>`);
    expect(openGraphSignal($).fields).toEqual({});
  });
});
