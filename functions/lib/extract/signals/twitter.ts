import type { CheerioAPI } from 'cheerio';
import type { CSLItem } from '../../csl-types';
import type { SignalResult } from './jsonld';

const CONF = 0.55;

function meta($: CheerioAPI, name: string): string | null {
  const v = $(`meta[name="twitter:${name}" i], meta[property="twitter:${name}" i]`).attr('content');
  return v ? v.trim() || null : null;
}

export function twitterSignal($: CheerioAPI): SignalResult {
  const fields: Partial<CSLItem> = {};
  const confidence: SignalResult['confidence'] = {};

  const title = meta($, 'title');
  if (title) { fields.title = title; confidence.title = CONF; }

  const site = meta($, 'site');
  if (site && !site.startsWith('@')) {
    fields['container-title'] = site;
    confidence['container-title'] = CONF;
  }

  return { fields, confidence };
}
