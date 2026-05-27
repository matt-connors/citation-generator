import { describe, it, expect, vi, afterEach } from 'vitest';
import { handleCiteBook } from '../../functions/api/cite-book/handler';
import { loadFixtureFile } from '../helpers/load-fixture';
import { join } from 'node:path';

const OL_FIX = join(__dirname, '../book/fixtures/openlibrary');
const GB_FIX = join(__dirname, '../book/fixtures/googlebooks');

function mockSequence(...responses: Response[]) {
  let i = 0;
  globalThis.fetch = vi.fn(async () => responses[i++]) as any;
}

describe('handleCiteBook', () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => { globalThis.fetch = originalFetch; });

  it('returns 400 on missing isbn', async () => {
    const res = await handleCiteBook(new URL('https://m.com/api/cite-book'), null);
    expect(res.status).toBe(400);
    expect((await res.json() as any).code).toBe('invalid_isbn');
  });

  it('returns 400 on malformed isbn', async () => {
    const res = await handleCiteBook(new URL('https://m.com/api/cite-book?isbn=abc'), null);
    expect(res.status).toBe(400);
    expect((await res.json() as any).code).toBe('invalid_isbn');
  });

  it('uses OpenLibrary when it returns data', async () => {
    const body = loadFixtureFile(OL_FIX, '9780553418811.json');
    mockSequence(new Response(body, { status: 200, headers: { 'content-type': 'application/json' } }));
    const res = await handleCiteBook(new URL('https://m.com/api/cite-book?isbn=9780553418811'), null);
    expect(res.status).toBe(200);
    const env = await res.json() as any;
    expect(env.type).toBe('book');
    expect(env.csl.title).toBeTruthy();
  });

  it('falls back to Google Books when OpenLibrary empty', async () => {
    const empty = new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
    const gb = loadFixtureFile(GB_FIX, '9780553418811.json');
    mockSequence(empty, new Response(gb, { status: 200, headers: { 'content-type': 'application/json' } }));
    const res = await handleCiteBook(new URL('https://m.com/api/cite-book?isbn=9780553418811'), null);
    expect(res.status).toBe(200);
  });

  it('returns 404 when both providers miss', async () => {
    mockSequence(
      new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } }),
      new Response(JSON.stringify({ totalItems: 0 }), { status: 200, headers: { 'content-type': 'application/json' } }),
    );
    const res = await handleCiteBook(new URL('https://m.com/api/cite-book?isbn=9780553418811'), null);
    expect(res.status).toBe(404);
    expect((await res.json() as any).code).toBe('not_found');
  });
});
