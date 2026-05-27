export interface CacheStore {
  get(key: string): Promise<Response | undefined>;
  put(key: string, response: Response, maxAgeSeconds: number): Promise<void>;
}

export function createCacheStore(cache: Cache): CacheStore {
  return {
    async get(key) {
      const r = await cache.match(new Request(key));
      return r ?? undefined;
    },
    async put(key, response, maxAgeSeconds) {
      const cloned = new Response(response.clone().body, response);
      cloned.headers.set('Cache-Control', `public, max-age=${maxAgeSeconds}`);
      await cache.put(new Request(key), cloned);
    },
  };
}

export function defaultCacheStore(): CacheStore {
  // @ts-ignore — caches.default is Cloudflare-specific, not in standard lib
  return createCacheStore((caches as any).default);
}

export const TTL = {
  WEBSITE: 86_400,
  BOOK_OR_JOURNAL: 2_592_000,
} as const;
