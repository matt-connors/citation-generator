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

  it('scopes session metrics to the three cite events and drops empty uid', () => {
    for (const key of ['session_kpis', 'engagement_kpis', 'median_cites_kpi', 'sessions_daily', 'cites_per_user_dist']) {
      const sql = byKey[key].sql;
      expect(sql, key).toContain("index1 IN ('cite_website', 'cite_book', 'cite_journal')");
      expect(sql, key).toMatch(/<>\s*''/); // a uid<>'' guard
    }
  });

  it('normalizes sid/uid across events (blob7/8 for website, blob4/5 otherwise)', () => {
    const sql = byKey['session_kpis'].sql;
    expect(sql).toContain("if(index1 = 'cite_website', blob7, blob4)");
    expect(sql).toContain("if(index1 = 'cite_website', blob8, blob5)");
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
