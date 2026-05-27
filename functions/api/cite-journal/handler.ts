import { fetchCrossref } from '../../lib/journal/crossref';
import { fetchOpenAlex } from '../../lib/journal/openalex';
import { normalizeCrossref, normalizeOpenAlex } from '../../lib/journal/normalize';
import { validateDoi } from '../../lib/journal/doi-detect';
import { TTL } from '../../lib/cache';
import type { ExtractEnvelope } from '../../lib/csl-types';

export interface MinCache {
  get(key: string): Promise<Response | undefined>;
  put(key: string, response: Response, maxAgeSeconds: number): Promise<void>;
}

export async function handleCiteJournal(requestUrl: URL, cache: MinCache | null): Promise<Response> {
  const rawDoi = requestUrl.searchParams.get('doi');
  const rawUrl = requestUrl.searchParams.get('url');
  if (!rawDoi && !rawUrl) return errorResponse(400, 'invalid_doi', 'Missing doi or url parameter');

  let doi: string | null = rawDoi ? validateDoi(rawDoi) : null;
  if (!doi && rawDoi) return errorResponse(400, 'invalid_doi', 'Malformed DOI');

  if (!doi) return errorResponse(400, 'invalid_doi', 'cite-journal currently requires a doi parameter; use cite-website for non-DOI articles');

  const cacheKey = `https://cache.mlagenerator/journal/${doi}`;
  const bypassCache = requestUrl.searchParams.get('nocache') === '1';
  if (cache && !bypassCache) {
    const hit = await cache.get(cacheKey);
    if (hit) {
      const body = await hit.json() as ExtractEnvelope;
      body._cached = true;
      return jsonResponse(body);
    }
  }

  const cr = await fetchCrossref(doi);
  let csl;
  if (cr && cr.title?.length) {
    csl = normalizeCrossref(cr);
  } else {
    const oa = await fetchOpenAlex(doi);
    if (!oa || !oa.title) return errorResponse(404, 'not_found', 'DOI not found in Crossref or OpenAlex');
    csl = normalizeOpenAlex(oa);
  }

  const envelope: ExtractEnvelope = { uuid: doi, type: 'article-journal', csl, _cached: false };
  const response = jsonResponse(envelope);
  if (cache && !bypassCache) {
    await cache.put(cacheKey, response.clone(), TTL.BOOK_OR_JOURNAL);
  }
  return response;
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { 'content-type': 'application/json' },
  });
}

function errorResponse(status: number, code: string, message: string): Response {
  return new Response(JSON.stringify({ error: message, code, retryable: false }), {
    status, headers: { 'content-type': 'application/json' },
  });
}
