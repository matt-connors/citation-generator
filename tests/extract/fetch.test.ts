import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchHtml, FetchError, isBlockedHost } from '../../functions/lib/extract/fetch';

describe('isBlockedHost', () => {
  it('blocks private / loopback / link-local / metadata, incl. IPv6, mapped, and trailing-dot forms', () => {
    for (const h of [
      '127.0.0.1', '10.0.0.1', '192.168.1.1', '172.16.0.1', '172.31.255.1', '169.254.169.254',
      '100.64.0.1', '0.0.0.0', 'localhost', 'foo.localhost', 'localhost.', '127.0.0.1.',
      '[::1]', '::1', '::', 'fc00::1', 'fe80::1', '[::ffff:127.0.0.1]', '::ffff:7f00:1', '::ffff:a9fe:a9fe',
    ]) {
      expect(isBlockedHost(h)).toBe(true);
    }
  });
  it('allows ordinary public hosts', () => {
    for (const h of ['example.com', 'mlagenerator.com', 'www.nytimes.com', '8.8.8.8', '1.1.1.1', '172.32.0.1', '11.0.0.1']) {
      expect(isBlockedHost(h)).toBe(false);
    }
  });
});

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

  it('refuses private / loopback / metadata hosts without ever calling fetch (SSRF guard)', async () => {
    const spy = vi.fn();
    globalThis.fetch = spy as any;
    for (const u of ['http://127.0.0.1/admin', 'http://169.254.169.254/latest/meta-data', 'http://localhost:8080', 'http://192.168.0.1/', 'http://10.0.0.5/']) {
      await expect(fetchHtml(u)).rejects.toMatchObject({ code: 'blocked' });
    }
    expect(spy).not.toHaveBeenCalled();
  });

  it('blocks a redirect that lands on an internal host', async () => {
    globalThis.fetch = vi.fn(async () => ({ url: 'http://192.168.0.10/secret' })) as any;
    await expect(fetchHtml('https://public.example.com')).rejects.toMatchObject({ code: 'blocked' });
  });

  it('rejects a body that exceeds the size cap', async () => {
    const huge = '<html>' + 'a'.repeat(6_000_000) + '</html>';
    globalThis.fetch = vi.fn(async () => new Response(huge, {
      status: 200, headers: { 'content-type': 'text/html' },
    })) as any;
    await expect(fetchHtml('https://x.com')).rejects.toMatchObject({ code: 'too_large' });
  });
});
