import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchGoogleBooks } from '../../functions/lib/book/googlebooks';
import { loadFixtureFile } from '../helpers/load-fixture';
import { join } from 'node:path';

const FIX = join(__dirname, 'fixtures/googlebooks');

describe('fetchGoogleBooks', () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => { globalThis.fetch = originalFetch; });

  it('returns first volumeInfo for a known ISBN', async () => {
    const body = loadFixtureFile(FIX, '9780140449136.json');
    globalThis.fetch = vi.fn(async () => new Response(body, { status: 200, headers: { 'content-type': 'application/json' } })) as any;
    const result = await fetchGoogleBooks('9780140449136');
    expect(result).not.toBeNull();
    expect(result!.title).toBeTruthy();
  });

  it('returns null when items missing', async () => {
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({ totalItems: 0 }), { status: 200, headers: { 'content-type': 'application/json' } })) as any;
    expect(await fetchGoogleBooks('9999999999999')).toBeNull();
  });

  it('returns null on 5xx', async () => {
    globalThis.fetch = vi.fn(async () => new Response('boom', { status: 503 })) as any;
    expect(await fetchGoogleBooks('9780140449136')).toBeNull();
  });
});
