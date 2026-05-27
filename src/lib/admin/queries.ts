/**
 * Named dashboard queries. Each carries its SQL plus enough metadata
 * (title, description, column ordering) for the page to render a
 * consistent panel without per-query branching in the template.
 *
 * Dataset name is parameterized so the user can override via
 * ANALYTICS_DATASET env var. SQL is `FORMAT JSON`-suffixed so the
 * SQL client gets the `{meta, data, rows}` envelope it knows how to
 * parse.
 */

export interface QueryDef {
  key: string;
  title: string;
  description: string;
  columns: Array<{ key: string; label: string; align?: 'left' | 'right' }>;
  sql: string;
}

export function buildQueries(dataset: string): QueryDef[] {
  // Use `FORMAT JSON` for structured envelope; no trailing semicolon
  // because the AE SQL endpoint rejects them in some response paths.
  const J = 'FORMAT JSON';

  return [
    {
      key: 'headline',
      title: 'Headline counts (last 24h)',
      description: 'Event volume by type. Sanity check that the binding is live.',
      columns: [
        { key: 'event', label: 'Event' },
        { key: 'events', label: 'Count', align: 'right' },
      ],
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
      key: 'top_styles',
      title: 'Top citation styles (last 7d)',
      description: 'Which CSL styles users actually format with.',
      columns: [
        { key: 'style', label: 'Style' },
        { key: 'requests', label: 'Requests', align: 'right' },
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
      columns: [
        { key: 'endpoint', label: 'Endpoint' },
        { key: 'p50_ms', label: 'p50 ms', align: 'right' },
        { key: 'p95_ms', label: 'p95 ms', align: 'right' },
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
      title: 'cite_website extraction time (last 24h, fresh only)',
      description: 'Cache hits skipped (double3 = 0). double2 = extraction_ms.',
      columns: [
        { key: 'p50_extract_ms', label: 'p50 extract ms', align: 'right' },
        { key: 'p95_extract_ms', label: 'p95 extract ms', align: 'right' },
        { key: 'avg_html_kb', label: 'Avg HTML KB', align: 'right' },
        { key: 'samples', label: 'Samples', align: 'right' },
      ],
      sql: `
        SELECT
          round(quantileWeighted(0.50)(double2, _sample_interval), 1) AS p50_extract_ms,
          round(quantileWeighted(0.95)(double2, _sample_interval), 1) AS p95_extract_ms,
          round(avg(double1), 1) AS avg_html_kb,
          count() AS samples
        FROM ${dataset}
        WHERE index1 = 'cite_website'
          AND double3 = 0
          AND timestamp >= NOW() - INTERVAL '24' HOUR
        ${J}
      `,
    },
    {
      key: 'signal_winners',
      title: 'cite_website title signal winners (last 30d, fresh only)',
      description: 'Which extraction signal claimed the title. Empty rows excluded.',
      columns: [
        { key: 'title_winner', label: 'Signal' },
        { key: 'hits', label: 'Hits', align: 'right' },
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
      columns: [
        { key: 'endpoint', label: 'Endpoint' },
        { key: 'hits', label: 'Hits', align: 'right' },
        { key: 'total', label: 'Total', align: 'right' },
        { key: 'hit_rate', label: 'Hit rate', align: 'right' },
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
      columns: [
        { key: 'endpoint', label: 'Endpoint' },
        { key: 'code', label: 'Code' },
        { key: 'errors', label: 'Count', align: 'right' },
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
      columns: [
        { key: 'host', label: 'Host' },
        { key: 'requests', label: 'Requests', align: 'right' },
        { key: 'avg_extraction_ms', label: 'Avg extract ms', align: 'right' },
      ],
      sql: `
        SELECT
          blob4 AS host,
          count() AS requests,
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
  ];
}
