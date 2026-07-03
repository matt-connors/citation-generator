import type { CheerioAPI } from 'cheerio';
import type { CSLItem } from '../../csl-types';
import { parseAuthorList } from '../author-parse';
import { parseDate } from '../date-parse';
import { validateDoi } from '../../journal/doi-detect';
import type { SignalResult } from './jsonld';

const CONF = 0.85;

function readValue($: CheerioAPI, sel: string): string | null {
  const el = $(sel).first();
  if (!el.length) return null;
  return (el.attr('content') || el.attr('datetime') || el.attr('href') || el.text() || '').trim() || null;
}

function readValues($: CheerioAPI, sel: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  $(sel).each((_, el) => {
    const v = ($(el).attr('content') || $(el).attr('datetime') || $(el).attr('href') || $(el).text() || '').replace(/\s+/g, ' ').trim();
    if (v && !seen.has(v)) {
      seen.add(v);
      out.push(v);
    }
  });
  return out;
}

function firstDoi(values: string[]): string | null {
  for (const value of values) {
    const direct = validateDoi(value);
    if (direct) return direct;
    const match = value.match(/\b10\.\d{4,9}\/[^\s"'#?]+/i);
    const doi = match ? validateDoi(match[0]) : null;
    if (doi) return doi;
  }
  return null;
}

function pageRange(start: string | null, end: string | null): string | null {
  if (!start) return null;
  return end ? `${start}-${end}` : start;
}

export function microdataSignal($: CheerioAPI): SignalResult {
  const fields: Partial<CSLItem> = {};
  const confidence: SignalResult['confidence'] = {};

  const title = readValue($, '[itemprop="headline"]') || readValue($, '[itemprop="name"]');
  if (title) { fields.title = title; confidence.title = CONF; }

  const authorValues = readValues($, '[itemprop="author"] [itemprop="name"], [itemprop="author"]');
  if (authorValues.length) {
    const parsed = authorValues.flatMap((author) => parseAuthorList(author));
    if (parsed.length) { fields.author = parsed; confidence.author = CONF; }
  }

  const datePublished =
    readValue($, '[itemprop="datePublished"]') ||
    readValue($, '[itemprop="dateCreated"]') ||
    readValue($, '[itemprop="dateModified"]');
  if (datePublished) {
    const dp = parseDate(datePublished);
    if (dp) { fields.issued = { 'date-parts': [dp] }; confidence.issued = CONF; }
  }

  const publisher = readValue($, '[itemprop="publisher"] [itemprop="name"]') || readValue($, '[itemprop="publisher"]');
  if (publisher) { fields.publisher = publisher; confidence.publisher = CONF; }

  const container = readValue($, '[itemprop="isPartOf"] [itemprop="name"]');
  if (container) { fields['container-title'] = container; confidence['container-title'] = CONF; }

  const doi = firstDoi(readValues($, '[itemprop="identifier"], [itemprop="sameAs"]'));
  if (doi) { fields.DOI = doi; confidence.DOI = CONF; }

  const volume = readValue($, '[itemprop="volumeNumber"], [itemprop="volume"]');
  if (volume) { fields.volume = volume; confidence.volume = CONF; }

  const issue = readValue($, '[itemprop="issueNumber"], [itemprop="issue"]');
  if (issue) { fields.issue = issue; confidence.issue = CONF; }

  const page = readValue($, '[itemprop="pagination"]') ||
    pageRange(readValue($, '[itemprop="pageStart"]'), readValue($, '[itemprop="pageEnd"]'));
  if (page) { fields.page = page; confidence.page = CONF; }

  const abstract = readValue($, '[itemprop="abstract"]');
  if (abstract) { fields.abstract = abstract; confidence.abstract = CONF; }

  return { fields, confidence };
}
