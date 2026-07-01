import { describe, it, expect } from 'vitest';
import { onRequest } from '../functions/_middleware';

// onRequest = [errorHandling, adminAuth, trailingSlash, cors]; compose them the
// way Cloudflare Pages does: each wraps the next, out to the route handler.
function run(request: Request, route: () => Promise<Response>, env: Record<string, unknown> = {}) {
  const [errorHandling, adminAuth, trailingSlash, cors] = onRequest as any[];
  const corsCtx = { request, env, next: route };
  const tsCtx = { request, env, next: () => cors(corsCtx) };
  const authCtx = { request, env, next: () => trailingSlash(tsCtx) };
  const errCtx = { request, env, next: () => adminAuth(authCtx) };
  return errorHandling(errCtx) as Promise<Response>;
}

describe('_middleware', () => {
  it('answers a non-admin OPTIONS preflight with 204 + CORS and never hits the route', async () => {
    let routeHit = false;
    const res = await run(
      new Request('https://m.com/api/format', { method: 'OPTIONS' }),
      async () => { routeHit = true; return new Response('x'); },
    );
    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(res.headers.get('Access-Control-Allow-Methods')).toContain('POST');
    expect(routeHit).toBe(false);
  });

  it('adds CORS headers to a normal API response', async () => {
    const res = await run(
      new Request('https://m.com/api/x'),
      async () => new Response('ok', { status: 200 }),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(await res.text()).toBe('ok');
  });

  it('returns a generic 500 without leaking the error message or stack', async () => {
    const res = await run(
      new Request('https://m.com/api/x'),
      async () => { throw new Error('boom: secret token at /internal/secret/path.ts:42'); },
    );
    expect(res.status).toBe(500);
    const raw = await res.text();
    expect(raw).toBe('Internal server error');
    expect(raw).not.toContain('secret');
    expect(raw).not.toMatch(/\.ts:/);
  });

  it('gates /admin failure-closed (503 when no password) with no CORS header', async () => {
    const res = await run(new Request('https://m.com/admin'), async () => new Response('admin'), {});
    expect(res.status).toBe(503);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });

  it('308-redirects a no-slash SSR page path to add the trailing slash, skipping the route', async () => {
    let routeHit = false;
    const res = await run(
      new Request('https://m.com/guides'),
      async () => { routeHit = true; return new Response('x'); },
    );
    expect(res.status).toBe(308);
    expect(res.headers.get('location')).toBe('https://m.com/guides/');
    expect(routeHit).toBe(false);
  });

  it('preserves the query string when adding the trailing slash', async () => {
    const res = await run(
      new Request('https://m.com/about?ref=x'),
      async () => new Response('x'),
    );
    expect(res.status).toBe(308);
    expect(res.headers.get('location')).toBe('https://m.com/about/?ref=x');
  });

  it('leaves paths that already end in a slash alone', async () => {
    const res = await run(
      new Request('https://m.com/guides/'),
      async () => new Response('ok', { status: 200 }),
    );
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('ok');
  });

  it('does not add a trailing slash to API, Astro-internal, or file paths', async () => {
    for (const path of ['/api/format', '/_image', '/robots.txt']) {
      const res = await run(
        new Request(`https://m.com${path}`),
        async () => new Response('passed', { status: 200 }),
      );
      expect(res.status).toBe(200);
      expect(await res.text()).toBe('passed');
    }
  });
});
