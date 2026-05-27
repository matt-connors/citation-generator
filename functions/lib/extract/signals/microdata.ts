import type { CheerioAPI } from 'cheerio';
import type { CSLItem } from '../../csl-types';
import { parseAuthorName } from '../author-parse';
import { parseIsoDate } from '../date-parse';
import type { SignalResult } from './jsonld';

const CONF = 0.85;

function readValue($: CheerioAPI, sel: string): string | null {
  const el = $(sel).first();
  if (!el.length) return null;
  return (el.attr('content') || el.attr('datetime') || el.text() || '').trim() || null;
}

export function microdataSignal($: CheerioAPI): SignalResult {
  const fields: Partial<CSLItem> = {};
  const confidence: SignalResult['confidence'] = {};

  const title = readValue($, '[itemprop="headline"]') || readValue($, '[itemprop="name"]');
  if (title) { fields.title = title; confidence.title = CONF; }

  const authorText = readValue($, '[itemprop="author"]');
  if (authorText) {
    const parsed = parseAuthorName(authorText);
    if (parsed) { fields.author = [parsed]; confidence.author = CONF; }
  }

  const datePublished = readValue($, '[itemprop="datePublished"]');
  if (datePublished) {
    const dp = parseIsoDate(datePublished);
    if (dp) { fields.issued = { 'date-parts': [dp] }; confidence.issued = CONF; }
  }

  const publisher = readValue($, '[itemprop="publisher"] [itemprop="name"]') || readValue($, '[itemprop="publisher"]');
  if (publisher) { fields.publisher = publisher; confidence.publisher = CONF; }

  return { fields, confidence };
}
