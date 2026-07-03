import { readFileSync } from 'node:fs';

const args = new Map();
for (let i = 2; i < process.argv.length; i += 1) {
  const arg = process.argv[i];
  if (!arg.startsWith('--')) continue;
  const key = arg.slice(2);
  const next = process.argv[i + 1];
  if (next && !next.startsWith('--')) {
    args.set(key, next);
    i += 1;
  } else {
    args.set(key, '1');
  }
}

const baseUrl = args.get('base-url') || 'http://localhost:8788';
const samplePath = args.get('sample') || 'tests/evals/citation-acquisition-urls.json';
const internalToken = args.get('internal-token') || process.env.CITATION_INTERNAL_DEBUG_TOKEN || '';
const sample = JSON.parse(readFileSync(samplePath, 'utf8'));
const entries = sample.map((item) => typeof item === 'string' ? { url: item } : item);

const results = [];
for (const entry of entries) {
  const started = Date.now();
  const endpoint = new URL('/api/cite-website', baseUrl);
  endpoint.searchParams.set('url', entry.url);
  const headers = { 'x-mla-test': '1' };
  if (internalToken) {
    headers['x-mla-internal-token'] = internalToken;
    endpoint.searchParams.set('nocache', '1');
    if (entry.acquisition) endpoint.searchParams.set('acquisition', entry.acquisition);
  }
  try {
    const res = await fetch(endpoint, { headers });
    const body = await res.json().catch(() => ({}));
    results.push({
      url: entry.url,
      ok: res.ok,
      status: res.status,
      durationMs: Date.now() - started,
      fields: Object.keys(body.csl || {}).filter((key) => body.csl[key] !== undefined),
      warnings: body._quality?.warnings?.map((warning) => warning.code) ?? [],
      acquisition: Object.fromEntries(Object.entries(body._quality?.acquisition || {}).map(([key, value]) => [key, value.status])),
    });
  } catch (err) {
    results.push({
      url: entry.url,
      ok: false,
      status: 0,
      durationMs: Date.now() - started,
      error: err.message,
      fields: [],
      warnings: [],
      acquisition: {},
    });
  }
}

const summary = {
  baseUrl,
  samplePath,
  total: results.length,
  ok: results.filter((r) => r.ok).length,
  avgDurationMs: average(results.map((r) => r.durationMs)),
  avgFields: average(results.map((r) => r.fields.length)),
  warningRate: average(results.map((r) => r.warnings.length > 0 ? 1 : 0)),
  renderUsed: results.filter((r) => r.acquisition.render && r.acquisition.render !== 'skipped').length,
  aiUsed: results.filter((r) => r.acquisition.ai && r.acquisition.ai !== 'skipped').length,
  results,
};

console.log(JSON.stringify(summary, null, 2));

function average(values) {
  if (!values.length) return 0;
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 100) / 100;
}
