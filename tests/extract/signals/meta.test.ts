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

  it('does not split inverted single-author names on the comma', () => {
    const $ = cheerio.load(`<meta name="author" content="Smith, John" />`);
    expect(metaSignal($).fields.author).toEqual([{ family: 'Smith', given: 'John' }]);
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

  it('reads common non-ISO publication-date meta fields', () => {
    const $ = cheerio.load(`<meta name="parsely-pub-date" content="May 26, 2026" />`);
    expect(metaSignal($).fields.issued).toEqual({ 'date-parts': [[2026, 5, 26]] });
  });

  it('extracts and normalizes DOI metadata', () => {
    const $ = cheerio.load(`<meta name="DC.identifier" content="https://doi.org/10.1234/ABC.567." />`);
    expect(metaSignal($).fields.DOI).toBe('10.1234/ABC.567');
  });

  it('extracts scholarly volume, issue, page range, and abstract metadata', () => {
    const $ = cheerio.load(`
      <meta name="citation_volume" content="12" />
      <meta name="citation_issue" content="3" />
      <meta name="citation_firstpage" content="101" />
      <meta name="citation_lastpage" content="118" />
      <meta name="citation_abstract" content="  A compact study abstract.  " />
    `);
    const r = metaSignal($);
    expect(r.fields.volume).toBe('12');
    expect(r.fields.issue).toBe('3');
    expect(r.fields.page).toBe('101-118');
    expect(r.fields.abstract).toBe('A compact study abstract.');
  });

  it('keeps generic application-name below OpenGraph confidence', () => {
    const $ = cheerio.load(`<meta name="application-name" content="Short Site" />`);
    const r = metaSignal($);
    expect(r.fields['container-title']).toBe('Short Site');
    expect(r.confidence['container-title']).toBeLessThan(0.75);
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

  it('parses author lists inside citation_author content', () => {
    const $ = cheerio.load(`<meta name="citation_author" content="Jane Doe and John Smith" />`);
    expect(metaSignal($).fields.author).toEqual([
      { family: 'Doe', given: 'Jane' },
      { family: 'Smith', given: 'John' },
    ]);
  });

  it('prefers citation_author over generic meta author', () => {
    const $ = cheerio.load(`
      <meta name="author" content="Example Site" />
      <meta name="citation_author" content="Smith, John" />
    `);
    const r = metaSignal($);
    expect(r.fields.author).toEqual([{ family: 'Smith', given: 'John' }]);
    expect(r.confidence.author).toBeGreaterThan(0.8);
  });
});
