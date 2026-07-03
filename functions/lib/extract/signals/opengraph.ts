import type { CheerioAPI } from 'cheerio';
import type { CSLItem } from '../../csl-types';
import { parseAuthorList } from '../author-parse';
import { parseDate } from '../date-parse';
import type { SignalResult } from './jsonld';

const CONF = 0.75;
const AUTHOR_CONF = 0.6;

function meta($: CheerioAPI, prop: string): string | null {
  const v = $(`meta[property="${prop}" i], meta[name="${prop}" i]`).attr('content');
  return v ? v.trim() || null : null;
}

function metaAll($: CheerioAPI, prop: string): string[] {
  const out: string[] = [];
  $(`meta[property="${prop}" i], meta[name="${prop}" i]`).each((_, el) => {
    const v = $(el).attr('content');
    if (v && v.trim()) out.push(v.trim());
  });
  return out;
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

  const pub = meta($, 'article:published_time') || meta($, 'article:modified_time') || meta($, 'og:updated_time');
  if (pub) {
    const dp = parseDate(pub);
    if (dp) { fields.issued = { 'date-parts': [dp] }; confidence.issued = CONF; }
  }

  const authors = metaAll($, 'article:author')
    .filter((author) => !/^https?:\/\//i.test(author))
    .flatMap((author) => parseAuthorList(author));
  if (authors.length) {
    fields.author = authors;
    confidence.author = AUTHOR_CONF;
  }

  return { fields, confidence };
}
