import type { CheerioAPI } from 'cheerio';
import type { CitationQualityWarning, CSLItem, CSLType } from '../csl-types';
import { decodeJsonLdEntities } from './signals/jsonld';

/**
 * High-confidence page-type signals collected from HTML (schema.org / OG).
 * Used by hybrid source-type inference — not every signal forces a type change.
 */
export interface PageTypeHints {
  schemaTypes: string[];
  ogType?: string;
}

export interface TypeInferenceResult {
  type: CSLType;
  /** Fields to merge onto the CSL item when inference is high-confidence. */
  fieldPatches: Partial<CSLItem>;
  /** Review warnings for ambiguous cases (e.g. .gov pages). */
  warnings: CitationQualityWarning[];
}

const NEWS_SCHEMA_TYPES = new Set([
  'NewsArticle',
  'AnalysisNewsArticle',
  'OpinionNewsArticle',
  'BackgroundNewsArticle',
  'ReportageNewsArticle',
]);

const VIDEO_SCHEMA_TYPES = new Set(['VideoObject']);

/** Well-known news publishers — host match alone is high confidence with article-ish metadata. */
const NEWS_HOST_SUFFIXES = [
  'nytimes.com',
  'theguardian.com',
  'theguardian.co.uk',
  'apnews.com',
  'reuters.com',
  'bbc.com',
  'bbc.co.uk',
  'washingtonpost.com',
  'wsj.com',
  'latimes.com',
  'cnn.com',
  'npr.org',
  'nbcnews.com',
  'cbsnews.com',
  'abcnews.go.com',
  'usatoday.com',
  'politico.com',
  'bloomberg.com',
  'ft.com',
  'economist.com',
  'aljazeera.com',
  'axios.com',
  'thehill.com',
  'foxnews.com',
  'news.yahoo.com',
  'cbc.ca',
  'globalnews.ca',
];

/**
 * Infer CSL type + style-critical field patches from URL, extracted fields, and page hints.
 *
 * Auto-applies only high-confidence cases (YouTube, clear news, journals). Ambiguous
 * government pages stay `webpage` and receive a choose-source-type review warning.
 */
export function inferSourceType(
  item: Partial<CSLItem>,
  url: string,
  hints: PageTypeHints = { schemaTypes: [] },
): TypeInferenceResult {
  const warnings: CitationQualityWarning[] = [];
  const host = hostnameOf(url);
  const schemaTypes = hints.schemaTypes ?? [];

  // 1. Journal landing pages with scholarly locators / DOI (existing path).
  if (item['container-title'] && (item.volume || item.issue || item.page || item.DOI)) {
    return { type: 'article-journal', fieldPatches: {}, warnings };
  }

  // 2. YouTube / short-link video hosts — webpage + APA [Video] genre + YouTube container.
  if (isYouTubeHost(host) || hasVideoObjectOnVideoHost(host, schemaTypes)) {
    return {
      type: 'webpage',
      fieldPatches: youtubeFieldPatches(item),
      warnings,
    };
  }

  // 3. Clear news: NewsArticle schema family and/or known news host with article signals.
  if (isClearNews(schemaTypes, host, item, hints.ogType)) {
    return { type: 'article-newspaper', fieldPatches: {}, warnings };
  }

  // 4. Ambiguous government / agency pages — do not force report; ask the user.
  if (isGovernmentHost(host) && !hasStrongReportSignals(item, schemaTypes)) {
    warnings.push({
      code: 'source_type_ambiguous',
      field: 'type',
      severity: 'review',
      message:
        'This looks like a government or agency page. Confirm whether it should be cited as a webpage, newspaper, journal, or another source type.',
      action: 'choose-source-type',
    });
  }

  return { type: 'webpage', fieldPatches: {}, warnings };
}

/** Collect schema.org @type values and og:type from the page for type inference. */
export function collectPageTypeHints($: CheerioAPI): PageTypeHints {
  const schemaTypes = new Set<string>();
  $('script[type="application/ld+json"]').each((_, el) => {
    let blob: unknown;
    try {
      blob = JSON.parse(decodeJsonLdEntities($(el).contents().text()));
    } catch {
      return;
    }
    collectSchemaTypes(blob, schemaTypes);
  });

  const ogRaw = $('meta[property="og:type" i], meta[name="og:type" i]').attr('content');
  const ogType = ogRaw?.trim() || undefined;

  return { schemaTypes: [...schemaTypes], ogType };
}

export function isYouTubeHost(host: string): boolean {
  const h = host.toLowerCase();
  return (
    h === 'youtu.be'
    || h === 'youtube.com'
    || h === 'www.youtube.com'
    || h === 'm.youtube.com'
    || h === 'music.youtube.com'
    || h.endsWith('.youtube.com')
  );
}

export function isGovernmentHost(host: string): boolean {
  const h = host.toLowerCase();
  if (!h) return false;
  // Public-sector suffixes. Keep conservative — prefer review warnings over false report typing.
  return (
    h === 'gov'
    || h.endsWith('.gov')
    || h.endsWith('.gov.uk')
    || h.endsWith('.gc.ca')
    || h.endsWith('.mil')
    || h.endsWith('.gov.au')
    || h.endsWith('.govt.nz')
  );
}

export function isNewsHost(host: string): boolean {
  const h = host.toLowerCase();
  if (!h) return false;
  return NEWS_HOST_SUFFIXES.some((suffix) => h === suffix || h.endsWith(`.${suffix}`));
}

function youtubeFieldPatches(item: Partial<CSLItem>): Partial<CSLItem> {
  const patches: Partial<CSLItem> = {
    genre: item.genre?.trim() || 'Video',
    'container-title': normalizeYouTubeContainer(item['container-title']),
  };
  return patches;
}

function normalizeYouTubeContainer(value: string | undefined): string {
  if (!value || !value.trim()) return 'YouTube';
  const normalized = value.trim();
  // og:site_name is usually already "YouTube"; leave other values only if clearly YouTube.
  if (/^youtube$/i.test(normalized)) return 'YouTube';
  // Prefer canonical platform name for style correctness.
  return 'YouTube';
}

function isClearNews(
  schemaTypes: string[],
  host: string,
  item: Partial<CSLItem>,
  ogType?: string,
): boolean {
  if (schemaTypes.some((t) => NEWS_SCHEMA_TYPES.has(t))) return true;
  if (isNewsHost(host) && hasArticleishSignals(item, ogType)) return true;
  return false;
}

function hasArticleishSignals(item: Partial<CSLItem>, ogType?: string): boolean {
  if (ogType && /article/i.test(ogType)) return true;
  // News hosts with a title + container/publisher are almost always articles.
  if (item.title && (item['container-title'] || item.publisher || item.author)) return true;
  return false;
}

function hasVideoObjectOnVideoHost(host: string, schemaTypes: string[]): boolean {
  if (!schemaTypes.some((t) => VIDEO_SCHEMA_TYPES.has(t))) return false;
  // Only auto-apply video patches on known video hosts to avoid misc. VideoObject pages.
  return isYouTubeHost(host) || host === 'vimeo.com' || host.endsWith('.vimeo.com');
}

function hasStrongReportSignals(item: Partial<CSLItem>, schemaTypes: string[]): boolean {
  // We intentionally do not map to CSL `report` yet (not in CSLType). Strong signals only
  // suppress the ambiguous-gov warning when the page is clearly something else.
  if (schemaTypes.includes('ScholarlyArticle') || schemaTypes.includes('MedicalScholarlyArticle')) {
    return true;
  }
  if (item.DOI || item.volume || item.issue) return true;
  return false;
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return '';
  }
}

function collectSchemaTypes(node: unknown, out: Set<string>): void {
  if (Array.isArray(node)) {
    for (const item of node) collectSchemaTypes(item, out);
    return;
  }
  if (!node || typeof node !== 'object') return;
  const n = node as Record<string, unknown>;
  const raw = n['@type'];
  if (typeof raw === 'string') {
    for (const part of raw.split(/[\s,]+/)) {
      const t = part.trim();
      if (t) out.add(t.includes('/') ? t.split('/').pop()! : t);
    }
  } else if (Array.isArray(raw)) {
    for (const item of raw) {
      if (typeof item === 'string') {
        const t = item.includes('/') ? item.split('/').pop()! : item;
        if (t) out.add(t);
      }
    }
  }
  if (n['@graph']) collectSchemaTypes(n['@graph'], out);
  if (n.mainEntity) collectSchemaTypes(n.mainEntity, out);
  if (n.mainEntityOfPage && typeof n.mainEntityOfPage === 'object') {
    collectSchemaTypes(n.mainEntityOfPage, out);
  }
}
