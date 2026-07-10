import { describe, it, expect } from 'vitest';
import { buildQueries } from '../../src/lib/admin/queries';

const queries = buildQueries('test_ds');
const byKey = Object.fromEntries(queries.map((q) => [q.key, q]));

describe('buildQueries — structural integrity', () => {
  it('has unique keys', () => {
    const keys = queries.map((q) => q.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('interpolates the dataset name and terminates every query with FORMAT JSON', () => {
    for (const q of queries) {
      expect(q.sql).toContain('test_ds');
      expect(q.sql.trimEnd().endsWith('FORMAT JSON')).toBe(true);
    }
  });

  // Analytics Engine SQL rejects a subquery nested inside another subquery
  // ("cannot nest subqueries inside subqueries", HTTP 422). A FROM-subquery may
  // read from the dataset but not from a second FROM-subquery. This walks the
  // parens, marking each one opened right after `FROM `, and asserts no query
  // ever has two such subquery parens open at once.
  it('never nests a subquery inside a subquery (Analytics Engine 422 guard)', () => {
    const maxSubqueryDepth = (sql: string): number => {
      const s = sql.replace(/\s+/g, ' ');
      const stack: boolean[] = [];
      let max = 0;
      for (let i = 0; i < s.length; i++) {
        if (s[i] === '(') {
          const isSubquery = /FROM $/i.test(s.slice(Math.max(0, i - 5), i));
          stack.push(isSubquery);
          const depth = stack.filter(Boolean).length;
          if (depth > max) max = depth;
        } else if (s[i] === ')') {
          stack.pop();
        }
      }
      return max;
    };
    for (const q of queries) {
      expect(maxSubqueryDepth(q.sql), q.key).toBeLessThanOrEqual(1);
    }
  });

  it('every render kind carries the metadata its renderer needs', () => {
    for (const q of queries) {
      switch (q.render) {
        case 'scalar':
          expect(q.scalarTiles?.length, q.key).toBeGreaterThan(0);
          break;
        case 'linechart':
          expect(q.lineXKey, q.key).toBeTruthy();
          expect(q.lineSeries?.length, q.key).toBeGreaterThan(0);
          break;
        case 'barchart':
          expect(q.barLabelKey, q.key).toBeTruthy();
          expect(q.barValueKey, q.key).toBeTruthy();
          break;
        case 'table':
          expect(q.columns?.length, q.key).toBeGreaterThan(0);
          break;
        case 'tiles':
          expect(q.tilesLabelKey, q.key).toBeTruthy();
          expect(q.tilesValueKey, q.key).toBeTruthy();
          break;
        case 'sparkline':
          expect(q.sparklineValueKey, q.key).toBeTruthy();
          break;
      }
    }
  });
});

describe('buildQueries — panels select the columns their renderer reads', () => {
  // Guards the exact class of bug where a tile/series references a column the
  // SQL never produces (e.g. tile `median_cites_per_user` over a query that only
  // aliases `median_sessions_per_user`).
  it('scalar tiles map to an aliased SQL column', () => {
    for (const q of queries.filter((x) => x.render === 'scalar')) {
      for (const tile of q.scalarTiles ?? []) {
        expect(q.sql, `${q.key}:${tile.key}`).toMatch(new RegExp(`AS ${tile.key}\\b`));
      }
    }
  });

  it('line series + x key map to aliased SQL columns', () => {
    for (const q of queries.filter((x) => x.render === 'linechart')) {
      expect(q.sql).toMatch(new RegExp(`\\b${q.lineXKey}\\b`));
      for (const s of q.lineSeries ?? []) {
        expect(q.sql, `${q.key}:${s.key}`).toMatch(new RegExp(`AS ${s.key}\\b`));
      }
    }
  });

  it('bar label/value keys map to aliased SQL columns', () => {
    for (const q of queries.filter((x) => x.render === 'barchart')) {
      expect(q.sql, `${q.key}:${q.barLabelKey}`).toMatch(new RegExp(`AS ${q.barLabelKey}\\b`));
      expect(q.sql, `${q.key}:${q.barValueKey}`).toMatch(new RegExp(`AS ${q.barValueKey}\\b`));
    }
  });

  it('table columns (non-bar computed keys) are aliased in SQL', () => {
    // Every table column key should appear as an alias somewhere in its SQL.
    for (const q of queries.filter((x) => x.render === 'table')) {
      for (const c of q.columns ?? []) {
        expect(q.sql, `${q.key}:${c.key}`).toMatch(new RegExp(`AS ${c.key}\\b`));
      }
    }
  });
});

describe('buildQueries — session panels exist and target cite events', () => {
  it('includes the headline session KPI panel with the five expected tiles', () => {
    const p = byKey['session_kpis'];
    expect(p).toBeTruthy();
    expect(p.render).toBe('scalar');
    expect((p.scalarTiles ?? []).map((t) => t.key)).toEqual([
      'sessions', 'users', 'citations', 'cites_per_session', 'cites_per_user',
    ]);
  });

  it('scopes session metrics to cite_website (fixed blob7/blob8) and gates on both tags', () => {
    // Analytics Engine's GROUP BY takes only bare column names, so a cross-event
    // if()-normalized identity is impossible; these panels scope to cite_website
    // where sid=blob7 and uid=blob8 are fixed columns.
    for (const key of ['session_kpis', 'engagement_kpis', 'median_cites_kpi', 'sessions_daily', 'cites_per_user_dist']) {
      const sql = byKey[key].sql;
      expect(sql, key).toContain("index1 = 'cite_website'");
      // Both uid and sid must be non-empty so counts reconcile with hosts_by_session.
      expect(sql, key).toContain("blob8 <> ''");
      expect(sql, key).toContain("blob7 <> ''");
      // No cross-event if()-normalization survives (GROUP BY would reject it).
      expect(sql, key).not.toContain("if(index1 = 'cite_website', blob8, blob5)");
    }
  });

  it('weights citation volume by _sample_interval (AE sampling correctness)', () => {
    // count()-based citation totals under-report under AE sampling; the volume
    // counters must use sum(_sample_interval) like the latency panels do.
    expect(byKey['session_kpis'].sql).toContain('sum(_sample_interval) AS citations');
    expect(byKey['sessions_daily'].sql).toContain('sum(_sample_interval) AS citations');
    expect(byKey['hosts_by_session'].sql).toContain('sum(_sample_interval) AS citations');
  });

  it('reads sid/uid from the fixed cite_website columns (blob7/blob8)', () => {
    const sql = byKey['session_kpis'].sql;
    expect(sql).toContain('count(DISTINCT blob7) AS sessions');
    expect(sql).toContain('count(DISTINCT blob8) AS users');
  });

  // Analytics Engine rejects an expression in GROUP BY ("you may only provide
  // column names"). Assert every GROUP BY clause lists bare identifiers only —
  // no `(`, which would signal an if()/toStartOfInterval()/other expression.
  it('never groups by an expression (Analytics Engine columns-only GROUP BY)', () => {
    for (const q of queries) {
      const clauses = q.sql.match(/GROUP BY[^)]*?(?=\n|ORDER BY|LIMIT|FORMAT|$)/gi) ?? [];
      for (const clause of clauses) {
        const body = clause.replace(/^GROUP BY/i, '');
        expect(body, `${q.key}: ${clause.trim()}`).not.toContain('(');
      }
    }
  });

  it('uses quantileExactWeighted for medians (the only AE quantile fn)', () => {
    expect(byKey['median_cites_kpi'].sql).toContain('quantileExactWeighted(0.5)');
    expect(byKey['engagement_kpis'].sql).toContain('quantileExactWeighted(0.5)');
  });

  it('computes host session reach from cite_website blob7 directly', () => {
    const sql = byKey['hosts_by_session'].sql;
    expect(sql).toContain('count(DISTINCT blob7) AS sessions');
    expect(sql).toContain("index1 = 'cite_website'");
  });
});
