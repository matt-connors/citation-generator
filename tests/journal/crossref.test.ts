import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchCrossref } from '../../functions/lib/journal/crossref';
import { loadFixtureFile } from '../helpers/load-fixture';
import { join } from 'node:path';

const FIX = join(__dirname, 'fixtures/crossref');

describe('fetchCrossref', () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => { globalThis.fetch = originalFetch; });

  it('returns the .message object on success', async () => {
    const body = loadFixtureFile(FIX, '10.1038_s41586-021-03828-1.json');
    globalThis.fetch = vi.fn(async () => new Response(body, { status: 200 })) as any;
    const r = await fetchCrossref('10.1038/s41586-021-03828-1');
    expect(r).not.toBeNull();
    expect(r!.title).toBeDefined();
  });

  it('returns null on 404', async () => {
    globalThis.fetch = vi.fn(async () => new Response('nope', { status: 404 })) as any;
    expect(await fetchCrossref('10.0/none')).toBeNull();
  });
});
