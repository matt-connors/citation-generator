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
    expect(result.csl.type).toBe('webpage');
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
});
