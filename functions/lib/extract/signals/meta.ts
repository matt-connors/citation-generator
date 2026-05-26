import type { CheerioAPI } from 'cheerio';
import type { CSLItem, CSLName } from '../../csl-types';
import { parseAuthorName } from '../author-parse';
import { parseIsoDate } from '../date-parse';
import type { SignalResult } from './jsonld';

const CONF_META = 0.55;
const CONF_CITATION = 0.85;
const CONF_DC_DATE = 0.7;

function meta($: CheerioAPI, sel: string): string | null {
  const v = $(sel).attr('content');
  return v ? v.trim() || null : null;
}

export function metaSignal($: CheerioAPI): SignalResult {
  const fields: Partial<CSLItem> = {};
  const confidence: SignalResult['confidence'] = {};

  const author = meta($, 'meta[name="author" i]');
  if (author) {
    const split = author.split(/[,;]/).map((s) => parseAuthorName(s.trim())).filter(Boolean) as CSLName[];
    if (split.length) { fields.author = split; confidence.author = CONF_META; }
  }

  const publisher = meta($, 'meta[name="publisher" i]');
  if (publisher) { fields.publisher = publisher; confidence.publisher = CONF_META; }

  const cTitle = meta($, 'meta[name="citation_title" i]');
  if (cTitle) { fields.title = cTitle; confidence.title = CONF_CITATION; }

  const cAuthor = meta($, 'meta[name="citation_author" i]') || meta($, 'meta[name="DC.creator" i]') || meta($, 'meta[name="dc.creator" i]');
  if (cAuthor && !fields.author) {
    const split = cAuthor.split(/;/).map((s) => parseAuthorName(s.trim())).filter(Boolean) as CSLName[];
    if (split.length) { fields.author = split; confidence.author = CONF_CITATION; }
  }

  const dateRaw =
    meta($, 'meta[name="citation_publication_date" i]') ||
    meta($, 'meta[name="DC.date" i]') ||
    meta($, 'meta[name="dc.date" i]') ||
    meta($, 'meta[name="DC.date.issued" i]');
  if (dateRaw) {
    const dp = parseIsoDate(dateRaw);
    if (dp) { fields.issued = { 'date-parts': [dp] }; confidence.issued = CONF_DC_DATE; }
  }

  const journal = meta($, 'meta[name="citation_journal_title" i]');
  if (journal) { fields['container-title'] = journal; confidence['container-title'] = CONF_CITATION; }

  return { fields, confidence };
}
