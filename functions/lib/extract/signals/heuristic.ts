import type { CheerioAPI } from 'cheerio';
import type { CSLItem } from '../../csl-types';
import { parseAuthorList } from '../author-parse';
import { parseDate } from '../date-parse';
import type { SignalResult } from './jsonld';

const CONF_TITLE = 0.4;
const CONF_AUTHOR_REL = 0.45;
const CONF_AUTHOR_BYLINE = 0.35;
const CONF_TIME = 0.45;
const CONF_CANONICAL_URL = 0.7;

const TITLE_SEP = /\s+[—\-–|]\s+/;

export function heuristicSignal($: CheerioAPI): SignalResult {
  const fields: Partial<CSLItem> = {};
  const confidence: SignalResult['confidence'] = {};

  const titleEl = $('title').first().text().trim();
  if (titleEl) {
    const parts = titleEl.split(TITLE_SEP);
    fields.title = parts[0].trim();
    confidence.title = CONF_TITLE;
  }

  const relAuthor = $('a[rel="author"], [rel="author"]').first().text().trim();
  if (relAuthor) {
    const parsed = parseAuthorList(relAuthor);
    if (parsed.length) { fields.author = parsed; confidence.author = CONF_AUTHOR_REL; }
  }

  if (!fields.author) {
    // Iterate the byline candidates rather than blindly trusting `.first()`: a
    // lone role-word label (e.g. `<span class="byline">by</span>`) precedes the
    // sibling `<span class="author">Name</span>` in document order and parses to
    // an empty list, so we skip it and land on the first element that yields a
    // real author.
    $('.byline, .author, .article-author, [class*="byline" i], [class*="author" i], [data-testid*="byline" i], [data-testid*="author" i]').each((_, el) => {
      const text = $(el).text().trim();
      if (!text) return; // continue
      const parsed = parseAuthorList(cleanBylineText(text));
      if (parsed.length) {
        fields.author = parsed;
        confidence.author = CONF_AUTHOR_BYLINE;
        return false; // break
      }
      return; // continue
    });
  }

  const timeEl = $('time[datetime]').first();
  if (timeEl.length) {
    const dp = parseDate(timeEl.attr('datetime') || '') || parseDate(timeEl.text());
    if (dp) { fields.issued = { 'date-parts': [dp] }; confidence.issued = CONF_TIME; }
  }

  const canonical = $('link[rel="canonical" i]').first().attr('href')?.trim();
  if (canonical) {
    fields.URL = canonical;
    confidence.URL = CONF_CANONICAL_URL;
  }

  return { fields, confidence };
}

function cleanBylineText(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    // Strip a TRAILING "…published/updated/posted on <date>" clause. Require
    // preceding whitespace so a leading role prefix ("Posted by Joel Spolsky")
    // isn't deleted wholesale — that byline must survive for parseAuthorList to
    // strip the "Posted by" and read the name.
    .replace(/\s+\b(?:published|updated|posted|last updated|last reviewed|reviewed)\b.*$/i, '')
    .replace(/\s+on\s+(?:\d{1,2}\s+[A-Za-z]+|[A-Za-z]+\s+\d{1,2}|\d{4}|\d{1,2}[/-]\d{1,2}[/-]\d{2,4}).*$/i, '')
    .trim();
}
