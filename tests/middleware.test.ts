import { describe, it, expect } from 'vitest';
import { onRequest } from '../functions/_middleware';

// onRequest = [errorHandling, cors]; compose them the way Cloudflare Pages does:
// errorHandling wraps cors, which wraps the route handler.
function run(request: Request, route: () => Promise<Response>) {
  const [errorHandling, cors] = onRequest as any[];
  const corsCtx = { request, next: route };
  const errCtx = { request, next: () => cors(corsCtx) };
  return errorHandling(errCtx) as Promise<Response>;
}

describe('_middleware', () => {
  it('answers an OPTIONS preflight with 204 + CORS headers and never hits the route', async () => {
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

  it('adds CORS headers to a normal response', async () => {
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
    expect(JSON.parse(raw)).toMatchObject({ error: 'Internal server error', code: 'internal' });
    expect(raw).not.toContain('secret');
    expect(raw).not.toContain('/internal/');
    expect(raw).not.toMatch(/\.ts:/);
  });
});
