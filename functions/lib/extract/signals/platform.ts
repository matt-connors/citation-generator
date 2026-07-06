import type { CheerioAPI } from 'cheerio';
import type { CSLItem, CSLName, SocialMeta } from '../../csl-types';
import { parseAuthorName } from '../author-parse';
import { parseDate } from '../date-parse';
import type { SignalResult } from './jsonld';

// Platform-specific extraction for the big social/video hosts. The generic
// signals treat these pages as ordinary articles and get them badly wrong:
// TikTok serves no meta tags at all (everything lives in a JSON hydration
// blob), Instagram packs author/caption/date into og:title and
// og:description strings, and YouTube's microdata parses the channel name as
// a person ("Chem Teacher Phil" would invert to "Phil, Chem Teacher").
//
// Confidence sits above jsonld (0.95) so a platform parse wins the merge for
// the fields it understands, while anything it doesn't extract still falls
// through to the generic signals.
const CONF = 0.97;

export interface PlatformSignalResult extends SignalResult {
  /** Present when the page is a recognized social/video platform post. */
  social?: SocialMeta;
}

const EMPTY: PlatformSignalResult = { fields: {}, confidence: {} };

export function platformSignal($: CheerioAPI, url: string): PlatformSignalResult {
  const host = hostOf(url);
  if (!host) return EMPTY;
  if (host === 'tiktok.com' || host.endsWith('.tiktok.com')) return tiktok($, url);
  if (host === 'instagram.com' || host.endsWith('.instagram.com')) return instagram($);
  if (host === 'youtube.com' || host.endsWith('.youtube.com') || host === 'youtu.be') return youtube($);
  return EMPTY;
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return '';
  }
}

// The creator's display name, shaped for citation. Real person names invert
// so styles can initialize them (APA's own TikTok example is "Cook, P."), but
// a display name that is just the handle with spacing/case ("Everyday
// Astronaut" → @everydayastronaut) is a brand or pseudonym: inverting it
// would produce nonsense like "Astronaut, Everyday", so it stays literal.
function socialAuthor(displayName: string, handle?: string): CSLName | null {
  const trimmed = displayName.trim();
  if (!trimmed) return null;
  const parsed = parseAuthorName(trimmed);
  if (!parsed) return null;
  if ('literal' in parsed) return parsed;
  if (handle && squash(trimmed) === squash(handle)) return { literal: trimmed };
  return parsed;
}

function squash(value: string): string {
  return value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
}

// ---------------------------------------------------------------------------
// TikTok: video pages ship a <script id="__UNIVERSAL_DATA_FOR_REHYDRATION__">
// JSON blob whose webapp.video-detail branch has everything a citation needs —
// creator display name and @handle, the full caption, and the exact posting
// timestamp (the web UI itself only shows "3d ago"-style relative dates).
// ---------------------------------------------------------------------------
function tiktok($: CheerioAPI, url: string): PlatformSignalResult {
  const raw = $('script#__UNIVERSAL_DATA_FOR_REHYDRATION__').first().contents().text();
  if (!raw) return EMPTY;
  let item: Record<string, any> | undefined;
  try {
    const data = JSON.parse(raw);
    item = data?.__DEFAULT_SCOPE__?.['webapp.video-detail']?.itemInfo?.itemStruct;
  } catch {
    return EMPTY;
  }
  if (!item || typeof item !== 'object') return EMPTY;

  const fields: Partial<CSLItem> = {};
  const confidence: SignalResult['confidence'] = {};
  const handle: string | undefined = stringOr(item.author?.uniqueId);
  const displayName: string | undefined = stringOr(item.author?.nickname);

  const caption = stringOr(item.desc);
  if (caption) { fields.title = caption; confidence.title = CONF; }

  if (displayName) {
    const author = socialAuthor(displayName, handle);
    if (author) { fields.author = [author]; confidence.author = CONF; }
  } else if (handle) {
    fields.author = [{ literal: `@${handle}` }];
    confidence.author = CONF;
  }

  const created = Number(item.createTime);
  if (Number.isFinite(created) && created > 0) {
    const d = new Date(created * 1000);
    fields.issued = { 'date-parts': [[d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()]] };
    confidence.issued = CONF;
  }

  fields['container-title'] = 'TikTok';
  confidence['container-title'] = CONF;

  const videoId = stringOr(item.id);
  if (handle && videoId) {
    fields.URL = `https://www.tiktok.com/@${handle}/video/${videoId}`;
    confidence.URL = CONF;
  } else {
    fields.URL = url;
    confidence.URL = CONF;
  }

  return {
    fields,
    confidence,
    social: { platform: 'tiktok', handle, displayName, kind: 'video' },
  };
}

// ---------------------------------------------------------------------------
// Instagram: the only reliable server-side metadata is OpenGraph, and it is
// packed into prose:
//   og:title       — `Everyday Astronaut on Instagram: "I love @spacecenterhou!…"`
//   og:description — `6,816 likes, 29 comments - everydayastronaut on September 29, 2021: "…"`
// so author, caption, handle, and date are all parsed out of those strings.
// ---------------------------------------------------------------------------
const IG_TITLE_RE = /^(.+?) on Instagram(?::\s*(?:"|“)?([\s\S]*?)(?:"|”)?\s*)?$/;
const IG_DESC_RE = /-\s*([\w.]+) on ([A-Z][a-z]+ \d{1,2}, \d{4})\s*:/;

function instagram($: CheerioAPI): PlatformSignalResult {
  const ogTitle = metaContent($, 'og:title');
  const ogDesc = metaContent($, 'og:description');
  const ogUrl = metaContent($, 'og:url');
  if (!ogTitle && !ogDesc) return EMPTY;

  const fields: Partial<CSLItem> = {};
  const confidence: SignalResult['confidence'] = {};

  const descMatch = ogDesc?.match(IG_DESC_RE);
  const handleFromUrl = ogUrl?.match(/instagram\.com\/([\w.]+)\//)?.[1];
  const handle = descMatch?.[1] ?? (handleFromUrl && handleFromUrl !== 'p' && handleFromUrl !== 'reel' ? handleFromUrl : undefined);

  const titleMatch = ogTitle?.match(IG_TITLE_RE);
  const displayName = titleMatch?.[1]?.trim();
  const caption = titleMatch?.[2]?.trim();

  if (caption) { fields.title = caption; confidence.title = CONF; }
  if (displayName) {
    const author = socialAuthor(displayName, handle);
    if (author) { fields.author = [author]; confidence.author = CONF; }
  }

  if (descMatch?.[2]) {
    const dp = parseDate(descMatch[2]);
    if (dp) { fields.issued = { 'date-parts': [dp] }; confidence.issued = CONF; }
  }

  fields['container-title'] = 'Instagram';
  confidence['container-title'] = CONF;

  if (ogUrl) { fields.URL = ogUrl; confidence.URL = CONF; }

  const isVideo = /\/reel\//.test(ogUrl ?? '') || metaContent($, 'og:type') === 'video';
  return {
    fields,
    confidence,
    social: { platform: 'instagram', handle, displayName, kind: isVideo ? 'video' : 'photo' },
  };
}

// ---------------------------------------------------------------------------
// YouTube: the watch page's VideoObject microdata is solid for title/date,
// but the channel name must NOT go through person-name parsing (channels are
// labels: "Chem Teacher Phil", "NASA Goddard"). The @handle hides in the
// author scope's <link itemprop="url"> href.
// ---------------------------------------------------------------------------
function youtube($: CheerioAPI): PlatformSignalResult {
  const scope = $('[itemprop="author"]').first();
  const channelName = scope.find('link[itemprop="name"], meta[itemprop="name"]').attr('content')?.trim();
  const channelUrl = scope.find('link[itemprop="url"]').attr('href') ?? '';
  const handle = channelUrl.match(/youtube\.com\/@([^/?#]+)/)?.[1];

  // The video's own name is a <meta itemprop="name"> OUTSIDE the author scope
  // (the channel name is another itemprop="name" inside it).
  const title = $('meta[itemprop="name"]')
    .filter((_, el) => $(el).closest('[itemprop="author"]').length === 0)
    .first()
    .attr('content')?.trim() || metaContent($, 'og:title');
  const published = $('meta[itemprop="datePublished"]').first().attr('content')
    ?? $('meta[itemprop="uploadDate"]').first().attr('content');

  if (!title && !channelName) return EMPTY;

  const fields: Partial<CSLItem> = {};
  const confidence: SignalResult['confidence'] = {};

  if (title) { fields.title = title; confidence.title = CONF; }
  if (channelName) {
    // Channel names are account labels, not person names — always literal.
    fields.author = [{ literal: channelName }];
    confidence.author = CONF;
  }
  if (published) {
    const dp = parseDate(published);
    if (dp) { fields.issued = { 'date-parts': [dp] }; confidence.issued = CONF; }
  }
  fields['container-title'] = 'YouTube';
  confidence['container-title'] = CONF;

  return {
    fields,
    confidence,
    social: { platform: 'youtube', handle, displayName: channelName, kind: 'video' },
  };
}

function metaContent($: CheerioAPI, prop: string): string | undefined {
  const v = $(`meta[property="${prop}" i], meta[name="${prop}" i]`).attr('content');
  return v?.trim() || undefined;
}

function stringOr(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}
