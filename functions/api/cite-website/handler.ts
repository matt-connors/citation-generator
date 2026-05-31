import { runExtractionPipeline } from '../../lib/extract/pipeline';
import { fetchHtml, FetchError } from '../../lib/extract/fetch';
import { normalizeUrl } from '../../lib/extract/url-normalize';
import { TTL } from '../../lib/cache';
import type { ExtractEnvelope } from '../../lib/csl-types';
import { writeEvent, type AnalyticsBinding } from '../../lib/analytics';

export interface MinCache {
  get(key: string): Promise<Response | undefined>;
  put(key: string, response: Response, maxAgeSeconds: number): Promise<void>;
}

export async function handleCiteWebsite(
  requestUrl: URL,
  cache: MinCache | null,
  analytics?: AnalyticsBinding,
): Promise<Response> {
  const raw = requestUrl.searchParams.get('url');
  if (!raw) {
    writeEvent(analytics, 'error', { endpoint: 'cite_website', code: 'invalid_url' }, { count: 1 });
    return errorResponse(400, 'invalid_url', 'Missing url parameter', false);
  }

  let target: string;
  try {
    const decoded = decodeURIComponent(raw);
    target = normalizeUrl(decoded.startsWith('http') ? decoded : `https://${decoded}`);
  } catch {
    writeEvent(analytics, 'error', { endpoint: 'cite_website', code: 'invalid_url' }, { count: 1 });
    return errorResponse(400, 'invalid_url', 'Malformed URL', false);
  }

  const host = hostOf(target);

  const bypassCache = requestUrl.searchParams.get('nocache') === '1';
  if (cache && !bypassCache) {
    const hit = await cache.get(target);
    if (hit) {
      const body = await hit.json() as ExtractEnvelope;
      body._cached = true;
      writeEvent(analytics, 'cite_website',
        {
          signal_winner_title: body._signals?.title ?? '',
          signal_winner_url: body._signals?.URL ?? '',
          host,
          url: target,
        },
        { html_size_kb: 0, extraction_ms: 0, cache_hit: 1, fetch_ms: 0 },
      );
      return jsonResponse(body);
    }
  }

  let html: string;
  let finalUrl: string;
  const fetchStart = Date.now();
  try {
    ({ html, finalUrl } = await fetchHtml(target));
  } catch (err) {
    if (err instanceof FetchError) {
      writeEvent(analytics, 'error', { endpoint: 'cite_website', code: err.code }, { count: 1 });
      return errorResponse(400, err.code, err.message, err.retryable);
    }
    writeEvent(analytics, 'error', { endpoint: 'cite_website', code: 'internal' }, { count: 1 });
    return errorResponse(500, 'internal', String((err as Error).message), false);
  }
  const fetchMs = Date.now() - fetchStart;

  const extractStart = Date.now();
  const { csl, signals } = runExtractionPipeline(html, finalUrl);
  const extractionMs = Date.now() - extractStart;

  const envelope: ExtractEnvelope = {
    uuid: target,
    type: 'webpage',
    csl,
    _signals: signals,
    _cached: false,
  };
  const response = jsonResponse(envelope);

  // Emit before cache.put so a cache-write failure (network blip into the
  // Cache API) doesn't swallow the analytics event for an otherwise-
  // successful request — those slow-tail successes are precisely what the
  // dashboard wants to see.
  writeEvent(analytics, 'cite_website',
    {
      signal_winner_title: signals.title ?? '',
      signal_winner_url: signals.URL ?? '',
      host,
      url: target,
    },
    {
      html_size_kb: Math.round(html.length / 1024),
      extraction_ms: extractionMs,
      cache_hit: 0,
      fetch_ms: fetchMs,
    },
  );

  if (cache && !bypassCache) {
    await cache.put(target, response.clone(), TTL.WEBSITE);
  }
  return response;
}

function hostOf(url: string): string {
  try { return new URL(url).hostname; } catch { return ''; }
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { 'content-type': 'application/json' },
  });
}

function errorResponse(status: number, code: string, message: string, retryable: boolean): Response {
  return new Response(JSON.stringify({ error: message, code, retryable }), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}
