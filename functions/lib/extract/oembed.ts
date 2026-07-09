import type { CSLItem, FieldEvidence, SocialMeta } from '../csl-types';
import { parseDate } from './date-parse';
import { parseAuthorName } from './author-parse';

// Platform rescue for pages whose HTML defeats server-side extraction. Cloudflare
// datacenter egress gets bot-walled or rate-limited by these hosts, so we reach
// for their public, keyless data APIs instead:
//
//   X/Twitter  → cdn.syndication.twimg.com/tweet-result (the endpoint react-tweet
//                uses). publish.twitter.com/oembed is dead — it 301s to
//                publish.x.com which serves an HTML error page, not JSON. The
//                syndication API returns the post text, author, handle, AND the
//                exact date, and reports deleted posts as a TweetTombstone so we
//                can fail honestly instead of inventing a citation.
//   TikTok     → www.tiktok.com/oembed for the caption + creator. oEmbed carries
//                no date, but a TikTok video ID encodes its creation timestamp in
//                its high bits, so the posting date is recovered from the URL.
//   YouTube    → www.youtube.com/oembed for the title + channel (no date; the
//                platform HTML signal supplies that when the page is readable).
//
// Runs from the cite-website handler (network step, like AI assist) and returns
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

// Deterministic anti-abuse token the syndication endpoint expects; the exact
// value is only loosely validated, but react-tweet derives it this way.
function syndicationToken(id: string): string {
  return ((Number(id) / 1e15) * Math.PI).toString(6 ** 2).replace(/(0+|\.)/g, '') || '0';
}

export function oembedEndpointFor(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const host = parsed.hostname.toLowerCase().replace(/^www\.|^mobile\.|^m\./, '');
  if (host === 'x.com' || host === 'twitter.com') {
    const id = parsed.pathname.match(/\/status(?:es)?\/(\d+)/)?.[1];
    if (!id) return null;
    return `https://cdn.syndication.twimg.com/tweet-result?id=${id}&token=${syndicationToken(id)}&lang=en`;
  }
  if ((host === 'tiktok.com' || host.endsWith('.tiktok.com')) && /\/video\/\d+/.test(parsed.pathname)) {
    return `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`;
  }
  if (host === 'youtube.com' || host.endsWith('.youtube.com') || host === 'youtu.be') {
    return `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`;
  }
  return null;
}

// Whether the merged item is missing enough that an oEmbed lookup is worth a
// network round trip. Title and author are the make-or-break fields — but a
// social post also needs custom.social (handle, platform, kind), which drives
// correct per-style formatting. An X post's og-tags can supply a title and
// author while the handle, exact date, and [Post] descriptor still only come
// from the syndication API, so run the rescue whenever a social URL lacks that
// platform metadata even if title/author are present.
export function shouldRunOembedAssist(csl: CSLItem, url: string): boolean {
  if (!oembedEndpointFor(url)) return false;
  return !csl.title || !csl.author?.length || !csl.custom?.social;
}

export async function runOembedAssist(
  url: string,
  options: { fetchFn?: FetchLike; acquiredAt?: string } = {},
): Promise<OembedAssistResult | null> {
  const endpoint = oembedEndpointFor(url);
  if (!endpoint) return null;
  const fetchFn = options.fetchFn ?? fetch;
  const host = new URL(url).hostname.toLowerCase().replace(/^www\.|^mobile\.|^m\./, '');
  const isX = host === 'x.com' || host === 'twitter.com';

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let payload: any;
  try {
    const res = await fetchFn(endpoint, {
      signal: controller.signal,
      headers: { accept: 'application/json' },
    });
    if (!res.ok) return null;
    payload = await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
  if (!payload || typeof payload !== 'object') return null;

  if (isX) return xEvidence(payload, url, options);
  if (host.endsWith('tiktok.com')) return tiktokEvidence(payload as OembedPayload, url, options);
  return youtubeEvidence(payload as OembedPayload, options);
}

// X/Twitter syndication payload: { __typename, text, user:{name,screen_name},
// created_at, display_text_range, entities }. A deleted post comes back as
// { __typename: 'TweetTombstone' } — return null so the caller fails visibly
// rather than emitting a citation with no real content.
function xEvidence(payload: any, url: string, options: { acquiredAt?: string }): OembedAssistResult | null {
  if (payload.__typename && payload.__typename !== 'Tweet') return null;

  const text = tweetText(payload);
  const displayName = stringOr(payload.user?.name);
  const handle = stringOr(payload.user?.screen_name)
    ?? url.match(/(?:x|twitter)\.com\/([^/?#]+)/i)?.[1];
  const dateRaw = stringOr(payload.created_at);
  const dp = dateRaw ? parseDate(dateRaw) : null;

  const evidence: FieldEvidence[] = [];
  const push = pusher(evidence, options);

  if (text) push('title', text, text);
  if (displayName) {
    const author = parseAuthorName(displayName);
    if (author) push('author', [author], displayName);
  }
  if (dp) push('issued', { 'date-parts': [dp] }, dateRaw ?? undefined);
  push('container-title', 'X', 'X');

  if (!evidence.length) return null;
  return { evidence, social: { platform: 'x', handle, displayName, kind: 'post' } };
}

// The tweet's own text, with trailing media/quote-tweet t.co links trimmed off
// using display_text_range (codepoint indices, so slice the code points).
function tweetText(payload: any): string | undefined {
  const raw = typeof payload.text === 'string' ? payload.text : '';
  if (!raw) return undefined;
  const range = payload.display_text_range;
  let text = raw;
  if (Array.isArray(range) && range.length === 2 && Number.isFinite(range[0]) && Number.isFinite(range[1])) {
    text = Array.from(raw).slice(range[0], range[1]).join('');
  }
  // Any lingering t.co link (media without a display range) is not part of the
  // caption a reader should cite.
  text = text.replace(/\s*https:\/\/t\.co\/\w+\s*$/g, '').replace(/\s+/g, ' ').trim();
  return text || undefined;
}

// TikTok oEmbed: caption (title) + creator. No date in the payload, but the
// video ID's high bits are its creation Unix timestamp — recover it from the URL.
function tiktokEvidence(payload: OembedPayload, url: string, options: { acquiredAt?: string }): OembedAssistResult | null {
  const evidence: FieldEvidence[] = [];
  const push = pusher(evidence, options);

  const displayName = payload.author_name?.trim();
  const handle = payload.author_url?.match(/\/@([^/?#]+)/)?.[1];

  if (payload.title?.trim()) push('title', payload.title.trim(), payload.title.trim());
  if (displayName) {
    const author = handle && squash(displayName) === squash(handle)
      ? { literal: displayName }
      : parseAuthorName(displayName);
    if (author) push('author', [author], displayName);
  }

  const dp = tiktokDateFromUrl(url);
  if (dp) push('issued', { 'date-parts': [dp] }, `tiktok-id:${url}`);

  push('container-title', 'TikTok', 'TikTok');

  if (!evidence.length) return null;
  return { evidence, social: { platform: 'tiktok', handle, displayName, kind: 'video' } };
}

// A TikTok video ID is a 64-bit value whose top 32 bits are the creation time
// in Unix seconds (the web UI only ever shows "3d ago"-style relative dates).
export function tiktokDateFromUrl(url: string): [number, number, number] | null {
  const id = url.match(/\/video\/(\d{6,})/)?.[1];
  if (!id) return null;
  let seconds: number;
  try {
    seconds = Number(BigInt(id) >> 32n);
  } catch {
    return null;
  }
  // Sanity window: TikTok launched in 2016; reject anything before 2015 or far
  // in the future so a non-timestamp ID scheme can't yield a bogus date.
  if (!Number.isFinite(seconds) || seconds < 1_420_070_400 || seconds > 4_102_444_800) return null;
  const d = new Date(seconds * 1000);
  return [d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()];
}

// YouTube oEmbed: title + channel only (channel names are labels, never person
// names). No date — the platform HTML signal supplies that when readable.
function youtubeEvidence(payload: OembedPayload, options: { acquiredAt?: string }): OembedAssistResult | null {
  const evidence: FieldEvidence[] = [];
  const push = pusher(evidence, options);

  const displayName = payload.author_name?.trim();
  const handle = payload.author_url?.match(/\/@([^/?#]+)/)?.[1];

  if (payload.title?.trim()) push('title', payload.title.trim(), payload.title.trim());
  if (displayName) push('author', [{ literal: displayName }], displayName);
  push('container-title', 'YouTube', 'YouTube');

  if (!evidence.length) return null;
  return { evidence, social: { platform: 'youtube', handle, displayName, kind: 'video' } };
}

function pusher(evidence: FieldEvidence[], options: { acquiredAt?: string }) {
  return (field: keyof CSLItem, value: unknown, raw?: string) => {
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
}

function squash(value: string): string {
  return value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
}

function stringOr(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}
