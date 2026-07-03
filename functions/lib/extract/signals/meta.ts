import type { CheerioAPI } from 'cheerio';
import type { CSLItem } from '../../csl-types';
import { parseAuthorList } from '../author-parse';
import { parseDate } from '../date-parse';
import { validateDoi } from '../../journal/doi-detect';
import type { SignalResult } from './jsonld';

const CONF_META = 0.55;
const CONF_CITATION = 0.85;
const CONF_DC_DATE = 0.7;

function meta($: CheerioAPI, sel: string): string | null {
  const v = $(sel).attr('content');
  return v ? v.trim() || null : null;
}

function firstMeta($: CheerioAPI, selectors: string[]): string | null {
  for (const sel of selectors) {
    const value = meta($, sel);
    if (value) return value;
  }
  return null;
}

// Returns the `content` of every meta tag matching `sel` (trimmed, non-empty).
// `meta()` only returns the first match — for repeated meta tags like
// citation_author or DC.creator (Nature publishes 24 dc.creator entries for
// some papers), we need every value.
function metaAll($: CheerioAPI, sel: string): string[] {
  const out: string[] = [];
  $(sel).each((_, el) => {
    const v = $(el).attr('content');
    if (v && v.trim()) out.push(v.trim());
  });
  return out;
}

function cleanText(value: string | null): string | null {
  if (!value) return null;
  return value.replace(/\s+/g, ' ').trim() || null;
}

function setTextField(
  fields: Partial<CSLItem>,
  confidence: SignalResult['confidence'],
  field: keyof CSLItem,
  value: string | null,
  score = CONF_CITATION,
): void {
  const cleaned = cleanText(value);
  if (cleaned) {
    (fields as any)[field] = cleaned;
    confidence[field] = score;
  }
}

function normalizeDoi(raw: string): string | null {
  const direct = validateDoi(raw);
  if (direct) return direct;
  const match = raw.match(/\b10\.\d{4,9}\/[^\s"'#?]+/i);
  return match ? validateDoi(match[0]) : null;
}

export function metaSignal($: CheerioAPI): SignalResult {
  const fields: Partial<CSLItem> = {};
  const confidence: SignalResult['confidence'] = {};

  const publisher = firstMeta($, [
    'meta[name="citation_publisher" i]',
    'meta[name="DC.publisher" i]',
    'meta[name="dcterms.publisher" i]',
    'meta[name="publisher" i]',
  ]);
  if (publisher) { fields.publisher = publisher; confidence.publisher = CONF_META; }

  const cTitle = firstMeta($, [
    'meta[name="citation_title" i]',
    'meta[name="DC.title" i]',
    'meta[name="dcterms.title" i]',
    'meta[name="parsely-title" i]',
    'meta[name="sailthru.title" i]',
  ]);
  if (cTitle) { fields.title = cTitle; confidence.title = CONF_CITATION; }

  // NOTE: cheerio's `i` flag already makes attribute-value matching
  // case-insensitive, so a single `DC.creator` selector matches both
  // `DC.creator` and `dc.creator`. Listing both selectors here would double
  // every entry.
  const cAuthors = [
    ...metaAll($, 'meta[name="citation_author" i]'),
    ...metaAll($, 'meta[name="DC.creator" i]'),
  ];
  if (cAuthors.length) {
    const parsed = cAuthors.flatMap((s) => parseAuthorList(s));
    if (parsed.length) {
      fields.author = parsed;
      confidence.author = CONF_CITATION;
    }
  }

  if (!fields.author) {
    const author = meta($, 'meta[name="author" i]');
    if (author) {
      const split = parseAuthorList(author);
      if (split.length) { fields.author = split; confidence.author = CONF_META; }
    }
  }

  const dateRaw =
    firstMeta($, [
      'meta[name="citation_publication_date" i]',
      'meta[name="citation_date" i]',
      'meta[name="citation_online_date" i]',
      'meta[name="DC.date" i]',
      'meta[name="DC.date.issued" i]',
      'meta[name="dcterms.created" i]',
      'meta[name="dcterms.issued" i]',
      'meta[name="date" i]',
      'meta[name="pubdate" i]',
      'meta[name="publishdate" i]',
      'meta[name="parsely-pub-date" i]',
      'meta[name="sailthru.date" i]',
      'meta[property="article:published_time" i]',
    ]);
  if (dateRaw) {
    const dp = parseDate(dateRaw);
    if (dp) { fields.issued = { 'date-parts': [dp] }; confidence.issued = CONF_DC_DATE; }
  }

  const journal = firstMeta($, [
    'meta[name="citation_journal_title" i]',
    'meta[name="citation_conference_title" i]',
    'meta[name="citation_inbook_title" i]',
  ]);
  if (journal) { fields['container-title'] = journal; confidence['container-title'] = CONF_CITATION; }
  if (!fields['container-title']) {
    const siteName = firstMeta($, [
      'meta[name="application-name" i]',
      'meta[name="apple-mobile-web-app-title" i]',
    ]);
    if (siteName) { fields['container-title'] = siteName; confidence['container-title'] = CONF_META; }
  }

  const doi = firstMeta($, [
    'meta[name="citation_doi" i]',
    'meta[name="doi" i]',
    'meta[name="DC.identifier" i]',
    'meta[name="dcterms.identifier" i]',
    'meta[name="prism.doi" i]',
  ]);
  if (doi) {
    const normalized = normalizeDoi(doi);
    if (normalized) {
      fields.DOI = normalized;
      confidence.DOI = CONF_CITATION;
    }
  }

  setTextField(fields, confidence, 'volume', firstMeta($, [
    'meta[name="citation_volume" i]',
    'meta[name="prism.volume" i]',
  ]));

  setTextField(fields, confidence, 'issue', firstMeta($, [
    'meta[name="citation_issue" i]',
    'meta[name="prism.number" i]',
    'meta[name="prism.issueIdentifier" i]',
  ]));

  const pages = firstMeta($, [
    'meta[name="citation_pages" i]',
    'meta[name="prism.pageRange" i]',
  ]);
  if (pages) {
    setTextField(fields, confidence, 'page', pages);
  } else {
    const firstPage = firstMeta($, [
      'meta[name="citation_firstpage" i]',
      'meta[name="prism.startingPage" i]',
    ]);
    const lastPage = firstMeta($, [
      'meta[name="citation_lastpage" i]',
      'meta[name="prism.endingPage" i]',
    ]);
    if (firstPage && lastPage) setTextField(fields, confidence, 'page', `${firstPage}-${lastPage}`);
    else setTextField(fields, confidence, 'page', firstPage);
  }

  setTextField(fields, confidence, 'abstract', firstMeta($, [
    'meta[name="citation_abstract" i]',
    'meta[name="dc.description.abstract" i]',
    'meta[name="dcterms.abstract" i]',
  ]));

  return { fields, confidence };
}
