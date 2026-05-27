# Analytics

This project emits per-request events to **Cloudflare Analytics Engine** via the `ANALYTICS` binding. The writer in `functions/lib/analytics.ts` is a no-op when the binding is absent, so the code is deploy-safe before the binding is configured — instrumentation lights up the moment you add the binding and redeploy.

## One-time Cloudflare setup

1. Open the Cloudflare dashboard → **Workers & Pages** → **citation-generator** (the Pages project).
2. **Settings** → **Functions** → **Analytics Engine Bindings** → **Add binding**.
3. Variable name: `ANALYTICS`. Dataset name: `citation_generator_events` (or whatever you prefer — pick a name and stick with it; SQL queries below assume this name).
4. Save. Trigger a deploy (or wait for the next push to `main`) so the new Functions env picks up the binding.
5. The dataset is auto-created on first write. No separate "create dataset" step is needed — the first cited URL after the deploy will materialize it.

After the next deploy, every `/api/cite-website`, `/api/cite-book`, `/api/cite-journal`, and `/api/format` request emits one event. Errors emit a separate `error` event with `endpoint` and `code` dimensions.

> The code is intentionally not gated behind a wrangler.toml so that the existing Cloudflare Pages dashboard config (compatibility flags, secrets, etc.) keeps owning deploy settings unchanged. Adding a wrangler.toml would override that config and was avoided.

## Querying

Go to **Workers & Pages** → **Analytics Engine** in the sidebar to open the SQL query interface. Or hit the SQL API directly:

```bash
curl "https://api.cloudflare.com/client/v4/accounts/{account_id}/analytics_engine/sql" \
  -H "Authorization: Bearer $CF_TOKEN" \
  --data "SELECT count() FROM citation_generator_events WHERE index1 = 'format'"
```

## Event schema (columns are positional)

Analytics Engine stores columns positionally, not by name. The writer in `functions/lib/analytics.ts` puts the event name in `blob1` (and duplicates it into `index1` for fast filtering). Dimensions follow in insertion order; metrics live in the `doubleN` columns.

| Event           | blob1            | blob2                  | blob3                 | blob4 | double1        | double2        | double3   |
| --------------- | ---------------- | ---------------------- | --------------------- | ----- | -------------- | -------------- | --------- |
| `cite_website`  | `"cite_website"` | signal_winner_title    | signal_winner_url     | host  | html_size_kb   | extraction_ms  | cache_hit |
| `cite_book`     | `"cite_book"`    | source (openlibrary\|googlebooks) | —          | —     | latency_ms     | cache_hit      | —         |
| `cite_journal`  | `"cite_journal"` | source (crossref\|openalex)       | —          | —     | latency_ms     | cache_hit      | —         |
| `format`        | `"format"`       | style                  | —                     | —     | latency_ms     | —              | —         |
| `error`         | `"error"`        | endpoint               | code                  | —     | count (always 1) | —            | —         |

On a cache hit, `source` for cite_book / cite_journal is `''` (empty string) because we didn't talk to either upstream; the `cache_hit` metric is the source of truth for "this was a cache hit". **Per-source SQL slices should filter on the metric, not on `blob2`** — e.g. to count fresh OpenLibrary hits, write `WHERE index1 = 'cite_book' AND double2 = 0 AND blob2 = 'openlibrary'`, not `WHERE blob2 = 'openlibrary'` alone (that's already correct, but the omission of `double2 = 0` would silently exclude cache hits even though they came from "openlibrary" originally — usually the desired behavior, but be explicit). cite_website on a cache hit carries the cached signal-winner dimensions but `html_size_kb` and `extraction_ms` are both 0.

## Sample queries

### 1. Top styles by volume (last 7 days)

```sql
SELECT
  blob2 AS style,
  count() AS requests
FROM citation_generator_events
WHERE index1 = 'format'
  AND timestamp >= NOW() - INTERVAL '7' DAY
GROUP BY style
ORDER BY requests DESC
```

### 2. p95 latency per endpoint (last 24h)

cite_website is excluded from this query because its `double1` is `html_size_kb`, not latency — putting it in the same `quantile(double1)` would compare bytes to milliseconds. cite_website's `extraction_ms` is queried separately (query 2b).

```sql
SELECT
  index1 AS endpoint,
  quantileWeighted(0.95)(double1, _sample_interval) AS p95_ms,
  quantileWeighted(0.50)(double1, _sample_interval) AS p50_ms,
  count() AS samples
FROM citation_generator_events
WHERE index1 IN ('cite_book', 'cite_journal', 'format')
  AND timestamp >= NOW() - INTERVAL '24' HOUR
GROUP BY endpoint
ORDER BY p95_ms DESC
```

### 2b. cite_website extraction-time percentiles

```sql
SELECT
  quantileWeighted(0.95)(double2, _sample_interval) AS p95_extract_ms,
  quantileWeighted(0.50)(double2, _sample_interval) AS p50_extract_ms,
  avg(double1) AS avg_html_kb
FROM citation_generator_events
WHERE index1 = 'cite_website'
  AND double3 = 0  -- fresh extractions only; cache hits don't run the pipeline
  AND timestamp >= NOW() - INTERVAL '24' HOUR
```

### 3. Signal-winner distribution for cite_website title extraction

```sql
SELECT
  blob2 AS title_winner,
  count() AS hits
FROM citation_generator_events
WHERE index1 = 'cite_website'
  AND double3 = 0  -- fresh extractions only; cache hits carry the cached winner and would skew the distribution
  AND blob2 <> ''  -- exclude rows where no signal claimed the title (rare)
  AND timestamp >= NOW() - INTERVAL '30' DAY
GROUP BY title_winner
ORDER BY hits DESC
```

Useful for answering "which extraction signal is doing the work?" — if `jsonld` wins 80% of requests, that's where to invest extraction effort.

### 4. Cache hit rate per endpoint (last 7 days)

```sql
SELECT
  index1 AS endpoint,
  sum(if(double2 = 1, 1, 0)) AS hits,
  count() AS total,
  sum(if(double2 = 1, 1, 0)) / count() AS hit_rate
FROM citation_generator_events
WHERE index1 IN ('cite_book', 'cite_journal')
  AND timestamp >= NOW() - INTERVAL '7' DAY
GROUP BY endpoint
```

For `cite_website`, swap `double2` for `double3` (different metric ordering).

### 5. Error rate over time, broken out by endpoint and code

```sql
SELECT
  toStartOfInterval(timestamp, INTERVAL '1' HOUR) AS hour,
  blob2 AS endpoint,
  blob3 AS code,
  sum(double1) AS errors
FROM citation_generator_events
WHERE index1 = 'error'
  AND timestamp >= NOW() - INTERVAL '24' HOUR
GROUP BY hour, endpoint, code
ORDER BY hour DESC, errors DESC
```

A sudden spike in `cite_website / fetch_failed` likely means a site started returning 403/404; a spike in `cite_journal / not_found` may mean a Crossref outage.

### 6. Hosts being cited most often (cite_website)

```sql
SELECT
  blob4 AS host,
  count() AS requests,
  avg(double2) AS avg_extraction_ms
FROM citation_generator_events
WHERE index1 = 'cite_website'
  AND blob4 <> ''
  AND timestamp >= NOW() - INTERVAL '30' DAY
GROUP BY host
ORDER BY requests DESC
LIMIT 20
```

Tells you which sites' extraction quality matters most — high-volume hosts with low signal-winner diversity are where regressions hurt.

## Notes on cardinality and cost

Analytics Engine charges per data point written (the writer emits one per request) and per byte stored. The schema above is deliberately low-cardinality:
- `style` ∈ 7 values
- `source` ∈ 4 strings total across endpoints
- `signal_winner_*` ∈ 6 signal names
- `host` is the only high-cardinality dimension; if you ever want to cap it, you can post-process the dimension into TLD-only before emission.

The dataset has no PII — no IPs, no user agents, no URLs (only hostnames for `cite_website`). If that ever changes, redact at the writer (in `functions/lib/analytics.ts`) rather than at the query layer.
