import type { CheerioAPI } from 'cheerio';
import type { CSLItem } from '../../csl-types';
import { parseAuthorName } from '../author-parse';
import { parseIsoDate } from '../date-parse';
import type { SignalResult } from './jsonld';

const CONF = 0.75;
const AUTHOR_CONF = 0.6;

function meta($: CheerioAPI, prop: string): string | null {
  const v = $(`meta[property="${prop}"]`).attr('content');
  return v ? v.trim() || null : null;
}

export function openGraphSignal($: CheerioAPI): SignalResult {
  const fields: Partial<CSLItem> = {};
  const confidence: SignalResult['confidence'] = {};

  const title = meta($, 'og:title');
  if (title) { fields.title = title; confidence.title = CONF; }

  const site = meta($, 'og:site_name');
  if (site) { fields['container-title'] = site; confidence['container-title'] = CONF; }

  const url = meta($, 'og:url');
  if (url) { fields.URL = url; confidence.URL = CONF; }

  const pub = meta($, 'article:published_time');
  if (pub) {
    const dp = parseIsoDate(pub);
    if (dp) { fields.issued = { 'date-parts': [dp] }; confidence.issued = CONF; }
  }

  const author = meta($, 'article:author');
  if (author && !/^https?:\/\//i.test(author)) {
    const parsed = parseAuthorName(author);
    if (parsed) { fields.author = [parsed]; confidence.author = AUTHOR_CONF; }
  }

  return { fields, confidence };
}
