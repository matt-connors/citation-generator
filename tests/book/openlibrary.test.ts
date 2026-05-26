import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchOpenLibrary } from '../../functions/lib/book/openlibrary';
import { loadFixtureFile } from '../helpers/load-fixture';
import { join } from 'node:path';

const FIX = join(__dirname, 'fixtures/openlibrary');

describe('fetchOpenLibrary', () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => { globalThis.fetch = originalFetch; });

  it('returns parsed JSON for a known ISBN', async () => {
    const body = loadFixtureFile(FIX, '9780140449136.json');
    globalThis.fetch = vi.fn(async () => new Response(body, { status: 200, headers: { 'content-type': 'application/json' } })) as any;
    const result = await fetchOpenLibrary('9780140449136');
    expect(result).not.toBeNull();
    expect(result!.title).toBeTruthy();
  });

  it('returns null when OpenLibrary has no data', async () => {
    globalThis.fetch = vi.fn(async () => new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } })) as any;
    const result = await fetchOpenLibrary('9999999999999');
    expect(result).toBeNull();
  });

  it('returns null on 5xx', async () => {
    globalThis.fetch = vi.fn(async () => new Response('boom', { status: 503 })) as any;
    const result = await fetchOpenLibrary('9780140449136');
    expect(result).toBeNull();
  });
});
