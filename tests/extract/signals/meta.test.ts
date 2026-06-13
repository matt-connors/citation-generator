import { describe, it, expect } from 'vitest';
import * as cheerio from 'cheerio';
import { metaSignal } from '../../../functions/lib/extract/signals/meta';

describe('metaSignal', () => {
  it('reads <meta name="author">', () => {
    const $ = cheerio.load(`<meta name="author" content="Jane Doe" />`);
    expect(metaSignal($).fields.author).toEqual([{ family: 'Doe', given: 'Jane' }]);
  });

  it('splits multi-author meta on comma and semicolon', () => {
    const $ = cheerio.load(`<meta name="author" content="Jane Doe, John Smith; Acme Inc" />`);
    const r = metaSignal($);
    expect(r.fields.author).toEqual([
      { family: 'Doe', given: 'Jane' },
      { family: 'Smith', given: 'John' },
      { literal: 'Acme Inc' },
    ]);
  });

  it('reads <meta name="publisher">', () => {
    const $ = cheerio.load(`<meta name="publisher" content="Example Pub" />`);
    expect(metaSignal($).fields.publisher).toBe('Example Pub');
  });

  it('reads citation_title at higher confidence than other meta', () => {
    const $ = cheerio.load(`<meta name="citation_title" content="Academic Paper" />`);
    const r = metaSignal($);
    expect(r.fields.title).toBe('Academic Paper');
    expect(r.confidence.title).toBeGreaterThan(0.7);
  });

  it('reads citation_publication_date / dc.date / DC.date', () => {
    const cases = [
      `<meta name="citation_publication_date" content="2024-06-01" />`,
      `<meta name="dc.date" content="2024-06-01" />`,
      `<meta name="DC.date" content="2024-06-01" />`,
    ];
    for (const html of cases) {
      const $ = cheerio.load(html);
      expect(metaSignal($).fields.issued).toEqual({ 'date-parts': [[2024, 6, 1]] });
    }
  });

  it('parses a freeform publication date in meta tags', () => {
    // Some publishers emit human-readable dates (e.g. "June 1, 2024") in
    // citation_publication_date / DC.date rather than ISO 8601. parseIsoDate
    // alone dropped these.
    const $ = cheerio.load(`<meta name="DC.date" content="June 1, 2024" />`);
    expect(metaSignal($).fields.issued).toEqual({ 'date-parts': [[2024, 6, 1]] });
  });

  it('returns empty when no relevant meta', () => {
    expect(metaSignal(cheerio.load(`<meta name="viewport" content="x" />`)).fields).toEqual({});
  });

  it('collects multiple citation_author / DC.creator entries into an author array', () => {
    const $ = cheerio.load(`
      <meta name="DC.creator" content="Smith, John" />
      <meta name="DC.creator" content="Doe, Jane" />
      <meta name="DC.creator" content="Garcia, Carlos" />
    `);
    const r = metaSignal($);
    expect(r.fields.author).toEqual([
      { family: 'Smith', given: 'John' },
      { family: 'Doe', given: 'Jane' },
      { family: 'Garcia', given: 'Carlos' },
    ]);
  });
});
