import { describe, it, expect } from 'vitest';
import { onRequest } from '../functions/_middleware';

// Compose the middleware array the way Cloudflare Pages does: each middleware
// receives a `next` that calls the next middleware, ending at the route handler.
function run(request: Request, route: () => Promise<Response>, env: Record<string, unknown> = {}) {
  const middleware = onRequest as any[];
  const next = middleware.reduceRight(
    (inner, fn) => () => fn({ request, env, next: inner }),
    route,
  );
  return next() as Promise<Response>;
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

  it('redirects worker-routed no-slash pages before the route handler', async () => {
    let routeHit = false;
    const res = await run(
      new Request('https://m.com/my-references?citationStyle=mla-9'),
      async () => { routeHit = true; return new Response('references'); },
    );

    expect(res.status).toBe(301);
    expect(res.headers.get('location')).toBe('https://m.com/my-references/?citationStyle=mla-9');
    expect(routeHit).toBe(false);
  });

  it('redirects HEAD checks for worker-routed no-slash pages', async () => {
    let routeHit = false;
    const res = await run(
      new Request('https://m.com/my-references', { method: 'HEAD' }),
      async () => { routeHit = true; return new Response('references'); },
    );

    expect(res.status).toBe(301);
    expect(res.headers.get('location')).toBe('https://m.com/my-references/');
    expect(routeHit).toBe(false);
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
});
