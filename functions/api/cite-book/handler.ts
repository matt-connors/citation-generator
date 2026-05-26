import { fetchOpenLibrary } from '../../lib/book/openlibrary';
import { fetchGoogleBooks } from '../../lib/book/googlebooks';
import { normalizeOpenLibrary, normalizeGoogleBooks } from '../../lib/book/normalize';
import { TTL } from '../../lib/cache';
import type { ExtractEnvelope } from '../../lib/csl-types';

const ISBN_RE = /^(97[89])?\d{9}[\dX]$/;

export interface MinCache {
  get(key: string): Promise<Response | undefined>;
  put(key: string, response: Response, maxAgeSeconds: number): Promise<void>;
}

export async function handleCiteBook(requestUrl: URL, cache: MinCache | null, apiKey?: string): Promise<Response> {
  const raw = requestUrl.searchParams.get('isbn');
  if (!raw) return errorResponse(400, 'invalid_isbn', 'Missing isbn parameter');
  const isbn = raw.replace(/[-\s]/g, '');
  if (!ISBN_RE.test(isbn)) return errorResponse(400, 'invalid_isbn', 'Invalid ISBN format');

  const cacheKey = `https://cache.mlagenerator/book/${isbn}`;
  const bypassCache = requestUrl.searchParams.get('nocache') === '1';
  if (cache && !bypassCache) {
    const hit = await cache.get(cacheKey);
    if (hit) {
      const body = await hit.json() as ExtractEnvelope;
      body._cached = true;
      return jsonResponse(body);
    }
  }

  const ol = await fetchOpenLibrary(isbn);
  let csl;
  if (ol && ol.title) {
    csl = normalizeOpenLibrary(ol, isbn);
  } else {
    const gb = await fetchGoogleBooks(isbn, apiKey);
    if (!gb || !gb.title) {
      return errorResponse(404, 'not_found', 'Book not found in OpenLibrary or Google Books');
    }
    csl = normalizeGoogleBooks(gb, isbn);
  }

  const envelope: ExtractEnvelope = { uuid: isbn, type: 'book', csl, _cached: false };
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
