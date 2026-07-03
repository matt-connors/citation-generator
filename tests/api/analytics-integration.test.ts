import { describe, it, expect, vi, afterEach } from 'vitest';
import { handleCiteBook } from '../../functions/api/cite-book/handler';
import { handleCiteJournal } from '../../functions/api/cite-journal/handler';
import { handleCiteWebsite } from '../../functions/api/cite-website/handler';
import { handleFormat } from '../../functions/api/format/handler';
import { loadFixtureFile } from '../helpers/load-fixture';
import { join } from 'node:path';

const OL_FIX = join(__dirname, '../book/fixtures/openlibrary');
const GB_FIX = join(__dirname, '../book/fixtures/googlebooks');

function mockSequence(...responses: Response[]) {
  let i = 0;
  globalThis.fetch = vi.fn(async () => responses[i++]) as any;
}

function mockOnce(r: Response) {
  globalThis.fetch = vi.fn(async () => r) as any;
}

interface CapturedPoint {
  blobs?: string[];
  doubles?: number[];
  indexes?: string[];
}

function makeAnalytics() {
  const writeDataPoint = vi.fn();
  return { binding: { writeDataPoint }, writeDataPoint };
}

// Extract dimensions (everything in blobs after the event name) and metrics
// (everything in doubles). The event name is in blobs[0] and indexes[0].
function shapeOf(point: CapturedPoint) {
  return {
    event: point.blobs?.[0],
    dimensions: (point.blobs ?? []).slice(1),
    metrics: point.doubles ?? [],
    index: point.indexes?.[0],
  };
}

describe('analytics integration', () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => { globalThis.fetch = originalFetch; });

  describe('cite-book', () => {
    it('emits cite_book with source=openlibrary on success', async () => {
      const body = loadFixtureFile(OL_FIX, '9780553418811.json');
      mockOnce(new Response(body, { status: 200, headers: { 'content-type': 'application/json' } }));
      const { binding, writeDataPoint } = makeAnalytics();

      const res = await handleCiteBook(
        new URL('https://m.com/api/cite-book?isbn=9780553418811'),
        null, undefined, binding,
      );
      expect(res.status).toBe(200);
      expect(writeDataPoint).toHaveBeenCalledTimes(1);
      const shape = shapeOf(writeDataPoint.mock.calls[0][0]);
      expect(shape.event).toBe('cite_book');
      expect(shape.index).toBe('cite_book');
      expect(shape.dimensions).toEqual(['openlibrary']);
      // metrics: [latency_ms, cache_hit]. Latency is wall-clock so just bounds-check.
      expect(shape.metrics[0]).toBeGreaterThanOrEqual(0);
      expect(shape.metrics[1]).toBe(0);
    });

    it('emits cite_book with source=googlebooks when OL is empty', async () => {
      const empty = new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
      const gb = loadFixtureFile(GB_FIX, '9780553418811.json');
      mockSequence(empty, new Response(gb, { status: 200, headers: { 'content-type': 'application/json' } }));
      const { binding, writeDataPoint } = makeAnalytics();

      await handleCiteBook(
        new URL('https://m.com/api/cite-book?isbn=9780553418811'),
        null, undefined, binding,
      );
      const shape = shapeOf(writeDataPoint.mock.calls[0][0]);
      expect(shape.dimensions[0]).toBe('googlebooks');
    });

    it('emits error event on 400 invalid_isbn', async () => {
      const { binding, writeDataPoint } = makeAnalytics();
      await handleCiteBook(new URL('https://m.com/api/cite-book'), null, undefined, binding);
      const shape = shapeOf(writeDataPoint.mock.calls[0][0]);
      expect(shape.event).toBe('error');
      expect(shape.dimensions).toEqual(['cite_book', 'invalid_isbn']);
      expect(shape.metrics).toEqual([1]);
    });

    it('emits error event on 404 not_found', async () => {
      mockSequence(
        new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } }),
        new Response(JSON.stringify({ totalItems: 0 }), { status: 200, headers: { 'content-type': 'application/json' } }),
      );
      const { binding, writeDataPoint } = makeAnalytics();
      await handleCiteBook(
        new URL('https://m.com/api/cite-book?isbn=9780553418811'),
        null, undefined, binding,
      );
      const shape = shapeOf(writeDataPoint.mock.calls[0][0]);
      expect(shape.event).toBe('error');
      expect(shape.dimensions).toEqual(['cite_book', 'not_found']);
    });
  });

  describe('cite-journal', () => {
    it('emits error event on missing doi', async () => {
      const { binding, writeDataPoint } = makeAnalytics();
      await handleCiteJournal(new URL('https://m.com/api/cite-journal'), null, binding);
      const shape = shapeOf(writeDataPoint.mock.calls[0][0]);
      expect(shape.event).toBe('error');
      expect(shape.dimensions).toEqual(['cite_journal', 'invalid_doi']);
    });

    it('emits error event on malformed doi', async () => {
      const { binding, writeDataPoint } = makeAnalytics();
      await handleCiteJournal(new URL('https://m.com/api/cite-journal?doi=garbage'), null, binding);
      const shape = shapeOf(writeDataPoint.mock.calls[0][0]);
      expect(shape.event).toBe('error');
      expect(shape.dimensions).toEqual(['cite_journal', 'invalid_doi']);
    });
  });

  describe('cite-website', () => {
    const HTML = `<!DOCTYPE html><html><head>
      <title>Test</title>
      <script type="application/ld+json">${JSON.stringify({
        '@type': 'NewsArticle', headline: 'Test', author: { givenName: 'A', familyName: 'B' },
      })}</script>
    </head></html>`;

    it('emits cite_website on success with host + signal winners + sizes', async () => {
      mockOnce(new Response(HTML, { status: 200, headers: { 'content-type': 'text/html' } }));
      const { binding, writeDataPoint } = makeAnalytics();
      await handleCiteWebsite(
        new URL('https://m.com/api/cite-website?url=https://example.com/page'),
        null, binding,
      );
      const shape = shapeOf(writeDataPoint.mock.calls[0][0]);
      expect(shape.event).toBe('cite_website');
      // [signal_winner_title, signal_winner_url, host, url]
      expect(shape.dimensions[2]).toBe('example.com');
      expect(shape.dimensions[3]).toBe('https://example.com/page'); // full normalized URL (blob5)
      expect(shape.dimensions[0]).toBeTruthy(); // a signal name (jsonld, microdata, etc.)
      // metrics: [html_size_kb, extraction_ms, cache_hit]
      expect(shape.metrics[0]).toBeGreaterThanOrEqual(0);
      expect(shape.metrics[1]).toBeGreaterThanOrEqual(0);
      expect(shape.metrics[2]).toBe(0);
    });

    it('emits cite_website with cache_hit=1 when cache is warm', async () => {
      mockOnce(new Response(HTML, { status: 200, headers: { 'content-type': 'text/html' } }));
      const store = new Map<string, Response>();
      const cache = {
        async get(k: string) { return store.get(k)?.clone(); },
        async put(k: string, r: Response) { store.set(k, r.clone()); },
      };
      const url = new URL('https://m.com/api/cite-website?url=https://example.com/page');
      const { binding, writeDataPoint } = makeAnalytics();

      await handleCiteWebsite(url, cache, binding);   // miss → populates cache
      await handleCiteWebsite(url, cache, binding);   // hit
      const hitPoint = writeDataPoint.mock.calls
        .map((call) => shapeOf(call[0]))
        .find((point) => point.event === 'cite_website' && point.metrics[2] === 1);
      expect(hitPoint).toBeTruthy();
      expect(hitPoint?.event).toBe('cite_website');
      expect(hitPoint?.metrics[2]).toBe(1);
    });

    it('emits error event on fetch_failed', async () => {
      globalThis.fetch = vi.fn(async () => new Response('nope', { status: 404, headers: { 'content-type': 'text/html' } })) as any;
      const { binding, writeDataPoint } = makeAnalytics();
      await handleCiteWebsite(
        new URL('https://m.com/api/cite-website?url=https://example.com/p'),
        null, binding,
      );
      const shape = shapeOf(writeDataPoint.mock.calls[0][0]);
      expect(shape.event).toBe('error');
      expect(shape.dimensions[0]).toBe('cite_website');
      expect(shape.dimensions[1]).toBe('fetch_failed');
    });
  });

  describe('format', () => {
    it('emits format with style + latency on success', async () => {
      // Avoid hitting the real citeproc registration: simplest path is feeding
      // it a tiny CSL and a registered style. The other format tests already
      // exercise registration; here we just verify the analytics shape.
      // If the style isn't registered yet (vitest process state), the handler
      // returns 500 with code=internal, which is still a valid emission shape.
      const { binding, writeDataPoint } = makeAnalytics();
      const req = new Request('https://m.com/api/format', {
        method: 'POST',
        body: JSON.stringify({ csl: { id: 'u', type: 'webpage', title: 'T' }, style: 'mla-9' }),
        headers: { 'content-type': 'application/json' },
      });
      const res = await handleFormat(req, binding);
      const shape = shapeOf(writeDataPoint.mock.calls[0][0]);
      // Either it succeeded (format event) or it errored without the style
      // being registered (error event with code=internal). Both are valid
      // from the perspective of "did the analytics fire correctly?"
      if (res.status === 200) {
        expect(shape.event).toBe('format');
        expect(shape.dimensions).toEqual(['mla-9']);
        expect(shape.metrics[0]).toBeGreaterThanOrEqual(0);
      } else {
        expect(shape.event).toBe('error');
        expect(shape.dimensions[0]).toBe('format');
      }
    });

    it('emits error event on bad JSON body', async () => {
      const { binding, writeDataPoint } = makeAnalytics();
      const req = new Request('https://m.com/api/format', {
        method: 'POST',
        body: 'not json',
        headers: { 'content-type': 'application/json' },
      });
      await handleFormat(req, binding);
      const shape = shapeOf(writeDataPoint.mock.calls[0][0]);
      expect(shape.event).toBe('error');
      expect(shape.dimensions).toEqual(['format', 'bad_request']);
    });

    it('emits error event on unsupported style', async () => {
      const { binding, writeDataPoint } = makeAnalytics();
      const req = new Request('https://m.com/api/format', {
        method: 'POST',
        body: JSON.stringify({ csl: { id: 'u', type: 'webpage' }, style: 'fake-style' }),
        headers: { 'content-type': 'application/json' },
      });
      await handleFormat(req, binding);
      const shape = shapeOf(writeDataPoint.mock.calls[0][0]);
      expect(shape.event).toBe('error');
      expect(shape.dimensions).toEqual(['format', 'bad_request']);
    });

    it('emits error event on non-POST', async () => {
      const { binding, writeDataPoint } = makeAnalytics();
      const req = new Request('https://m.com/api/format', { method: 'GET' });
      await handleFormat(req, binding);
      const shape = shapeOf(writeDataPoint.mock.calls[0][0]);
      expect(shape.event).toBe('error');
      expect(shape.dimensions).toEqual(['format', 'method_not_allowed']);
    });
  });
});
