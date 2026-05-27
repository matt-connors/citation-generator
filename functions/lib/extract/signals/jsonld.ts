import type { CheerioAPI } from 'cheerio';
import type { CSLItem, CSLName } from '../../csl-types';
import { parseAuthorName } from '../author-parse';
import { parseIsoDate } from '../date-parse';

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
  'ReviewArticle', 'BackgroundNewsArticle',
]);

const NON_ARTICLE_CONTAINER_RE = /^(WebSite|Organization|Person|Corporation|BreadcrumbList|SiteNavigationElement)$/i;

function isArticleish(type: string): boolean {
  if (!type) return true; // unknown/missing — treat as article-ish, preserves prior behavior
  if (ARTICLE_TYPES.has(type)) return true;
  // If it's an explicit non-article container, reject. Otherwise default to article-ish
  // (covers Schema.org subtypes we haven't enumerated).
  return !NON_ARTICLE_CONTAINER_RE.test(type);
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
    const isNonArticleContainer = NON_ARTICLE_CONTAINER_RE.test(type);
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

  if (!fields.issued) {
    const d = n.datePublished || n.dateCreated;
    if (typeof d === 'string') {
      const dp = parseIsoDate(d);
      if (dp) {
        fields.issued = { 'date-parts': [dp] };
        confidence.issued = CONF;
      }
    }
  }

  if (!fields.publisher && n.publisher) {
    const name = typeof n.publisher === 'string' ? n.publisher : n.publisher?.name;
    if (typeof name === 'string' && name.trim()) {
      fields.publisher = name.trim();
      confidence.publisher = CONF;
    }
  }

  // Only accept URL from article-typed nodes — many @graph constructions put an
  // Organization or WebSite first whose `url` points at the site root, not the
  // article being cited.
  if (!fields.URL && typeof n.url === 'string' && articleish) {
    fields.URL = n.url;
    confidence.URL = CONF;
  }

  if (n['@graph']) walk(n['@graph'], fields, confidence);
  if (n.mainEntity) walk(n.mainEntity, fields, confidence);
}

function nodeToAuthor(a: unknown): CSLName | null {
  if (typeof a === 'string') return parseAuthorName(a);
  if (!a || typeof a !== 'object') return null;
  const obj = a as Record<string, any>;
  const type = String(obj['@type'] || '');
  if (type === 'Organization' || type === 'Corporation') {
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
