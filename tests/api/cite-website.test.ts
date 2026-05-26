import { describe, it, expect, vi, afterEach } from 'vitest';
import { handleCiteWebsite } from '../../functions/api/cite-website/handler';

const HTML_OK = `<!DOCTYPE html><html><head>
  <title>Test Article</title>
  <script type="application/ld+json">${JSON.stringify({
    '@type': 'NewsArticle',
    headline: 'Test Article',
    author: { '@type': 'Person', givenName: 'Jane', familyName: 'Doe' },
    datePublished: '2026-01-15',
  })}</script>
</head></html>`;

describe('handleCiteWebsite', () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => { globalThis.fetch = originalFetch; });

  function mockHtml(html: string, status = 200) {
    globalThis.fetch = vi.fn(async () => new Response(html, {
      status, headers: { 'content-type': 'text/html' },
    })) as any;
  }

  it('returns 400 when no url param', async () => {
    const res = await handleCiteWebsite(new URL('https://m.com/api/cite-website'), null);
    expect(res.status).toBe(400);
    const body = await res.json() as any;
    expect(body.code).toBe('invalid_url');
  });

  it('extracts CSL from a normal HTML page', async () => {
    mockHtml(HTML_OK);
    const res = await handleCiteWebsite(new URL('https://m.com/api/cite-website?url=https://x.com/p'), null);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.uuid).toBeTruthy();
    expect(body.type).toBe('webpage');
    expect(body.csl.title).toBe('Test Article');
    expect(body.csl.author).toEqual([{ family: 'Doe', given: 'Jane' }]);
    expect(body._cached).toBe(false);
  });

  it('returns cached body when cache is warm', async () => {
    mockHtml(HTML_OK);
    const cacheStore = new Map<string, Response>();
    const fakeCache = {
      async get(k: string) { return cacheStore.get(k)?.clone(); },
      async put(k: string, r: Response) { cacheStore.set(k, r.clone()); },
    };
    const url = new URL('https://m.com/api/cite-website?url=https://x.com/p');
    const first = await handleCiteWebsite(url, fakeCache);
    expect((await first.clone().json() as any)._cached).toBe(false);
    const second = await handleCiteWebsite(url, fakeCache);
    expect((await second.json() as any)._cached).toBe(true);
  });

  it('returns 400 on fetch failure', async () => {
    globalThis.fetch = vi.fn(async () => new Response('nope', { status: 404, headers: { 'content-type': 'text/html' } })) as any;
    const res = await handleCiteWebsite(new URL('https://m.com/api/cite-website?url=https://x.com/p'), null);
    expect(res.status).toBe(400);
    const body = await res.json() as any;
    expect(body.code).toBe('fetch_failed');
  });
});
