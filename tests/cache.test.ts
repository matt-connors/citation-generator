import { describe, it, expect } from 'vitest';
import { createCacheStore } from '../functions/lib/cache';

describe('cache store', () => {
  function inMemoryCache(): Cache {
    const store = new Map<string, Response>();
    return {
      async match(req: Request | string) {
        const key = typeof req === 'string' ? req : req.url;
        const r = store.get(key);
        return r ? r.clone() : undefined;
      },
      async put(req: Request | string, res: Response) {
        const key = typeof req === 'string' ? req : req.url;
        store.set(key, res.clone());
      },
      async delete() { return true; },
    } as unknown as Cache;
  }

  it('returns undefined on cache miss', async () => {
    const store = createCacheStore(inMemoryCache());
    const got = await store.get('https://x.com/a');
    expect(got).toBeUndefined();
  });

  it('round-trips a JSON response', async () => {
    const store = createCacheStore(inMemoryCache());
    await store.put('https://x.com/a', new Response(JSON.stringify({ ok: 1 }), {
      headers: { 'content-type': 'application/json' },
    }), 86400);
    const got = await store.get('https://x.com/a');
    expect(await got!.json()).toEqual({ ok: 1 });
  });

  it('sets Cache-Control with the provided max-age on stored responses', async () => {
    const cache = inMemoryCache();
    const store = createCacheStore(cache);
    await store.put('https://x.com/a', new Response('hi'), 2592000);
    const got = await cache.match('https://x.com/a');
    expect(got!.headers.get('Cache-Control')).toBe('public, max-age=2592000');
  });
});
