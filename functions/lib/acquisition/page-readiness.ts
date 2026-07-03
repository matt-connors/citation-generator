import * as cheerio from 'cheerio';
import type { CSLItem } from '../csl-types';

const BLOCKER_PATTERNS = [
  /access denied/i,
  /captcha/i,
  /checking your browser/i,
  /enable javascript/i,
  /just a moment/i,
  /unusual traffic/i,
  /verify you are human/i,
  /temporarily blocked/i,
  /forbidden/i,
];

const GENERIC_TITLE_PATTERNS = [
  /^loading/i,
  /^just a moment/i,
  /^access denied/i,
  /^error/i,
  /^403\b/i,
  /^attention required/i,
];

export interface PageReadiness {
  status: 'ready' | 'partial' | 'blocked' | 'timeout' | 'empty';
  title: string;
  canonicalUrl?: string;
  textLength: number;
  metadataFieldCount: number;
  articleLikeTextLength: number;
  scriptTextLength: number;
  blockerSignals: string[];
  stableSignals: string[];
  reason: string;
}

export function analyzeHtmlReadiness(html: string, url: string): PageReadiness {
  if (!html.trim()) {
    return emptyReadiness('empty', 'No HTML was returned.');
  }

  const $ = cheerio.load(html);
  const title = $('title').first().text().replace(/\s+/g, ' ').trim();
  const canonicalUrl = $('link[rel="canonical" i]').first().attr('href')?.trim();
  const metadataFieldCount = $('meta[content], script[type="application/ld+json"], [itemprop]').length;
  const scriptTextLength = $('script').toArray().reduce((sum, el) => sum + ($(el).html() || '').length, 0);

  const bodyForText = $('body').clone();
  bodyForText.find('script, style, noscript, svg, nav, footer').remove();
  const text = bodyForText.text().replace(/\s+/g, ' ').trim();
  const textLength = text.length;
  const articleLikeTextLength = $('article, main, [role="main"], [class*="article" i], [class*="story" i]')
    .toArray()
    .reduce((sum, el) => sum + $(el).text().replace(/\s+/g, ' ').trim().length, 0);
  const combined = `${title}\n${text.slice(0, 5000)}`;
  const blockerSignals = BLOCKER_PATTERNS
    .filter((pattern) => pattern.test(combined))
    .map((pattern) => pattern.source);

  if (blockerSignals.length) {
    return {
      status: 'blocked',
      title,
      canonicalUrl: resolveUrl(canonicalUrl, url),
      textLength,
      metadataFieldCount,
      articleLikeTextLength,
      scriptTextLength,
      blockerSignals,
      stableSignals: [],
      reason: 'The page content matched an automated-access blocker.',
    };
  }

  const stableSignals: string[] = [];
  if (title && !GENERIC_TITLE_PATTERNS.some((pattern) => pattern.test(title))) stableSignals.push('meaningful-title');
  if (canonicalUrl) stableSignals.push('canonical-url');
  if (metadataFieldCount >= 3) stableSignals.push('metadata');
  if (textLength >= 600) stableSignals.push('body-text');
  if (articleLikeTextLength >= 300) stableSignals.push('article-like-text');

  if (!title && textLength < 100 && metadataFieldCount === 0) {
    return {
      status: 'empty',
      title,
      canonicalUrl: resolveUrl(canonicalUrl, url),
      textLength,
      metadataFieldCount,
      articleLikeTextLength,
      scriptTextLength,
      blockerSignals,
      stableSignals,
      reason: 'The page had almost no readable content or metadata.',
    };
  }

  if (stableSignals.includes('meaningful-title') && (metadataFieldCount >= 3 || textLength >= 600)) {
    return {
      status: 'ready',
      title,
      canonicalUrl: resolveUrl(canonicalUrl, url),
      textLength,
      metadataFieldCount,
      articleLikeTextLength,
      scriptTextLength,
      blockerSignals,
      stableSignals,
      reason: 'The page had a meaningful title plus metadata or readable body text.',
    };
  }

  return {
    status: 'partial',
    title,
    canonicalUrl: resolveUrl(canonicalUrl, url),
    textLength,
    metadataFieldCount,
    articleLikeTextLength,
    scriptTextLength,
    blockerSignals,
    stableSignals,
    reason: 'The page appeared incomplete or thin after static fetch.',
  };
}

export function shouldTryRenderedAcquisition(csl: CSLItem, readiness: PageReadiness): boolean {
  if (readiness.status === 'blocked' || readiness.status === 'empty' || readiness.status === 'partial') return true;
  if (!csl.title || !csl.author?.length || !csl.issued?.['date-parts']?.[0]?.[0]) {
    return readiness.scriptTextLength > readiness.textLength * 2 || readiness.textLength < 800;
  }
  return false;
}

export function extractReadableText(html: string, maxChars = 7000): string {
  const $ = cheerio.load(html);
  $('script, style, noscript, svg, nav, footer').remove();
  return $('body').text().replace(/\s+/g, ' ').trim().slice(0, maxChars);
}

function emptyReadiness(status: PageReadiness['status'], reason: string): PageReadiness {
  return {
    status,
    title: '',
    textLength: 0,
    metadataFieldCount: 0,
    articleLikeTextLength: 0,
    scriptTextLength: 0,
    blockerSignals: [],
    stableSignals: [],
    reason,
  };
}

function resolveUrl(value: string | undefined, base: string): string | undefined {
  if (!value) return undefined;
  try {
    return new URL(value, base).href;
  } catch {
    return value;
  }
}
