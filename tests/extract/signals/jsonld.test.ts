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

  it('handles organization authors with array-typed @type', () => {
    const $ = load(`<html><head><script type="application/ld+json">${JSON.stringify({
      '@type': 'Article',
      headline: 'h',
      author: { '@type': ['Organization', 'NewsMediaOrganization'], name: 'Example News' },
    })}</script></head></html>`);
    expect(jsonldSignal($).fields.author).toEqual([{ literal: 'Example News' }]);
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

  it('decodes HTML entities in script-tag JSON-LD content', () => {
    // Real sites emit entity-escaped script content; HTML5 says script content is not
    // entity-decoded, but the JSON inside should still be valid post-decode.
    const html = `<html><head><script type="application/ld+json">${JSON.stringify({
      '@type': 'Article',
      headline: 'Test',
      author: { '@type': 'Person', name: 'O&#x27;Brien' },
    })}</script></head></html>`;
    const $ = cheerio.load(html);
    const r = jsonldSignal($);
    expect(r.fields.author).toEqual([{ family: "O'Brien" }]);
  });

  it('prefers an article URL over a non-article URL in @graph', () => {
    const html = `<html><head><script type="application/ld+json">${JSON.stringify({
      '@context': 'https://schema.org',
      '@graph': [
        { '@type': 'Organization', name: 'My Site', url: 'https://mysite.com/' },
        { '@type': 'Article', headline: 'The Article', url: 'https://mysite.com/2026/article/' },
      ],
    })}</script></head></html>`;
    const $ = cheerio.load(html);
    const r = jsonldSignal($);
    expect(r.fields.URL).toBe('https://mysite.com/2026/article/');
  });

  it('handles creator, isPartOf, mainEntityOfPage, and non-ISO dates', () => {
    const html = `<html><head><script type="application/ld+json">${JSON.stringify({
      '@type': ['WebPage', 'NewsArticle'],
      headline: 'The Article',
      creator: 'Jane Doe',
      datePublished: 'May 26, 2026',
      isPartOf: { '@type': 'WebSite', name: 'Example News' },
      mainEntityOfPage: { '@id': 'https://example.com/article' },
    })}</script></head></html>`;
    const r = jsonldSignal(load(html));
    expect(r.fields.author).toEqual([{ family: 'Doe', given: 'Jane' }]);
    expect(r.fields.issued).toEqual({ 'date-parts': [[2026, 5, 26]] });
    expect(r.fields['container-title']).toBe('Example News');
    expect(r.fields.URL).toBe('https://example.com/article');
  });

  it('does not take titles from array-typed non-article containers', () => {
    const html = `<html><head><script type="application/ld+json">${JSON.stringify({
      '@type': ['Organization', 'WebSite'],
      name: 'Site Root',
    })}</script></head></html>`;
    expect(jsonldSignal(load(html)).fields.title).toBeUndefined();
  });

  it('extracts scholarly DOI, volume, issue, pages, and abstract from JSON-LD', () => {
    const html = `<html><head><script type="application/ld+json">${JSON.stringify({
      '@type': 'ScholarlyArticle',
      headline: 'A Scholarly Article',
      identifier: [
        { '@type': 'PropertyValue', propertyID: 'DOI', value: 'https://doi.org/10.5555/example.2026.001.' },
      ],
      isPartOf: {
        '@type': 'PublicationIssue',
        issueNumber: '4',
        isPartOf: {
          '@type': 'PublicationVolume',
          volumeNumber: '22',
        },
      },
      pageStart: '101',
      pageEnd: '118',
      abstract: 'A concise article abstract.',
    })}</script></head></html>`;
    const r = jsonldSignal(load(html));
    expect(r.fields.DOI).toBe('10.5555/example.2026.001');
    expect(r.fields.volume).toBe('22');
    expect(r.fields.issue).toBe('4');
    expect(r.fields.page).toBe('101-118');
    expect(r.fields.abstract).toBe('A concise article abstract.');
  });
});
