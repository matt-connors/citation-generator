import type { CheerioAPI } from 'cheerio';
import type { CSLItem } from '../../csl-types';
import { parseAuthorName } from '../author-parse';
import { parseIsoDate } from '../date-parse';
import type { SignalResult } from './jsonld';

const CONF_TITLE = 0.4;
const CONF_AUTHOR_REL = 0.45;
const CONF_AUTHOR_BYLINE = 0.35;
const CONF_TIME = 0.45;

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
    const parsed = parseAuthorName(relAuthor);
    if (parsed) { fields.author = [parsed]; confidence.author = CONF_AUTHOR_REL; }
  }

  if (!fields.author) {
    const byline = $('.byline, .author, .article-author').first().text().trim();
    if (byline) {
      const cleaned = byline.replace(/^by\s+/i, '').trim();
      const parsed = parseAuthorName(cleaned);
      if (parsed) { fields.author = [parsed]; confidence.author = CONF_AUTHOR_BYLINE; }
    }
  }

  const timeEl = $('time[datetime]').first();
  if (timeEl.length) {
    const dp = parseIsoDate(timeEl.attr('datetime') || '');
    if (dp) { fields.issued = { 'date-parts': [dp] }; confidence.issued = CONF_TIME; }
  }

  return { fields, confidence };
}
