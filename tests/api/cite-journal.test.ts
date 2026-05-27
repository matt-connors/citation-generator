import { describe, it, expect, vi, afterEach } from 'vitest';
import { handleCiteJournal } from '../../functions/api/cite-journal/handler';
import { loadFixtureFile } from '../helpers/load-fixture';
import { join } from 'node:path';

const CR_FIX = join(__dirname, '../journal/fixtures/crossref');
const OA_FIX = join(__dirname, '../journal/fixtures/openalex');

function seqMock(...responses: Response[]) {
  let i = 0;
  globalThis.fetch = vi.fn(async () => responses[i++]) as any;
}

describe('handleCiteJournal', () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => { globalThis.fetch = originalFetch; });

  it('400s with no doi/url', async () => {
    const res = await handleCiteJournal(new URL('https://m.com/api/cite-journal'), null);
    expect(res.status).toBe(400);
  });

  it('400s on invalid DOI', async () => {
    const res = await handleCiteJournal(new URL('https://m.com/api/cite-journal?doi=garbage'), null);
    expect(res.status).toBe(400);
    expect((await res.json() as any).code).toBe('invalid_doi');
  });

  it('returns CSL from Crossref on direct DOI', async () => {
    const body = loadFixtureFile(CR_FIX, '10.1038_s41586-021-03828-1.json');
    seqMock(new Response(body, { status: 200 }));
    const res = await handleCiteJournal(new URL('https://m.com/api/cite-journal?doi=10.1038/s41586-021-03828-1'), null);
    expect(res.status).toBe(200);
    const env = await res.json() as any;
    expect(env.type).toBe('article-journal');
    expect(env.csl.title).toBeTruthy();
  });

  it('falls back to OpenAlex when Crossref 404s', async () => {
    const oa = loadFixtureFile(OA_FIX, '10.1038_s41586-021-03828-1.json');
    seqMock(new Response('nope', { status: 404 }), new Response(oa, { status: 200 }));
    const res = await handleCiteJournal(new URL('https://m.com/api/cite-journal?doi=10.1038/s41586-021-03828-1'), null);
    expect(res.status).toBe(200);
  });

  it('returns 404 when both providers miss', async () => {
    seqMock(new Response('nope', { status: 404 }), new Response('nope', { status: 404 }));
    const res = await handleCiteJournal(new URL('https://m.com/api/cite-journal?doi=10.1038/none'), null);
    expect(res.status).toBe(404);
  });
});
