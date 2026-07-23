import { describe, it, expect } from 'vitest';
import { runExtractionPipeline } from '../../functions/lib/extract/pipeline';

describe('runExtractionPipeline', () => {
  it('combines all six signals on a well-marked-up page', () => {
    const html = `<!DOCTYPE html><html><head>
      <title>Heur Title — Site</title>
      <meta name="author" content="Plain Meta Author" />
      <meta property="og:title" content="OG Title" />
      <script type="application/ld+json">${JSON.stringify({
        '@type': 'NewsArticle',
        headline: 'JSON-LD Title',
        author: { '@type': 'Person', givenName: 'Jane', familyName: 'Doe' },
        datePublished: '2026-05-26',
      })}</script>
    </head><body></body></html>`;

    const url = 'https://example.com/article';
    const result = runExtractionPipeline(html, url);
    expect(result.csl.id).toBe(url);
    // NewsArticle schema is high-confidence → newspaper, not generic webpage.
    expect(result.csl.type).toBe('article-newspaper');
    expect(result.csl.title).toBe('JSON-LD Title');
    expect(result.csl.author).toEqual([{ family: 'Doe', given: 'Jane' }]);
    expect(result.csl.issued).toEqual({ 'date-parts': [[2026, 5, 26]] });
    expect(result.csl.URL).toBe(url);
    expect(result.signals.title).toBe('jsonld');
  });

  it('falls back to heuristic <title> when nothing else present', () => {
    const html = `<html><head><title>Just A Title</title></head></html>`;
    const result = runExtractionPipeline(html, 'https://x.com/p');
    expect(result.csl.title).toBe('Just A Title');
    expect(result.signals.title).toBe('heuristic');
  });

  it('always sets id, type, and URL from the input URL', () => {
    const result = runExtractionPipeline(`<html></html>`, 'https://example.com/p');
    expect(result.csl.id).toBe('https://example.com/p');
    expect(result.csl.type).toBe('webpage');
    expect(result.csl.URL).toBe('https://example.com/p');
  });

  it('resolves relative canonical URLs against the input URL', () => {
    const result = runExtractionPipeline(
      `<html><head><link rel="canonical" href="/canonical/article" /></head></html>`,
      'https://example.com/path/article?utm_source=x',
    );
    expect(result.csl.URL).toBe('https://example.com/canonical/article');
    expect(result.signals.URL).toBe('heuristic');
  });

  it('deduplicates matching publisher and container-title fields', () => {
    const html = `<!DOCTYPE html><html><head>
      <meta property="og:site_name" content="AP News" />
      <script type="application/ld+json">${JSON.stringify({
        '@type': 'NewsArticle',
        headline: 'T',
        publisher: { '@type': 'Organization', name: 'AP News' },
      })}</script>
    </head></html>`;
    const result = runExtractionPipeline(html, 'https://example.com/p');
    expect(result.csl['container-title']).toBe('AP News');
    expect(result.csl.publisher).toBeUndefined();
  });

  it('promotes journal landing pages when volume, issue, or page metadata is present', () => {
    const html = `<!DOCTYPE html><html><head>
      <meta name="citation_title" content="Scholarly Article" />
      <meta name="citation_journal_title" content="Journal of Testing" />
      <meta name="citation_volume" content="12" />
    </head></html>`;
    const result = runExtractionPipeline(html, 'https://example.com/article');
    expect(result.csl.type).toBe('article-journal');
  });

  it('promotes DOI-only journal landing pages when a journal title is present', () => {
    const html = `<!DOCTYPE html><html><head>
      <meta name="citation_title" content="Early View Reliability Study" />
      <meta name="citation_journal_title" content="Journal of Citation Testing" />
      <meta name="citation_doi" content="https://doi.org/10.5555/jct.2026.early" />
    </head></html>`;
    const result = runExtractionPipeline(html, 'https://example.com/article');
    expect(result.csl.type).toBe('article-journal');
    expect(result.csl.DOI).toBe('10.5555/jct.2026.early');
  });

  it('keeps ordinary site containers as webpages', () => {
    const html = `<!DOCTYPE html><html><head>
      <meta property="og:title" content="News Article" />
      <meta property="og:site_name" content="Example News" />
    </head></html>`;
    const result = runExtractionPipeline(html, 'https://example.com/news');
    expect(result.csl.type).toBe('webpage');
  });

  it('classifies known news hosts as article-newspaper', () => {
    const html = `<!DOCTYPE html><html><head>
      <meta property="og:title" content="Breaking Story" />
      <meta property="og:site_name" content="AP News" />
      <meta property="og:type" content="article" />
    </head></html>`;
    const result = runExtractionPipeline(html, 'https://apnews.com/article/xyz');
    expect(result.csl.type).toBe('article-newspaper');
  });

  it('applies YouTube video field patches for youtube.com URLs', () => {
    const html = `<!DOCTYPE html><html><head>
      <meta property="og:title" content="How Memory Forms" />
      <meta property="og:site_name" content="YouTube" />
      <script type="application/ld+json">${JSON.stringify({
        '@type': 'VideoObject',
        name: 'How Memory Forms',
        author: { '@type': 'Person', name: 'Cognitive Lab' },
        uploadDate: '2024-07-15',
      })}</script>
    </head></html>`;
    const result = runExtractionPipeline(html, 'https://www.youtube.com/watch?v=example');
    expect(result.csl.type).toBe('webpage');
    expect(result.csl.genre).toBe('Video');
    expect(result.csl['container-title']).toBe('YouTube');
    expect(result.csl.title).toBe('How Memory Forms');
    // Channel-style names with org-ish suffixes (Lab) stay as literal authors.
    expect(result.csl.author).toEqual([{ literal: 'Cognitive Lab' }]);
    expect(result.csl.issued).toEqual({ 'date-parts': [[2024, 7, 15]] });
    // Provenance must carry genre so multi-pass merge keeps APA [Video].
    expect(result.provenance.genre?.winner?.normalizedValue).toBe('Video');
    expect(result.provenance.genre?.winner?.source).toBe('type-inference');
    expect(result.typeWarnings).toEqual([]);
  });

  it('emits typeWarnings for ambiguous government pages', () => {
    const html = `<!DOCTYPE html><html><head>
      <title>Diabetes Basics | CDC</title>
      <meta property="og:title" content="Diabetes Basics" />
      <meta property="og:site_name" content="CDC" />
    </head></html>`;
    const result = runExtractionPipeline(html, 'https://www.cdc.gov/diabetes/about/index.html');
    expect(result.csl.type).toBe('webpage');
    expect(result.typeWarnings).toEqual([
      expect.objectContaining({
        code: 'source_type_ambiguous',
        action: 'choose-source-type',
      }),
    ]);
  });

  describe('wikipedia title override', () => {
    // Wikipedia's JSON-LD `headline` is the article description, not the title.
    // The override prefers the heuristic <title> tag for *.wikipedia.org hosts.
    const wikiHtml = `<html><head>
      <title>Foo - Wikipedia</title>
      <script type="application/ld+json">${JSON.stringify({
        '@type': 'Article',
        name: 'Foo',
        headline: 'bar description not title',
      })}</script>
    </head></html>`;

    it('prefers heuristic <title> over JSON-LD headline on en.wikipedia.org', () => {
      const result = runExtractionPipeline(wikiHtml, 'https://en.wikipedia.org/wiki/Foo');
      expect(result.csl.title).toBe('Foo');
      expect(result.signals.title).toBe('heuristic');
    });

    it('applies on bare wikipedia.org host', () => {
      const result = runExtractionPipeline(wikiHtml, 'https://wikipedia.org/wiki/Foo');
      expect(result.csl.title).toBe('Foo');
      expect(result.signals.title).toBe('heuristic');
    });

    it('does NOT apply on lookalike subdomain attacks', () => {
      const result = runExtractionPipeline(wikiHtml, 'https://en.wikipedia.org.evil.com/Foo');
      expect(result.csl.title).toBe('bar description not title');
      expect(result.signals.title).toBe('jsonld');
    });

    it('does NOT apply on unrelated hosts', () => {
      const result = runExtractionPipeline(wikiHtml, 'https://example.com/Foo');
      expect(result.csl.title).toBe('bar description not title');
      expect(result.signals.title).toBe('jsonld');
    });
  });
});
