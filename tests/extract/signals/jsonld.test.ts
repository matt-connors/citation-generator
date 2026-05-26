import { describe, it, expect } from 'vitest';
import * as cheerio from 'cheerio';
import { jsonldSignal } from '../../../functions/lib/extract/signals/jsonld';

function load(html: string) { return cheerio.load(html); }

describe('jsonldSignal', () => {
  it('extracts headline, author, datePublished, publisher from NewsArticle', () => {
    const $ = load(`<html><head><script type="application/ld+json">${JSON.stringify({
      '@type': 'NewsArticle',
      headline: 'A Title',
      author: { '@type': 'Person', givenName: 'Jane', familyName: 'Doe' },
      datePublished: '2026-05-26',
      publisher: { '@type': 'Organization', name: 'Example News' },
    })}</script></head></html>`);
    const r = jsonldSignal($);
    expect(r.fields.title).toBe('A Title');
    expect(r.fields.author).toEqual([{ family: 'Doe', given: 'Jane' }]);
    expect(r.fields.issued).toEqual({ 'date-parts': [[2026, 5, 26]] });
    expect(r.fields.publisher).toBe('Example News');
    expect(r.confidence.title).toBeCloseTo(0.95);
  });

  it('handles a @graph wrapper', () => {
    const $ = load(`<html><head><script type="application/ld+json">${JSON.stringify({
      '@context': 'https://schema.org',
      '@graph': [{ '@type': 'Article', headline: 'In graph', datePublished: '2025' }],
    })}</script></head></html>`);
    const r = jsonldSignal($);
    expect(r.fields.title).toBe('In graph');
    expect(r.fields.issued).toEqual({ 'date-parts': [[2025]] });
  });

  it('handles a top-level array', () => {
    const $ = load(`<html><head><script type="application/ld+json">${JSON.stringify([
      { '@type': 'WebSite', name: 'site' },
      { '@type': 'Article', headline: 'Top' },
    ])}</script></head></html>`);
    const r = jsonldSignal($);
    expect(r.fields.title).toBe('Top');
  });

  it('handles author as a plain string', () => {
    const $ = load(`<html><head><script type="application/ld+json">${JSON.stringify({
      '@type': 'Article', headline: 'h', author: 'John Smith',
    })}</script></head></html>`);
    const r = jsonldSignal($);
    expect(r.fields.author).toEqual([{ family: 'Smith', given: 'John' }]);
  });

  it('handles author array of mixed shapes', () => {
    const $ = load(`<html><head><script type="application/ld+json">${JSON.stringify({
      '@type': 'Article', headline: 'h',
      author: [
        'John Smith',
        { '@type': 'Person', givenName: 'Jane', familyName: 'Doe' },
        { '@type': 'Organization', name: 'Acme Inc' },
      ],
    })}</script></head></html>`);
    const r = jsonldSignal($);
    expect(r.fields.author).toEqual([
      { family: 'Smith', given: 'John' },
      { family: 'Doe', given: 'Jane' },
      { literal: 'Acme Inc' },
    ]);
  });

  it('silently ignores malformed JSON', () => {
    const $ = load(`<html><head><script type="application/ld+json">{not json}</script></head></html>`);
    const r = jsonldSignal($);
    expect(r.fields).toEqual({});
  });

  it('returns empty when no script tags exist', () => {
    const $ = load(`<html><head></head><body>hi</body></html>`);
    const r = jsonldSignal($);
    expect(r.fields).toEqual({});
  });
});
