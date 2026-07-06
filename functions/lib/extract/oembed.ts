import * as cheerio from 'cheerio';
import type { CSLItem, FieldEvidence, SocialMeta } from '../csl-types';
import { parseDate } from './date-parse';
import { parseAuthorName } from './author-parse';

// oEmbed rescue for platforms whose pages defeat HTML extraction. X serves an
// empty JS shell to non-browser clients (and blocks most datacenter browser
// rendering too), but publish.twitter.com/oembed is a public, unauthenticated
// API that returns the post's full text, author, handle, and date. TikTok and
// YouTube get the same treatment as a fallback when their page parse comes up
// empty — their oEmbed lacks the posting date, so it supplements rather than
// replaces the platform HTML signal.
//
// Runs from the cite-website handler (network step, like AI assist), returns
// FieldEvidence so provenance/quality see exactly where each value came from.

export interface OembedAssistResult {
  evidence: FieldEvidence[];
  social?: SocialMeta;
}

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

const CONF = 0.9;
const TIMEOUT_MS = 6_000;

interface OembedPayload {
  title?: string;
  author_name?: string;
  author_url?: string;
  html?: string;
}

export function oembedEndpointFor(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const host = parsed.hostname.toLowerCase().replace(/^www\.|^mobile\./, '');
  if ((host === 'x.com' || host === 'twitter.com') && /\/status\/\d+/.test(parsed.pathname)) {
    return `https://publish.twitter.com/oembed?omit_script=1&dnt=1&url=${encodeURIComponent(url)}`;
  }
  if ((host === 'tiktok.com' || host.endsWith('.tiktok.com')) && /\/video\/\d+/.test(parsed.pathname)) {
    return `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`;
  }
  if (host === 'youtube.com' || host === 'youtu.be') {
    return `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`;
  }
  return null;
}

// Whether the merged item is missing enough that an oEmbed lookup is worth a
// network round trip. Title and author are the make-or-break fields.
export function shouldRunOembedAssist(csl: CSLItem, url: string): boolean {
  if (!oembedEndpointFor(url)) return false;
  return !csl.title || !csl.author?.length;
}

export async function runOembedAssist(
  url: string,
  options: { fetchFn?: FetchLike; acquiredAt?: string } = {},
): Promise<OembedAssistResult | null> {
  const endpoint = oembedEndpointFor(url);
  if (!endpoint) return null;
  const fetchFn = options.fetchFn ?? fetch;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let payload: OembedPayload;
  try {
    const res = await fetchFn(endpoint, {
      signal: controller.signal,
      headers: { accept: 'application/json' },
    });
    if (!res.ok) return null;
    payload = await res.json() as OembedPayload;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
  if (!payload || typeof payload !== 'object') return null;

  const host = new URL(url).hostname.toLowerCase().replace(/^www\.|^mobile\./, '');
  if (host === 'x.com' || host === 'twitter.com') return xEvidence(payload, options);
  if (host.endsWith('tiktok.com')) return simpleEvidence(payload, 'tiktok', 'TikTok', 'video', options);
  return simpleEvidence(payload, 'youtube', 'YouTube', 'video', options);
}

// X's oEmbed carries everything inside the embed html:
//   <blockquote><p>tweet text</p>&mdash; jack (@jack) <a href="...">March 21, 2006</a></blockquote>
function xEvidence(payload: OembedPayload, options: { acquiredAt?: string }): OembedAssistResult | null {
  const html = payload.html ?? '';
  if (!html) return null;
  const $ = cheerio.load(html);
  const block = $('blockquote').first();

  // Post text: the <p> content, with <br> as spaces so multi-line posts stay
  // a single citation title.
  block.find('p br').replaceWith(' ');
  const text = block.find('p').first().text().replace(/\s+/g, ' ').trim();

  // Date: the trailing <a> inside the blockquote ("March 21, 2006").
  const dateText = block.find('a').last().text().trim();
  const dp = dateText ? parseDate(dateText) : null;

  const displayName = payload.author_name?.trim();
  const handle = payload.author_url?.match(/(?:x|twitter)\.com\/([^/?#]+)/i)?.[1]
    ?? block.text().match(/\(@([A-Za-z0-9_]+)\)/)?.[1];

  const evidence: FieldEvidence[] = [];
  const push = (field: keyof CSLItem, value: unknown, raw?: string) => {
    evidence.push({
      field,
      normalizedValue: value,
      rawValue: raw,
      source: 'oembed',
      acquisition: 'authority',
      confidence: CONF,
      acquiredAt: options.acquiredAt,
    });
  };

  if (text) push('title', text, text);
  if (displayName) {
    const author = parseAuthorName(displayName);
    if (author) push('author', [author], displayName);
  }
  if (dp) push('issued', { 'date-parts': [dp] }, dateText);
  push('container-title', 'X', 'X');

  if (!evidence.length) return null;
  return {
    evidence,
    social: { platform: 'x', handle, displayName, kind: 'post' },
  };
}

// TikTok / YouTube oEmbed: title + author only (no date — the HTML signal is
// the primary source; this fills gaps when the page fetch got a bot wall).
function simpleEvidence(
  payload: OembedPayload,
  platform: 'tiktok' | 'youtube',
  container: string,
  kind: SocialMeta['kind'],
  options: { acquiredAt?: string },
): OembedAssistResult | null {
  const evidence: FieldEvidence[] = [];
  const push = (field: keyof CSLItem, value: unknown, raw?: string) => {
    evidence.push({
      field,
      normalizedValue: value,
      rawValue: raw,
      source: 'oembed',
      acquisition: 'authority',
      confidence: CONF,
      acquiredAt: options.acquiredAt,
    });
  };

  const displayName = payload.author_name?.trim();
  const handle = payload.author_url?.match(/\/@([^/?#]+)/)?.[1];

  if (payload.title?.trim()) push('title', payload.title.trim(), payload.title.trim());
  if (displayName) {
    // YouTube channel names are labels, never person names; TikTok display
    // names go through the same person/brand logic as the HTML signal.
    const author = platform === 'youtube'
      ? { literal: displayName }
      : (handle && squash(displayName) === squash(handle) ? { literal: displayName } : parseAuthorName(displayName));
    if (author) push('author', [author], displayName);
  }
  push('container-title', container, container);

  if (!evidence.length) return null;
  return {
    evidence,
    social: { platform, handle, displayName, kind },
  };
}

function squash(value: string): string {
  return value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
}
