import type { CheerioAPI } from 'cheerio';
import type { CSLItem, CSLName } from '../../csl-types';
import { parseAuthorName } from '../author-parse';
import { parseIsoDate } from '../date-parse';

export interface SignalResult {
  fields: Partial<CSLItem>;
  confidence: Partial<Record<keyof CSLItem, number>>;
}

const CONF = 0.95;

export function jsonldSignal($: CheerioAPI): SignalResult {
  const fields: Partial<CSLItem> = {};
  const confidence: Partial<Record<keyof CSLItem, number>> = {};
  $('script[type="application/ld+json"]').each((_, el) => {
    let blob: unknown;
    try {
      blob = JSON.parse($(el).contents().text());
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

  if (!fields.title) {
    const type = String(n['@type'] || '');
    const isNonArticleContainer = /^(WebSite|Organization|Person|Corporation|BreadcrumbList|SiteNavigationElement)$/i.test(type);
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

  if (!fields.URL && typeof n.url === 'string') {
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
