import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchHtml, FetchError } from '../../functions/lib/extract/fetch';

describe('fetchHtml', () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => { globalThis.fetch = originalFetch; });

  it('returns html + finalUrl on a normal text/html response', async () => {
    globalThis.fetch = vi.fn(async () => new Response('<html>ok</html>', {
      status: 200,
      headers: { 'content-type': 'text/html; charset=utf-8' },
    })) as any;
    const { html, finalUrl } = await fetchHtml('https://x.com');
    expect(html).toContain('<html>');
    expect(finalUrl).toBe('https://x.com/');
  });

  it('rejects non-HTML content', async () => {
    globalThis.fetch = vi.fn(async () => new Response('binary', {
      status: 200,
      headers: { 'content-type': 'application/pdf' },
    })) as any;
    await expect(fetchHtml('https://x.com')).rejects.toMatchObject({ code: 'not_html' });
  });

  it('rejects non-2xx responses', async () => {
    globalThis.fetch = vi.fn(async () => new Response('nope', {
      status: 404, headers: { 'content-type': 'text/html' },
    })) as any;
    await expect(fetchHtml('https://x.com')).rejects.toMatchObject({ code: 'fetch_failed' });
  });

  it('sets a modern user-agent header', async () => {
    const spy = vi.fn(async () => new Response('<html></html>', {
      status: 200, headers: { 'content-type': 'text/html' },
    }));
    globalThis.fetch = spy as any;
    await fetchHtml('https://x.com');
    const init = spy.mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>)['User-Agent']).toMatch(/mlagenerator/i);
  });
});
