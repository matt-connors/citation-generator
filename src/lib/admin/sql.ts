/**
 * Minimal Cloudflare Analytics Engine SQL client.
 *
 * Posts raw SQL to https://api.cloudflare.com/.../analytics_engine/sql,
 * returns parsed JSON rows. No retry, no caching — the admin dashboard
 * runs every query on every load, and the dashboard already gates access
 * via basic auth, so this is intentionally simple.
 *
 * The API token needs `Account → Account Analytics → Read` scope. The
 * account ID is the one shown at the top of the Cloudflare dashboard
 * URL when viewing the Pages project.
 */

export interface SqlClientConfig {
  accountId: string;
  token: string;
  /** Optional fetcher injection for tests. */
  fetcher?: typeof fetch;
}

export interface SqlMeta {
  name: string;
  type: string;
}

export interface SqlResult<T = Record<string, unknown>> {
  meta: SqlMeta[];
  data: T[];
  rows: number;
  rows_before_limit_at_least?: number;
}

export class SqlError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'SqlError';
  }
}

export function makeSqlClient(cfg: SqlClientConfig) {
  const f = cfg.fetcher ?? fetch;
  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${cfg.accountId}/analytics_engine/sql`;
  return {
    async query<T = Record<string, unknown>>(sql: string): Promise<SqlResult<T>> {
      const res = await f(endpoint, {
        method: 'POST',
        headers: {
          'authorization': `Bearer ${cfg.token}`,
          'content-type': 'text/plain;charset=UTF-8',
        },
        body: sql,
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new SqlError(res.status, `Analytics Engine SQL ${res.status}: ${text || res.statusText}`);
      }
      // Cloudflare AE returns FORMAT JSONEachRow by default for direct REST
      // calls. To get a structured `{meta, data, rows}` envelope we'd need to
      // add `FORMAT JSON` ourselves — but JSONEachRow is fine for typing
      // here because we control the SQL.
      const text = await res.text();
      try {
        // First try the structured `{meta, data, rows}` envelope.
        const parsed = JSON.parse(text);
        if (parsed && Array.isArray(parsed.data)) {
          return parsed as SqlResult<T>;
        }
        // Single-row JSON: wrap.
        return { meta: [], data: [parsed as T], rows: 1 };
      } catch {
        // JSONEachRow: newline-delimited objects.
        const data = text
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean)
          .map((line) => JSON.parse(line) as T);
        return { meta: [], data, rows: data.length };
      }
    },
  };
}

export type SqlClient = ReturnType<typeof makeSqlClient>;
