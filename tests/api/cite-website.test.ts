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
    const res = await handleCiteWebsite(
      new URL('https://m.com/api/cite-website?url=https://x.com/p'),
      null,
      undefined,
      new Date(Date.UTC(2026, 5, 26)),
    );
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.uuid).toBeTruthy();
    expect(body.type).toBe('webpage');
    expect(body.csl.title).toBe('Test Article');
    expect(body.csl.author).toEqual([{ family: 'Doe', given: 'Jane' }]);
    expect(body.csl.accessed).toEqual({ 'date-parts': [[2026, 6, 26]] });
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

  it('uses Browser Run rendered HTML when static fetch looks incomplete', async () => {
    mockHtml(`<!doctype html><html><head><title>Loading...</title></head><body><script>${'x'.repeat(3000)}</script></body></html>`);
    const renderedHtml = `<!doctype html><html><head>
      <title>Rendered Article</title>
      <script type="application/ld+json">${JSON.stringify({
        '@type': 'NewsArticle',
        headline: 'Rendered Article',
        author: 'Jane Doe',
        datePublished: '2026-01-15',
      })}</script>
    </head><body><article>By Jane Doe. ${'Rendered article text. '.repeat(80)}</article></body></html>`;
    const browser = {
      quickAction: vi.fn(async () => new Response(renderedHtml, {
        headers: { 'content-type': 'text/html', 'X-Browser-Ms-Used': '1234' },
      })),
    };

    const res = await handleCiteWebsite(
      new URL('https://m.com/api/cite-website?url=https://x.com/p&acquisition=fetch&nocache=1'),
      null,
      undefined,
      new Date(Date.UTC(2026, 5, 26)),
      { browser },
    );

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(browser.quickAction).toHaveBeenCalledWith('content', expect.objectContaining({ url: 'https://x.com/p' }));
    expect(body.csl.title).toBe('Rendered Article');
    expect(body.csl.author).toEqual([{ family: 'Doe', given: 'Jane' }]);
    expect(body._quality.acquisition.render.status).toBe('success');
    expect(body._quality.acquisition.render.browserMs).toBe(1234);
    expect(body._provenance.title.winner.acquisition).toBe('render');
  });

  it('uses AI only when a proposal is backed by source text evidence', async () => {
    mockHtml(`<!doctype html><html><head><title>Thin Article</title></head>
      <body><main>By Jane Doe. Published January 15, 2026. This is the article body.</main></body></html>`);
    const ai = {
      run: vi.fn(async () => ({
        response: JSON.stringify({
          proposals: [
            {
              field: 'author',
              value: 'Jane Doe',
              evidenceSnippet: 'Jane Doe',
              evidenceSource: 'fetched',
              confidence: 0.9,
            },
            {
              field: 'issued',
              value: 'January 15, 2026',
              evidenceSnippet: 'January 15, 2026',
              evidenceSource: 'fetched',
              confidence: 0.9,
            },
            {
              field: 'publisher',
              value: 'Invented Publisher',
              evidenceSnippet: 'Not in the page',
              evidenceSource: 'fetched',
              confidence: 0.95,
            },
          ],
        }),
      })),
    };

    const res = await handleCiteWebsite(
      new URL('https://m.com/api/cite-website?url=https://x.com/p&ai=0'),
      null,
      undefined,
      new Date(Date.UTC(2026, 5, 26)),
      { ai },
    );

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(ai.run).toHaveBeenCalled();
    expect(body.csl.author).toEqual([{ family: 'Doe', given: 'Jane' }]);
    expect(body.csl.issued).toEqual({ 'date-parts': [[2026, 1, 15]], raw: 'January 15, 2026' });
    expect(body.csl.publisher).toBeUndefined();
    expect(body._provenance.author.winner.source).toBe('ai-extract');
    expect(body._quality.acquisition.ai.fieldsFound).toEqual(['author', 'issued']);
  });

  it('rescues an X post via oEmbed when the page is an empty JS shell', async () => {
    // x.com serves ~nothing to non-browser clients; publish.twitter.com/oembed
    // is the deterministic source for the post text, author, handle, and date.
    const shell = '<!doctype html><html><head><title>X</title></head><body></body></html>';
    const oembed = {
      url: 'https://x.com/jack/status/20',
      author_name: 'jack',
      author_url: 'https://x.com/jack',
      html: '<blockquote class="twitter-tweet"><p lang="en" dir="ltr">just setting up my twttr</p>&mdash; jack (@jack) <a href="https://x.com/jack/status/20?ref_src=twsrc%5Etfw">March 21, 2006</a></blockquote>',
    };
    globalThis.fetch = vi.fn(async (input: any) => {
      const target = String(typeof input === 'string' ? input : input?.url ?? input);
      if (target.includes('publish.twitter.com/oembed')) {
        return new Response(JSON.stringify(oembed), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      return new Response(shell, { status: 200, headers: { 'content-type': 'text/html' } });
    }) as any;

    const res = await handleCiteWebsite(
      new URL('https://m.com/api/cite-website?url=https%3A%2F%2Fx.com%2Fjack%2Fstatus%2F20'),
      null,
      undefined,
      new Date(Date.UTC(2026, 6, 6)),
    );

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.csl.title).toBe('just setting up my twttr');
    expect(body.csl.author).toEqual([{ family: 'jack' }]);
    expect(body.csl.issued).toEqual({ 'date-parts': [[2006, 3, 21]] });
    expect(body.csl['container-title']).toBe('X');
    expect(body.csl.custom.social).toEqual({ platform: 'x', handle: 'jack', displayName: 'jack', kind: 'post' });
    expect(body._provenance.title.winner.source).toBe('oembed');
    expect(body._quality.acquisition.authority.status).toBe('success');
  });

  it('does not call oEmbed when platform HTML extraction already succeeded', async () => {
    // A TikTok page whose hydration blob parses fully — no oEmbed round trip.
    const blob = JSON.stringify({
      __DEFAULT_SCOPE__: {
        'webapp.video-detail': {
          itemInfo: {
            itemStruct: {
              desc: 'Fighting fire with fire. #sciencetok #learnontiktok',
              createTime: '1631899181',
              id: '7008953610872605957',
              author: { nickname: 'Phillip Cook', uniqueId: 'chemteacherphil' },
            },
          },
        },
      },
    });
    const page = `<!doctype html><html><head><script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application/json">${blob}</script></head><body>${'TikTok video page content. '.repeat(60)}</body></html>`;
    const fetchSpy = vi.fn(async () => new Response(page, { status: 200, headers: { 'content-type': 'text/html' } }));
    globalThis.fetch = fetchSpy as any;

    const res = await handleCiteWebsite(
      new URL('https://m.com/api/cite-website?url=https%3A%2F%2Fwww.tiktok.com%2F%40chemteacherphil%2Fvideo%2F7008953610872605957'),
      null,
      undefined,
      new Date(Date.UTC(2026, 6, 6)),
    );

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.csl.title).toBe('Fighting fire with fire. #sciencetok #learnontiktok');
    expect(body.csl.author).toEqual([{ family: 'Cook', given: 'Phillip' }]);
    expect(body.csl.issued).toEqual({ 'date-parts': [[2021, 9, 17]] });
    expect(body.csl.custom.social.platform).toBe('tiktok');
    const oembedCalls = fetchSpy.mock.calls.filter((c) => String(c[0]).includes('oembed'));
    expect(oembedCalls).toHaveLength(0);
  });

  it('allows server policy, not public query params, to disable AI assist', async () => {
    mockHtml(`<!doctype html><html><head><title>Thin Article</title></head>
      <body><main>By Jane Doe. Published January 15, 2026.</main></body></html>`);
    const ai = { run: vi.fn() };

    const res = await handleCiteWebsite(
      new URL('https://m.com/api/cite-website?url=https://x.com/p&ai=1'),
      null,
      undefined,
      new Date(Date.UTC(2026, 5, 26)),
      { ai, aiAssistEnabled: false },
    );

    expect(res.status).toBe(200);
    expect(ai.run).not.toHaveBeenCalled();
  });
});
