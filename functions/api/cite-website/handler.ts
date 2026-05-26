import { runExtractionPipeline } from '../../lib/extract/pipeline';
import { fetchHtml, FetchError } from '../../lib/extract/fetch';
import { normalizeUrl } from '../../lib/extract/url-normalize';
import { TTL } from '../../lib/cache';
import type { ExtractEnvelope } from '../../lib/csl-types';

export interface MinCache {
  get(key: string): Promise<Response | undefined>;
  put(key: string, response: Response, maxAgeSeconds: number): Promise<void>;
}

export async function handleCiteWebsite(requestUrl: URL, cache: MinCache | null): Promise<Response> {
  const raw = requestUrl.searchParams.get('url');
  if (!raw) return errorResponse(400, 'invalid_url', 'Missing url parameter', false);

  let target: string;
  try {
    const decoded = decodeURIComponent(raw);
    target = normalizeUrl(decoded.startsWith('http') ? decoded : `https://${decoded}`);
  } catch {
    return errorResponse(400, 'invalid_url', 'Malformed URL', false);
  }

  const bypassCache = requestUrl.searchParams.get('nocache') === '1';
  if (cache && !bypassCache) {
    const hit = await cache.get(target);
    if (hit) {
      const body = await hit.json() as ExtractEnvelope;
      body._cached = true;
      return jsonResponse(body);
    }
  }

  let html: string;
  let finalUrl: string;
  try {
    ({ html, finalUrl } = await fetchHtml(target));
  } catch (err) {
    if (err instanceof FetchError) {
      return errorResponse(400, err.code, err.message, err.retryable);
    }
    return errorResponse(500, 'internal', String((err as Error).message), false);
  }

  const { csl, signals } = runExtractionPipeline(html, finalUrl);
  const envelope: ExtractEnvelope = {
    uuid: target,
    type: 'webpage',
    csl,
    _signals: signals,
    _cached: false,
  };
  const response = jsonResponse(envelope);
  if (cache && !bypassCache) {
    await cache.put(target, response.clone(), TTL.WEBSITE);
  }
  return response;
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
