import type { CheerioAPI } from 'cheerio';
import type { CSLItem, CSLName } from '../../csl-types';
import { parseAuthorName } from '../author-parse';
import { parseDate } from '../date-parse';
import { validateDoi } from '../../journal/doi-detect';

export interface SignalResult {
  fields: Partial<CSLItem>;
  confidence: Partial<Record<keyof CSLItem, number>>;
}

const CONF = 0.95;

// Per HTML5, <script> content is NOT entity-decoded by the parser, so any HTML
// entities (&#x27;, &amp;, etc.) inside a JSON-LD block are emitted literally
// and become part of the parsed JSON string values. Many CMSes still escape
// script content via their templating layer (out of caution), so real-world
// JSON-LD frequently contains entity references we need to decode ourselves
// before JSON.parse so the resulting values are correct.
export function decodeJsonLdEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&#x([0-9a-fA-F]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)));
}

// schema.org types that represent the document we're trying to cite. URL/title
// fallbacks should only be taken from these — not from sibling Organization or
// WebSite nodes in a @graph that point at the site root.
const ARTICLE_TYPES = new Set([
  'Article', 'NewsArticle', 'BlogPosting', 'WebPage', 'ScholarlyArticle',
  'Report', 'TechArticle', 'AnalysisNewsArticle', 'OpinionNewsArticle',
  'ReviewArticle', 'BackgroundNewsArticle', 'LiveBlogPosting',
  'SocialMediaPosting', 'MedicalScholarlyArticle',
  // VideoObject is extractable for title/author/date (YouTube etc.); still
  // excluded from NON_ARTICLE so name/headline fields are accepted.
  'VideoObject',
]);

const NON_ARTICLE_CONTAINER_RE = /^(WebSite|Organization|NewsMediaOrganization|Person|Corporation|BreadcrumbList|SiteNavigationElement|CollectionPage|ProfilePage|SearchResultsPage|ImageObject)$/i;

function isArticleish(type: string): boolean {
  const types = typeNames(type);
  if (!type) return true; // unknown/missing — treat as article-ish, preserves prior behavior
  if (types.some((t) => ARTICLE_TYPES.has(t))) return true;
  // If it's an explicit non-article container, reject. Otherwise default to article-ish
  // (covers Schema.org subtypes we haven't enumerated).
  return !types.some((t) => NON_ARTICLE_CONTAINER_RE.test(t));
}

function typeNames(type: string): string[] {
  return type.split(',').map((t) => t.trim()).filter(Boolean);
}

export function jsonldSignal($: CheerioAPI): SignalResult {
  const fields: Partial<CSLItem> = {};
  const confidence: Partial<Record<keyof CSLItem, number>> = {};
  $('script[type="application/ld+json"]').each((_, el) => {
    let blob: unknown;
    try {
      blob = JSON.parse(decodeJsonLdEntities($(el).contents().text()));
    } catch {
      return;
    }
    walk(blob, fields, confidence);
  });
  return { fields, confidence };
}

function walk(node: unknown, fields: Partial<CSLItem>, confidence: Partial<Record<keyof CSLItem, number>>): void {
  if (Array.isArray(node)) {
    for (const item of node) walk(item, fields, confidence);
    return;
  }
  if (!node || typeof node !== 'object') return;
  const n = node as Record<string, any>;

  const type = String(n['@type'] || '');
  const articleish = isArticleish(type);

  if (!fields.title) {
    const isNonArticleContainer = !articleish;
    const t = n.headline || (isNonArticleContainer ? undefined : (n.name || n.title));
    if (typeof t === 'string' && t.trim()) {
      fields.title = t.trim();
      confidence.title = CONF;
    }
  }

  if (!fields.author && n.author) {
    const arr = Array.isArray(n.author) ? n.author : [n.author];
    const authors: CSLName[] = [];
    for (const a of arr) {
      const parsed = nodeToAuthor(a);
      if (parsed) authors.push(parsed);
    }
    if (authors.length) {
      fields.author = authors;
      confidence.author = CONF;
    }
  }

  if (!fields.author && n.creator) {
    const arr = Array.isArray(n.creator) ? n.creator : [n.creator];
    const authors: CSLName[] = [];
    for (const a of arr) {
      const parsed = nodeToAuthor(a);
      if (parsed) authors.push(parsed);
    }
    if (authors.length) {
      fields.author = authors;
      confidence.author = CONF;
    }
  }

  if (!fields.issued) {
    const d = n.datePublished || n.uploadDate || n.dateCreated || n.dateModified;
    if (typeof d === 'string') {
      const dp = parseDate(d);
      if (dp) {
        fields.issued = { 'date-parts': [dp] };
        confidence.issued = CONF;
      }
    }
  }

  if (!fields.DOI && articleish) {
    const doi = doiFromJsonLdValues(n.doi, n.identifier, n.sameAs);
    if (doi) {
      fields.DOI = doi;
      confidence.DOI = CONF;
    }
  }

  if (!fields.volume && articleish) {
    const volume = firstString(n.volumeNumber, n.volume, n.isPartOf?.volumeNumber, n.isPartOf?.isPartOf?.volumeNumber);
    if (volume) {
      fields.volume = volume;
      confidence.volume = CONF;
    }
  }

  if (!fields.issue && articleish) {
    const issue = firstString(n.issueNumber, n.issue, n.isPartOf?.issueNumber);
    if (issue) {
      fields.issue = issue;
      confidence.issue = CONF;
    }
  }

  if (!fields.page && articleish) {
    const page = firstString(n.pagination) || pageRange(n.pageStart, n.pageEnd);
    if (page) {
      fields.page = page;
      confidence.page = CONF;
    }
  }

  if (!fields.abstract && articleish) {
    const abstract = firstString(n.abstract);
    if (abstract) {
      fields.abstract = abstract;
      confidence.abstract = CONF;
    }
  }

  if (!fields.publisher && n.publisher) {
    const name = typeof n.publisher === 'string' ? n.publisher : n.publisher?.name;
    if (typeof name === 'string' && name.trim()) {
      fields.publisher = name.trim();
      confidence.publisher = CONF;
    }
  }

  if (!fields['container-title'] && articleish && n.isPartOf) {
    const name = typeof n.isPartOf === 'string' ? n.isPartOf : n.isPartOf?.name;
    if (typeof name === 'string' && name.trim()) {
      fields['container-title'] = name.trim();
      confidence['container-title'] = CONF;
    }
  }

  // Only accept URL from article-typed nodes — many @graph constructions put an
  // Organization or WebSite first whose `url` points at the site root, not the
  // article being cited.
  const nodeUrl = typeof n.url === 'string'
    ? n.url
    : typeof n.mainEntityOfPage === 'string'
      ? n.mainEntityOfPage
      : typeof n.mainEntityOfPage?.['@id'] === 'string'
        ? n.mainEntityOfPage['@id']
        : undefined;
  if (!fields.URL && nodeUrl && articleish) {
    fields.URL = nodeUrl;
    confidence.URL = CONF;
  }

  if (n['@graph']) walk(n['@graph'], fields, confidence);
  if (n.mainEntity) walk(n.mainEntity, fields, confidence);
}

function firstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === 'string' || typeof value === 'number') {
      const s = String(value).replace(/\s+/g, ' ').trim();
      if (s) return s;
    }
  }
  return undefined;
}

function pageRange(start: unknown, end: unknown): string | undefined {
  const first = firstString(start);
  if (!first) return undefined;
  const last = firstString(end);
  return last ? `${first}-${last}` : first;
}

function doiFromJsonLdValues(...values: unknown[]): string | null {
  for (const value of flattenIdentifierValues(values)) {
    const direct = validateDoi(value);
    if (direct) return direct;
    const match = value.match(/\b10\.\d{4,9}\/[^\s"'#?]+/i);
    const fromMatch = match ? validateDoi(match[0]) : null;
    if (fromMatch) return fromMatch;
  }
  return null;
}

function flattenIdentifierValues(values: unknown[]): string[] {
  const out: string[] = [];
  const visit = (value: unknown) => {
    if (Array.isArray(value)) {
      for (const item of value) visit(item);
      return;
    }
    if (typeof value === 'string' || typeof value === 'number') {
      const s = String(value).trim();
      if (s) out.push(s);
      return;
    }
    if (!value || typeof value !== 'object') return;
    const obj = value as Record<string, any>;
    for (const key of ['value', 'name', '@id', 'url']) visit(obj[key]);
  };
  for (const value of values) visit(value);
  return out;
}

function nodeToAuthor(a: unknown): CSLName | null {
  if (typeof a === 'string') return parseAuthorName(a);
  if (!a || typeof a !== 'object') return null;
  const obj = a as Record<string, any>;
  const type = String(obj['@type'] || '');
  const types = typeNames(type);
  if (types.includes('Organization') || types.includes('Corporation')) {
    return obj.name ? { literal: String(obj.name) } : null;
  }
  if (obj.familyName || obj.givenName) {
    const out: CSLName = { family: String(obj.familyName || '') };
    if (obj.givenName) (out as any).given = String(obj.givenName);
    return out.family ? out : null;
  }
  if (obj.name) return parseAuthorName(String(obj.name));
  return null;
}
