/**
 * Named dashboard queries. Each carries its SQL plus enough metadata
 * (title, description, column ordering, render hint) for the page to
 * render a consistent panel without per-query branching in the template.
 *
 * Dataset name is parameterized so the user can override via
 * ANALYTICS_DATASET env var. SQL is `FORMAT JSON`-suffixed so the
 * SQL client gets the `{meta, data, rows}` envelope it knows how to
 * parse.
 */

export type RenderKind = 'tiles' | 'sparkline' | 'table' | 'scalar' | 'linechart' | 'barchart';

export interface QueryDef {
  key: string;
  title: string;
  description: string;
  render: RenderKind;
  /** Column metadata for table-render panels. */
  columns?: Array<{
    key: string;
    label: string;
    align?: 'left' | 'right';
    /** If true, the column draws an inline bar proportional to the row max. */
    bar?: boolean;
  }>;
  /** Tiles use a `label` column for the event/label and `count` for the value. */
  tilesLabelKey?: string;
  tilesValueKey?: string;
  /** Sparklines use one row per bucket; `bucketKey` for the x label, `valueKey` for height. */
  sparklineBucketKey?: string;
  sparklineValueKey?: string;
  sparklineWindowLabel?: string;
  /**
   * Scalar (KPI) panels read a single row and surface one tile per entry here.
   * `unit: 'pct'` renders the value as a percentage; `hint` is small helper text.
   */
  scalarTiles?: Array<{ key: string; label: string; unit?: 'pct'; hint?: string }>;
  /** Line-chart panels: `lineXKey` labels the x-axis; each series maps a column to a color. */
  lineXKey?: string;
  lineSeries?: Array<{ key: string; label: string; color: string }>;
  /** Bar-chart panels: `barLabelKey` labels each bar, `barValueKey` is its height. */
  barLabelKey?: string;
  barValueKey?: string;
  sql: string;
}

export function buildQueries(dataset: string): QueryDef[] {
  const J = 'FORMAT JSON';

  // Session/identity metrics are scoped to cite_website, where the session tag
  // (sid) and user tag (uid) sit at fixed columns blob7 and blob8. Two Analytics
  // Engine limits force this: GROUP BY accepts only bare column names (not an
  // if()/expression), and a subquery cannot be nested inside another subquery.
  // A cross-event identity would need an if() to normalize sid/uid across blob
  // positions — which GROUP BY rejects — and moving that normalization into a
  // projection subquery, then grouping in a second, exceeds the one-subquery
  // limit. cite_website is the dominant citation path, so the panels scope to it
  // directly (as hosts_by_session already does) and every GROUP BY is a column.
  // Blob map for cite_website: blob4=host, blob5=url, blob6=from, blob7=sid,
  // blob8=uid; double3=cache_hit.
  //
  // BOTH tags must be non-empty: pre-feature rows and storage-disabled browsers
  // emit uid='', and a partial-storage browser can emit a valid uid with an empty
  // sid — counting that '' as a distinct session would inflate totals and stop
  // them reconciling with hosts_by_session (which gates blob7<>''). Citation
  // volume uses sum(_sample_interval), not count(), so it survives AE sampling.
  const IDENT_WHERE = "index1 = 'cite_website' AND blob8 <> '' AND blob7 <> '' AND timestamp >= NOW() - INTERVAL '30' DAY";

  // Per-user rollup: one row per user (uid = blob8), computed in a single
  // subquery that reads straight from the dataset and groups by the bare blob8
  // column — so it satisfies both the no-nested-subquery and columns-only-GROUP-BY
  // limits. The outer query then aggregates across users on the plain column `v`.
  const perUser = (agg: string) => `
        SELECT blob8 AS uid, ${agg} AS v
        FROM ${dataset}
        WHERE ${IDENT_WHERE}
        GROUP BY blob8`;

  return [
    {
      key: 'session_kpis',
      title: 'Sessions (last 30d)',
      description:
        'The headline funnel: anonymous sessions and users citing web pages, and how many citations each produces. '
        + 'A session rolls over after 30 min idle; a user is a persistent anonymous browser tag. Web citations '
        + '(cite_website) with an identity only — the dominant path; book/journal lookups are excluded so all the '
        + 'session panels count one consistent population.',
      render: 'scalar',
      scalarTiles: [
        { key: 'sessions', label: 'sessions', hint: 'distinct 30-min visits' },
        { key: 'users', label: 'unique users', hint: 'distinct browsers' },
        { key: 'citations', label: 'citations', hint: 'cite events with identity' },
        { key: 'cites_per_session', label: 'cites / session' },
        { key: 'cites_per_user', label: 'cites / user' },
      ],
      sql: `
        SELECT
          count(DISTINCT blob7) AS sessions,
          count(DISTINCT blob8) AS users,
          sum(_sample_interval) AS citations,
          round(sum(_sample_interval) / count(DISTINCT blob7), 2) AS cites_per_session,
          round(sum(_sample_interval) / count(DISTINCT blob8), 2) AS cites_per_user
        FROM ${dataset}
        WHERE ${IDENT_WHERE}
        ${J}
      `,
    },
    {
      key: 'engagement_kpis',
      title: 'Engagement (last 30d)',
      description:
        'The share of users who came back for a second session, and how many sessions the typical user runs — '
        + 'the numbers that say whether the tool earns repeat use. (Median citations per user is the panel below.)',
      render: 'scalar',
      scalarTiles: [
        { key: 'return_users', label: 'return users', hint: '≥ 2 sessions' },
        { key: 'return_rate', label: 'return rate', unit: 'pct' },
        { key: 'median_sessions_per_user', label: 'median sessions / user' },
      ],
      // One per-user rollup (sessions per user) drives all three tiles. The
      // per-user citation median needs a different rollup (raw cite counts, not
      // distinct sessions) and Analytics Engine has no JOIN to combine them in
      // one row, so it lives in its own panel below.
      sql: `
        SELECT
          sum(if(v >= 2, 1, 0)) AS return_users,
          count() AS total_users,
          round(sum(if(v >= 2, 1, 0)) / count(), 4) AS return_rate,
          quantileExactWeighted(0.5)(v, 1) AS median_sessions_per_user
        FROM (${perUser('count(DISTINCT blob7)')})
        ${J}
      `,
    },
    {
      key: 'median_cites_kpi',
      title: 'Typical citation depth (last 30d)',
      description:
        'Median and 90th-percentile citations per user — how deep the middle user and the heaviest users go. '
        + 'Median resists the long tail that skews the mean.',
      render: 'scalar',
      scalarTiles: [
        { key: 'median_cites_per_user', label: 'median cites / user' },
        { key: 'p90_cites_per_user', label: 'p90 cites / user' },
        { key: 'max_cites_per_user', label: 'most by one user' },
      ],
      sql: `
        SELECT
          quantileExactWeighted(0.5)(v, 1) AS median_cites_per_user,
          quantileExactWeighted(0.9)(v, 1) AS p90_cites_per_user,
          max(v) AS max_cites_per_user
        FROM (${perUser('sum(_sample_interval)')})
        ${J}
      `,
    },
    {
      key: 'sessions_daily',
      title: 'Sessions, users & citations per day (last 30d)',
      description: 'Daily distinct sessions and users alongside raw citation volume — the primary growth trend.',
      render: 'linechart',
      lineXKey: 'day',
      lineSeries: [
        { key: 'sessions', label: 'Sessions', color: '#3987e5' },
        { key: 'users', label: 'Users', color: '#199e70' },
        { key: 'citations', label: 'Citations', color: '#c98500' },
      ],
      // GROUP BY needs a bare column, so the day bucket is projected as a column
      // in a single subquery (the toStartOfInterval expression can't sit in the
      // GROUP BY directly), then grouped by that column name in the outer query.
      sql: `
        SELECT
          day,
          count(DISTINCT sid) AS sessions,
          count(DISTINCT uid) AS users,
          sum(_sample_interval) AS citations
        FROM (
          SELECT blob7 AS sid, blob8 AS uid, _sample_interval,
                 toStartOfInterval(timestamp, INTERVAL '1' DAY) AS day
          FROM ${dataset}
          WHERE ${IDENT_WHERE}
        )
        GROUP BY day
        ORDER BY day ASC
        ${J}
      `,
    },
    {
      key: 'cites_per_user_dist',
      title: 'Citations-per-user distribution (last 30d)',
      description:
        'How many users made exactly N citations. A tall left bar (most users cite once or twice) with a long thin '
        + 'tail is the normal shape; the median tile above marks the middle of this distribution.',
      render: 'barchart',
      barLabelKey: 'cites',
      barValueKey: 'users',
      sql: `
        SELECT v AS cites, count() AS users
        FROM (${perUser('count()')})
        GROUP BY cites
        ORDER BY cites ASC
        LIMIT 40
        ${J}
      `,
    },
    {
      key: 'hosts_by_session',
      title: 'Websites by session reach (last 30d)',
      description:
        'Which sites the most distinct sessions cite — session reach, not raw hits, so one power user hammering a '
        + 'domain does not dominate. This is the explicit "what sessions are citing what websites" view.',
      render: 'table',
      columns: [
        { key: 'host', label: 'Host' },
        { key: 'sessions', label: 'Sessions', align: 'right', bar: true },
        { key: 'citations', label: 'Citations', align: 'right' },
      ],
      // cite_website only, so sid is blob7 and host is blob4 at fixed positions —
      // no cross-event normalization needed; count(DISTINCT blob7) is a bare column.
      sql: `
        SELECT
          blob4 AS host,
          count(DISTINCT blob7) AS sessions,
          sum(_sample_interval) AS citations
        FROM ${dataset}
        WHERE index1 = 'cite_website'
          AND blob4 <> ''
          AND blob7 <> ''
          AND timestamp >= NOW() - INTERVAL '30' DAY
        GROUP BY host
        ORDER BY sessions DESC
        LIMIT 20
        ${J}
      `,
    },
    {
      key: 'headline',
      title: 'Activity (last 24h)',
      description: 'Event volume by type. Sanity check that the binding is live.',
      render: 'tiles',
      tilesLabelKey: 'event',
      tilesValueKey: 'events',
      sql: `
        SELECT
          index1 AS event,
          count() AS events
        FROM ${dataset}
        WHERE timestamp >= NOW() - INTERVAL '24' HOUR
        GROUP BY event
        ORDER BY events DESC
        ${J}
      `,
    },
    {
      key: 'events_per_hour',
      title: 'Events per hour (last 24h)',
      description: 'All event types, bucketed hourly.',
      render: 'sparkline',
      sparklineBucketKey: 'hour',
      sparklineValueKey: 'events',
      sparklineWindowLabel: '24h',
      sql: `
        SELECT
          toStartOfInterval(timestamp, INTERVAL '1' HOUR) AS hour,
          count() AS events
        FROM ${dataset}
        WHERE timestamp >= NOW() - INTERVAL '24' HOUR
        GROUP BY hour
        ORDER BY hour ASC
        ${J}
      `,
    },
    {
      key: 'top_styles',
      title: 'Top citation styles (last 7d)',
      description: 'Which CSL styles users actually format with.',
      render: 'table',
      columns: [
        { key: 'style', label: 'Style' },
        { key: 'requests', label: 'Requests', align: 'right', bar: true },
      ],
      sql: `
        SELECT
          blob2 AS style,
          count() AS requests
        FROM ${dataset}
        WHERE index1 = 'format'
          AND timestamp >= NOW() - INTERVAL '7' DAY
        GROUP BY style
        ORDER BY requests DESC
        ${J}
      `,
    },
    {
      key: 'latency_p95',
      title: 'p95 latency by endpoint (last 24h)',
      description: 'cite_website excluded — its double1 is html_size_kb, not latency.',
      render: 'table',
      columns: [
        { key: 'endpoint', label: 'Endpoint' },
        { key: 'p50_ms', label: 'p50 ms', align: 'right' },
        { key: 'p95_ms', label: 'p95 ms', align: 'right', bar: true },
        { key: 'samples', label: 'Samples', align: 'right' },
      ],
      sql: `
        SELECT
          index1 AS endpoint,
          round(quantileWeighted(0.50)(double1, _sample_interval), 1) AS p50_ms,
          round(quantileWeighted(0.95)(double1, _sample_interval), 1) AS p95_ms,
          count() AS samples
        FROM ${dataset}
        WHERE index1 IN ('cite_book', 'cite_journal', 'format')
          AND timestamp >= NOW() - INTERVAL '24' HOUR
        GROUP BY endpoint
        ORDER BY p95_ms DESC
        ${J}
      `,
    },
    {
      key: 'cite_website_extract',
      title: 'cite_website timing (last 24h, fresh only)',
      description: 'fetch_ms (double4) vs extraction_ms (double2) vs html_size_kb (double1). Cache hits skipped.',
      render: 'table',
      // One wide row instead of three rows (Analytics Engine SQL doesn't
      // support UNION ALL, and per-metric bars wouldn't be meaningful with
      // only a single row anyway — bars are most useful for cross-row
      // ranking).
      columns: [
        { key: 'fetch_p50_ms', label: 'Fetch p50', align: 'right' },
        { key: 'fetch_p95_ms', label: 'Fetch p95', align: 'right' },
        { key: 'extract_p50_ms', label: 'Extract p50', align: 'right' },
        { key: 'extract_p95_ms', label: 'Extract p95', align: 'right' },
        { key: 'html_p50_kb', label: 'HTML p50 kb', align: 'right' },
        { key: 'html_p95_kb', label: 'HTML p95 kb', align: 'right' },
        { key: 'samples', label: 'Samples', align: 'right' },
      ],
      sql: `
        SELECT
          round(quantileWeighted(0.50)(double4, _sample_interval), 1) AS fetch_p50_ms,
          round(quantileWeighted(0.95)(double4, _sample_interval), 1) AS fetch_p95_ms,
          round(quantileWeighted(0.50)(double2, _sample_interval), 1) AS extract_p50_ms,
          round(quantileWeighted(0.95)(double2, _sample_interval), 1) AS extract_p95_ms,
          round(quantileWeighted(0.50)(double1, _sample_interval), 1) AS html_p50_kb,
          round(quantileWeighted(0.95)(double1, _sample_interval), 1) AS html_p95_kb,
          count() AS samples
        FROM ${dataset}
        WHERE index1 = 'cite_website' AND double3 = 0
          AND timestamp >= NOW() - INTERVAL '24' HOUR
        ${J}
      `,
    },
    {
      key: 'signal_winners',
      title: 'cite_website title signal winners (last 30d, fresh only)',
      description: 'Which extraction signal claimed the title. Empty rows excluded.',
      render: 'table',
      columns: [
        { key: 'title_winner', label: 'Signal' },
        { key: 'hits', label: 'Hits', align: 'right', bar: true },
      ],
      sql: `
        SELECT
          blob2 AS title_winner,
          count() AS hits
        FROM ${dataset}
        WHERE index1 = 'cite_website'
          AND double3 = 0
          AND blob2 <> ''
          AND timestamp >= NOW() - INTERVAL '30' DAY
        GROUP BY title_winner
        ORDER BY hits DESC
        ${J}
      `,
    },
    {
      key: 'cache_hit_rate',
      title: 'Cache hit rate by endpoint (last 7d)',
      description: 'double2 = cache_hit for cite_book/cite_journal.',
      render: 'table',
      columns: [
        { key: 'endpoint', label: 'Endpoint' },
        { key: 'hits', label: 'Hits', align: 'right' },
        { key: 'total', label: 'Total', align: 'right' },
        { key: 'hit_rate', label: 'Hit rate', align: 'right', bar: true },
      ],
      sql: `
        SELECT
          index1 AS endpoint,
          sum(if(double2 = 1, 1, 0)) AS hits,
          count() AS total,
          round(sum(if(double2 = 1, 1, 0)) / count(), 3) AS hit_rate
        FROM ${dataset}
        WHERE index1 IN ('cite_book', 'cite_journal')
          AND timestamp >= NOW() - INTERVAL '7' DAY
        GROUP BY endpoint
        ${J}
      `,
    },
    {
      key: 'errors',
      title: 'Errors by endpoint + code (last 24h)',
      description: 'Spikes here usually mean an upstream went sideways.',
      render: 'table',
      columns: [
        { key: 'endpoint', label: 'Endpoint' },
        { key: 'code', label: 'Code' },
        { key: 'errors', label: 'Count', align: 'right', bar: true },
      ],
      sql: `
        SELECT
          blob2 AS endpoint,
          blob3 AS code,
          sum(double1) AS errors
        FROM ${dataset}
        WHERE index1 = 'error'
          AND timestamp >= NOW() - INTERVAL '24' HOUR
        GROUP BY endpoint, code
        ORDER BY errors DESC
        ${J}
      `,
    },
    {
      key: 'top_hosts',
      title: 'Top hosts cited (last 30d, cite_website only)',
      description: 'High-volume hosts are where extraction regressions hurt most.',
      render: 'table',
      columns: [
        { key: 'host', label: 'Host' },
        { key: 'requests', label: 'Requests', align: 'right', bar: true },
        { key: 'avg_fetch_ms', label: 'Avg fetch ms', align: 'right' },
        { key: 'avg_extraction_ms', label: 'Avg extract ms', align: 'right' },
      ],
      sql: `
        SELECT
          blob4 AS host,
          count() AS requests,
          round(avg(double4), 1) AS avg_fetch_ms,
          round(avg(double2), 1) AS avg_extraction_ms
        FROM ${dataset}
        WHERE index1 = 'cite_website'
          AND blob4 <> ''
          AND timestamp >= NOW() - INTERVAL '30' DAY
        GROUP BY host
        ORDER BY requests DESC
        LIMIT 20
        ${J}
      `,
    },
    {
      key: 'top_urls',
      title: 'Top cited URLs (last 30d, cite_website only)',
      description: 'The exact pages users cite most, by full normalized URL (blob5).',
      render: 'table',
      columns: [
        { key: 'url', label: 'URL' },
        { key: 'requests', label: 'Requests', align: 'right', bar: true },
      ],
      sql: `
        SELECT
          blob5 AS url,
          count() AS requests
        FROM ${dataset}
        WHERE index1 = 'cite_website'
          AND blob5 <> ''
          AND timestamp >= NOW() - INTERVAL '30' DAY
        GROUP BY url
        ORDER BY requests DESC
        LIMIT 50
        ${J}
      `,
    },
    {
      key: 'citations_by_guide',
      title: 'Citations by guide (last 28d)',
      description:
        'Which /guides/* pages convert readers into citations, via the trailing `from` attribution dimension (blob6 on cite_website, blob3 on cite_book/cite_journal). This is the number that decides whether to write more long-tail guides.',
      render: 'table',
      columns: [
        { key: 'guide', label: 'Guide' },
        { key: 'citations', label: 'Citations', align: 'right', bar: true },
      ],
      sql: `
        SELECT
          if(index1 = 'cite_website', blob6, blob3) AS guide,
          count() AS citations
        FROM ${dataset}
        WHERE index1 IN ('cite_website', 'cite_book', 'cite_journal')
          AND if(index1 = 'cite_website', blob6, blob3) <> ''
          AND timestamp >= NOW() - INTERVAL '28' DAY
        GROUP BY guide
        ORDER BY citations DESC
        LIMIT 40
        ${J}
      `,
    },
  ];
}
