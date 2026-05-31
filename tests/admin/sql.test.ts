import { describe, it, expect, vi } from 'vitest';
import { makeSqlClient, SqlError } from '../../src/lib/admin/sql';

function mockFetcher(responses: Array<{ status: number; body: string }>) {
  let i = 0;
  return vi.fn(async () => {
    const r = responses[i++] ?? { status: 200, body: '{"meta":[],"data":[],"rows":0}' };
    return new Response(r.body, { status: r.status, headers: { 'content-type': 'application/json' } });
  });
}

describe('makeSqlClient', () => {
  it('posts SQL as text/plain to the right endpoint with bearer auth', async () => {
    const fetcher = mockFetcher([{ status: 200, body: '{"meta":[],"data":[{"x":1}],"rows":1}' }]);
    const client = makeSqlClient({ accountId: 'acc123', token: 'tok456', fetcher: fetcher as any });

    const result = await client.query<{ x: number }>('SELECT 1 AS x FORMAT JSON');

    expect(fetcher).toHaveBeenCalledOnce();
    const call = fetcher.mock.calls[0];
    expect(call[0]).toBe('https://api.cloudflare.com/client/v4/accounts/acc123/analytics_engine/sql');
    expect((call[1] as RequestInit).method).toBe('POST');
    const headers = (call[1] as RequestInit).headers as Record<string, string>;
    expect(headers.authorization).toBe('Bearer tok456');
    expect(headers['content-type']).toContain('text/plain');
    expect((call[1] as RequestInit).body).toBe('SELECT 1 AS x FORMAT JSON');

    expect(result.data).toEqual([{ x: 1 }]);
    expect(result.rows).toBe(1);
  });

  it('parses {meta, data, rows} envelope', async () => {
    const body = JSON.stringify({
      meta: [{ name: 'event', type: 'String' }, { name: 'n', type: 'UInt64' }],
      data: [{ event: 'format', n: 42 }, { event: 'cite_book', n: 12 }],
      rows: 2,
    });
    const fetcher = mockFetcher([{ status: 200, body }]);
    const client = makeSqlClient({ accountId: 'a', token: 't', fetcher: fetcher as any });
    const r = await client.query('q');
    expect(r.meta).toHaveLength(2);
    expect(r.data).toHaveLength(2);
  });

  it('parses JSONEachRow output (newline-delimited objects)', async () => {
    const body = '{"event":"format","n":42}\n{"event":"cite_book","n":12}\n';
    const fetcher = mockFetcher([{ status: 200, body }]);
    const client = makeSqlClient({ accountId: 'a', token: 't', fetcher: fetcher as any });
    const r = await client.query('q');
    expect(r.data).toEqual([
      { event: 'format', n: 42 },
      { event: 'cite_book', n: 12 },
    ]);
  });

  it('throws SqlError with status on non-2xx', async () => {
    const fetcher = mockFetcher([{ status: 401, body: 'unauthenticated' }]);
    const client = makeSqlClient({ accountId: 'a', token: 'bad', fetcher: fetcher as any });
    await expect(client.query('q')).rejects.toMatchObject({
      name: 'SqlError',
      status: 401,
    });
  });

  it('SqlError carries status and a useful message', async () => {
    const fetcher = mockFetcher([{ status: 403, body: 'forbidden' }]);
    const client = makeSqlClient({ accountId: 'a', token: 'bad', fetcher: fetcher as any });
    try {
      await client.query('q');
      throw new Error('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(SqlError);
      expect((e as SqlError).status).toBe(403);
      expect((e as SqlError).message).toContain('403');
      expect((e as SqlError).message).toContain('forbidden');
    }
  });
});
