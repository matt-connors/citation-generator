const ARTICLE_TYPES = new Set([
  'Article', 'NewsArticle', 'BlogPosting', 'WebPage', 'ScholarlyArticle',
  'Report', 'TechArticle', 'AnalysisNewsArticle', 'OpinionNewsArticle',
  'ReviewArticle', 'BackgroundNewsArticle', 'LiveBlogPosting',
  'SocialMediaPosting', 'MedicalScholarlyArticle',
]);

const NON_ARTICLE_CONTAINER_RE = /^(WebSite|Organization|NewsMediaOrganization|Person|Corporation|BreadcrumbList|SiteNavigationElement|CollectionPage|ProfilePage|SearchResultsPage|ImageObject|VideoObject)$/i;
const TITLE_SEP = /\s+[-|:]\s+/;
const ORG_SUFFIXES = /\b(Inc\.?|LLC|Ltd\.?|Corp\.?|Corporation|Foundation|Press|University|Institute|Society|Group|Company|Co\.?|Department|Office|Agency|Bureau|Commission|Administration|Authority|Association|Council|Center|Centre|Laboratory|Lab|Labs|Ministry|Service|Services|News|Editorial Board|Editorial Team|Staff)[.\s]*$/i;
const PARTICLES = new Set([
  'von', 'de', 'del', 'della', 'van', 'la', 'le', 'der', 'den', 'di', 'da', 'du', 'dos', 'des',
]);
const SUFFIX = /^(Jr\.?|Sr\.?|II|III|IV|V|PhD|Ph\.D\.?|MD|M\.D\.?|MA|MSc|BSc|Esq\.?)$/i;
const DOI_RE = /\b(10\.\d{4,9}\/[^\s"'#?]+)/i;
const DOI_EXACT_RE = /^(10\.\d{4,9}\/[^\s"'#?]+)$/i;
const MONTHS = {
  january: 1, jan: 1,
  february: 2, feb: 2,
  march: 3, mar: 3,
  april: 4, apr: 4,
  may: 5,
  june: 6, jun: 6,
  july: 7, jul: 7,
  august: 8, aug: 8,
  september: 9, sept: 9, sep: 9,
  october: 10, oct: 10,
  november: 11, nov: 11,
  december: 12, dec: 12,
};

export function citationFromSnapshot(snapshot, now = new Date()) {
  const meta = normalizeMeta(snapshot?.meta || []);
  const jsonld = jsonLdFields(snapshot?.jsonld || []);
  const fields = {};

  setText(fields, 'title', firstMeta(meta, [
    'citation_title', 'dc.title', 'dcterms.title', 'parsely-title', 'sailthru.title',
  ]) || jsonld.title || firstMeta(meta, ['og:title', 'twitter:title']) || cleanTitle(snapshot?.h1));

  const citationAuthors = allMeta(meta, ['citation_author', 'dc.creator']);
  const authors = citationAuthors.length
    ? citationAuthors.flatMap(parseAuthorList)
    : (jsonld.author || allMeta(meta, [
      'author', 'article:author', 'parsely-author', 'sailthru.author', 'byl', 'byline',
    ])
      .filter((value) => !/^https?:\/\//i.test(value))
      .flatMap(parseAuthorList));
  if (authors.length) fields.author = uniqueAuthors(authors);
  if (!fields.author) {
    const bylineAuthors = (snapshot?.bylineCandidates || [])
      .flatMap(parseAuthorList);
    if (bylineAuthors.length) fields.author = uniqueAuthors(bylineAuthors);
  }

  const dateRaw = firstMeta(meta, [
    'citation_publication_date', 'citation_date', 'citation_online_date',
    'dc.date', 'dc.date.issued', 'dcterms.created', 'dcterms.issued',
    'date', 'pubdate', 'publishdate', 'parsely-pub-date', 'sailthru.date',
    'article:published_time', 'article:modified_time', 'og:updated_time',
  ]) || jsonld.date || firstString(...(snapshot?.timeCandidates || []));
  const issued = parseDate(dateRaw);
  if (issued) fields.issued = { 'date-parts': [issued] };

  const container = firstMeta(meta, [
    'citation_journal_title', 'citation_conference_title', 'citation_inbook_title',
  ]) || jsonld['container-title'] || firstMeta(meta, [
    'og:site_name', 'application-name', 'apple-mobile-web-app-title', 'twitter:site',
  ]);
  setText(fields, 'container-title', normalizeSiteName(container));

  setText(fields, 'publisher', firstMeta(meta, [
    'citation_publisher', 'dc.publisher', 'dcterms.publisher', 'publisher',
  ]) || jsonld.publisher);

  setText(fields, 'volume', firstMeta(meta, ['citation_volume', 'prism.volume']) || jsonld.volume);
  setText(fields, 'issue', firstMeta(meta, ['citation_issue', 'prism.number', 'prism.issueidentifier']) || jsonld.issue);
  const pages = firstMeta(meta, ['citation_pages', 'prism.pagerange']) || jsonld.page || pageRange(
    firstMeta(meta, ['citation_firstpage', 'prism.startingpage']),
    firstMeta(meta, ['citation_lastpage', 'prism.endingpage']),
  );
  setText(fields, 'page', pages);
  setText(fields, 'abstract', firstMeta(meta, [
    'citation_abstract', 'dc.description.abstract', 'dcterms.abstract', 'description', 'og:description',
  ]) || jsonld.abstract);

  const doi = normalizeDoi(firstMeta(meta, [
    'citation_doi', 'doi', 'dc.identifier', 'dcterms.identifier', 'prism.doi',
  ]) || jsonld.DOI || '');
  if (doi) fields.DOI = doi;

  const baseUrl = snapshot?.url || '';
  const url = resolveHttpUrl(
    firstString(
      snapshot?.canonicalUrl,
      firstMeta(meta, ['citation_public_url', 'citation_fulltext_html_url', 'og:url', 'twitter:url']),
      jsonld.URL,
      baseUrl,
    ),
    baseUrl,
  );

  const csl = {
    id: url,
    type: inferType(fields),
    URL: url,
    accessed: dateFrom(now),
    ...fields,
  };
  if (!csl.title) csl.title = cleanTitle(snapshot?.title, csl['container-title']) || url;
  if (!csl['container-title']) csl['container-title'] = siteFromUrl(url);
  dedupePublisherContainer(csl);

  return {
    csl,
    detailCount: usefulDetailCount(csl),
  };
}

export function detailRows(csl) {
  const rows = [
    ['Title', csl?.title],
    ['Author', formatAuthors(csl?.author)],
    ['Date', formatDate(csl?.issued)],
    ['Publication', csl?.['container-title']],
    ['Publisher', csl?.publisher],
    ['Volume', csl?.volume],
    ['Issue', csl?.issue],
    ['Pages', csl?.page],
    ['DOI', csl?.DOI],
    ['Summary', csl?.abstract],
  ];
  return rows
    .filter(([, value]) => value)
    .map(([label, value]) => ({ label, value }));
}

function normalizeMeta(entries) {
  return entries
    .map((entry) => {
      const key = firstString(entry.name, entry.property, entry.itemprop)?.toLowerCase();
      const content = cleanText(entry.content);
      return key && content ? { key, content } : null;
    })
    .filter(Boolean);
}

function firstMeta(meta, keys) {
  const wanted = keys.map((key) => key.toLowerCase());
  const found = meta.find((entry) => wanted.includes(entry.key));
  return found?.content || '';
}

function allMeta(meta, keys) {
  const wanted = new Set(keys.map((key) => key.toLowerCase()));
  return meta
    .filter((entry) => wanted.has(entry.key))
    .map((entry) => entry.content);
}

function jsonLdFields(blocks) {
  const fields = {};
  for (const block of blocks) {
    try {
      walkJsonLd(JSON.parse(decodeJsonLdEntities(block)), fields);
    } catch {
      // Ignore malformed publisher JSON-LD. Other signals still cover the page.
    }
  }
  return fields;
}

function walkJsonLd(node, fields) {
  if (Array.isArray(node)) {
    for (const item of node) walkJsonLd(item, fields);
    return;
  }
  if (!node || typeof node !== 'object') return;

  const articleish = isArticleish(node['@type']);
  if (!fields.title) {
    const title = node.headline || (articleish ? (node.name || node.title) : undefined);
    setText(fields, 'title', title);
  }

  if (!fields.author) {
    const authorNodes = node.author || node.creator;
    const authors = toArray(authorNodes)
      .map(nodeToAuthor)
      .filter(Boolean);
    if (authors.length) fields.author = uniqueAuthors(authors);
  }

  if (!fields.date) {
    const date = firstString(node.datePublished, node.dateCreated, node.dateModified);
    if (date) fields.date = date;
  }

  if (!fields.DOI && articleish) fields.DOI = doiFromValues(node.doi, node.identifier, node.sameAs);
  setText(fields, 'volume', firstString(node.volumeNumber, node.volume, node.isPartOf?.volumeNumber, node.isPartOf?.isPartOf?.volumeNumber));
  setText(fields, 'issue', firstString(node.issueNumber, node.issue, node.isPartOf?.issueNumber));
  setText(fields, 'page', firstString(node.pagination) || pageRange(node.pageStart, node.pageEnd));
  setText(fields, 'abstract', firstString(node.abstract));

  if (!fields.publisher && node.publisher) {
    setText(fields, 'publisher', typeof node.publisher === 'string' ? node.publisher : node.publisher.name);
  }
  if (!fields['container-title'] && articleish && node.isPartOf) {
    setText(fields, 'container-title', typeof node.isPartOf === 'string' ? node.isPartOf : node.isPartOf.name);
  }
  if (!fields.URL && articleish) {
    setText(fields, 'URL', firstString(
      node.url,
      typeof node.mainEntityOfPage === 'string' ? node.mainEntityOfPage : node.mainEntityOfPage?.['@id'],
    ));
  }

  if (node['@graph']) walkJsonLd(node['@graph'], fields);
  if (node.mainEntity) walkJsonLd(node.mainEntity, fields);
}

function isArticleish(type) {
  const types = typeNames(type);
  if (!types.length) return true;
  if (types.some((name) => ARTICLE_TYPES.has(name))) return true;
  return !types.some((name) => NON_ARTICLE_CONTAINER_RE.test(name));
}

function typeNames(type) {
  if (Array.isArray(type)) return type.flatMap(typeNames);
  return String(type || '').split(',').map((part) => part.trim()).filter(Boolean);
}

function nodeToAuthor(author) {
  if (typeof author === 'string') return parseAuthorName(author);
  if (!author || typeof author !== 'object') return null;
  const types = typeNames(author['@type']);
  if (types.includes('Organization') || types.includes('Corporation')) {
    return author.name ? { literal: cleanText(author.name) } : null;
  }
  if (author.familyName || author.givenName) {
    const family = cleanText(author.familyName);
    if (!family) return null;
    const out = { family };
    setText(out, 'given', author.givenName);
    return out;
  }
  return author.name ? parseAuthorName(String(author.name)) : null;
}

function parseAuthorName(input) {
  if (input == null) return null;
  if (typeof input === 'object') return input;
  const trimmed = cleanText(input);
  if (!trimmed) return null;
  if (/^[A-Z][A-Z0-9&.-]{1,14}$/.test(trimmed)) return { literal: trimmed };
  if (ORG_SUFFIXES.test(trimmed)) return { literal: trimmed };

  if (trimmed.includes(',')) {
    const [family, given] = trimmed.split(',', 2).map((part) => part.trim());
    if (!family) return null;
    return given ? { family, given } : { family };
  }

  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return { family: parts[0] };

  let suffix;
  if (SUFFIX.test(parts[parts.length - 1])) suffix = parts.pop();
  const family = parts.pop();
  if (!family) return null;
  const particleParts = [];
  while (parts.length >= 1 && PARTICLES.has(parts[parts.length - 1].toLowerCase())) {
    particleParts.unshift(parts.pop());
  }

  const out = { family };
  if (parts.length) out.given = parts.join(' ');
  if (particleParts.length) out['non-dropping-particle'] = particleParts.join(' ');
  if (suffix) out.suffix = suffix;
  return out;
}

function parseAuthorList(input) {
  const cleaned = cleanText(input)
    ?.replace(/^(by|written by|posted by|author:)\s+/i, '')
    .replace(/\s+et\s+al\.?$/i, '')
    .trim();
  if (!cleaned) return [];
  return splitAuthorSegments(cleaned)
    .map(parseAuthorName)
    .filter(Boolean);
}

function splitAuthorSegments(input) {
  const semicolonParts = input.split(/\s*;\s*/).filter(Boolean);
  if (semicolonParts.length > 1) return semicolonParts.flatMap(splitAuthorSegments);

  const conjunctionParts = input.split(/\s+(?:and|&)\s+/i).filter(Boolean);
  if (conjunctionParts.length > 1 && conjunctionParts.every(looksLikeAuthorUnit)) {
    return conjunctionParts.flatMap(splitAuthorSegments);
  }

  return splitCommaSegments(input);
}

function splitCommaSegments(input) {
  const parts = input.split(/\s*,\s*/).filter(Boolean);
  if (parts.length <= 1) return [input];
  if (parts.length === 2) return looksLikeInvertedSingleName(parts[0], parts[1]) ? [input] : parts;
  if (parts.length % 2 === 0) {
    const pairs = [];
    for (let i = 0; i < parts.length; i += 2) {
      if (!looksLikeInvertedSingleName(parts[i], parts[i + 1])) return parts;
      pairs.push(`${parts[i]}, ${parts[i + 1]}`);
    }
    return pairs;
  }
  return parts;
}

function looksLikeInvertedSingleName(left, right) {
  const leftWords = left.trim().split(/\s+/).filter(Boolean);
  const rightWords = right.trim().split(/\s+/).filter(Boolean);
  if (!leftWords.length || !rightWords.length) return false;
  if (ORG_SUFFIXES.test(left) || ORG_SUFFIXES.test(right)) return false;
  if (leftWords.length === 1 || rightWords.length === 1) return true;
  return leftWords.slice(0, -1).every((word) => PARTICLES.has(word.toLowerCase()));
}

function looksLikeAuthorUnit(segment) {
  const parsed = parseAuthorName(segment);
  if (!parsed) return false;
  return 'literal' in parsed || Boolean(parsed.given);
}

function parseDate(value) {
  return parseIsoDate(value) || parseFreeformDate(value) || parseNumericDate(value);
}

function parseIsoDate(value) {
  if (!value) return null;
  const m = String(value).trim().match(/^(\d{4})(?:[-/](\d{1,2})(?:[-/](\d{1,2}))?)?/);
  if (!m) return null;
  const year = parseInt(m[1], 10);
  if (!isValidYear(year)) return null;
  if (m[3]) {
    const month = parseInt(m[2], 10);
    const day = parseInt(m[3], 10);
    return isValidYmd(year, month, day) ? [year, month, day] : null;
  }
  if (m[2]) {
    const month = parseInt(m[2], 10);
    return month >= 1 && month <= 12 ? [year, month] : null;
  }
  return [year];
}

function parseFreeformDate(value) {
  if (!value) return null;
  const text = String(value).trim().replace(/\b(\d{1,2})(st|nd|rd|th)\b/gi, '$1');
  let m = text.match(/^(?:[A-Za-z]+,\s*)?([A-Za-z]+)\.?\s+(\d{1,2}),?\s+(\d{4})$/);
  if (m) {
    const month = MONTHS[m[1].toLowerCase()];
    const day = parseInt(m[2], 10);
    const year = parseInt(m[3], 10);
    return month && isValidYmd(year, month, day) ? [year, month, day] : null;
  }
  m = text.match(/^(?:[A-Za-z]+,\s*)?(\d{1,2})\s+([A-Za-z]+)\.?\s+(\d{4})/);
  if (m) {
    const month = MONTHS[m[2].toLowerCase()];
    const day = parseInt(m[1], 10);
    const year = parseInt(m[3], 10);
    return month && isValidYmd(year, month, day) ? [year, month, day] : null;
  }
  m = text.match(/^([A-Za-z]+)\.?\s+(\d{4})$/);
  if (m) {
    const month = MONTHS[m[1].toLowerCase()];
    const year = parseInt(m[2], 10);
    return month && isValidYear(year) ? [year, month] : null;
  }
  return null;
}

function parseNumericDate(value) {
  if (!value) return null;
  const m = String(value).trim().match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (!m) return null;
  const first = parseInt(m[1], 10);
  const second = parseInt(m[2], 10);
  const year = parseInt(m[3], 10);
  if (!isValidYear(year)) return null;
  if (first > 12 && second <= 12 && isValidYmd(year, second, first)) return [year, second, first];
  if (second > 12 && first <= 12 && isValidYmd(year, first, second)) return [year, first, second];
  return null;
}

function inferType(fields) {
  if (fields['container-title'] && (fields.volume || fields.issue || fields.page || fields.DOI)) {
    return 'article-journal';
  }
  return 'webpage';
}

function normalizeDoi(value) {
  if (!value) return null;
  const direct = validateDoi(String(value));
  if (direct) return direct;
  const match = String(value).match(DOI_RE);
  return match ? validateDoi(match[1]) : null;
}

function validateDoi(value) {
  let s = stripPairedWrappers(String(value || '').trim());
  s = s.replace(/[.,;:]+$/g, '');
  s = stripPairedWrappers(s);
  s = s.replace(/^https?:\/\/(dx\.)?doi\.org\//i, '');
  s = s.replace(/^doi:\s*/i, '');
  s = s.replace(/[?#].*$/, '');
  s = stripPairedWrappers(s).replace(/[.,;:]+$/g, '');
  s = stripUnmatchedTrailing(s, '(', ')');
  s = stripUnmatchedTrailing(s, '[', ']');
  s = stripUnmatchedTrailing(s, '{', '}');
  const match = s.match(DOI_EXACT_RE);
  return match ? match[1] : null;
}

function doiFromValues(...values) {
  for (const value of flattenValues(values)) {
    const doi = normalizeDoi(value);
    if (doi) return doi;
  }
  return null;
}

function flattenValues(values) {
  const out = [];
  const visit = (value) => {
    if (Array.isArray(value)) {
      for (const item of value) visit(item);
    } else if (typeof value === 'string' || typeof value === 'number') {
      const text = String(value).trim();
      if (text) out.push(text);
    } else if (value && typeof value === 'object') {
      for (const key of ['value', 'name', '@id', 'url']) visit(value[key]);
    }
  };
  values.forEach(visit);
  return out;
}

function resolveHttpUrl(value, base) {
  try {
    const resolved = new URL(value || base, base);
    return resolved.protocol === 'http:' || resolved.protocol === 'https:' ? resolved.href : base;
  } catch {
    return base || '';
  }
}

function dateFrom(date) {
  return {
    'date-parts': [[date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate()]],
  };
}

function usefulDetailCount(csl) {
  return ['title', 'author', 'issued', 'container-title', 'publisher', 'DOI', 'volume', 'issue', 'page', 'abstract']
    .filter((field) => csl[field] !== undefined && csl[field] !== '').length;
}

function detailName(author) {
  if (!author) return '';
  if ('literal' in author) return author.literal;
  return [author.given, author['non-dropping-particle'], author.family, author.suffix]
    .filter(Boolean)
    .join(' ');
}

function formatAuthors(authors) {
  if (!Array.isArray(authors) || !authors.length) return '';
  return authors.map(detailName).filter(Boolean).join(', ');
}

function formatDate(date) {
  const parts = date?.['date-parts']?.[0];
  return Array.isArray(parts) ? parts.join('-') : '';
}

function cleanTitle(value, siteName = '') {
  const title = cleanText(value);
  if (!title) return '';
  if (!TITLE_SEP.test(title)) return title;
  const parts = title.split(TITLE_SEP).map((part) => part.trim()).filter(Boolean);
  if (parts.length < 2) return title;
  const site = normalizeComparable(siteName);
  const filtered = site
    ? parts.filter((part) => normalizeComparable(part) !== site)
    : parts;
  return filtered[0] || parts[0] || title;
}

function normalizeSiteName(value) {
  const text = cleanText(value);
  if (!text) return '';
  return text.replace(/^@/, '').trim();
}

function siteFromUrl(url) {
  try {
    return new URL(url).hostname.replace(/^www\./i, '');
  } catch {
    return '';
  }
}

function dedupePublisherContainer(item) {
  if (item.publisher && item['container-title']
    && normalizeComparable(item.publisher) === normalizeComparable(item['container-title'])) {
    delete item.publisher;
  }
}

function normalizeComparable(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/^the\s+/, '')
    .replace(/[^\p{L}\p{N}]+/gu, '');
}

function cleanText(value) {
  return typeof value === 'string' || typeof value === 'number'
    ? String(value).replace(/\s+/g, ' ').trim()
    : '';
}

function firstString(...values) {
  for (const value of values) {
    const text = cleanText(value);
    if (text) return text;
  }
  return '';
}

function setText(object, key, value) {
  const text = cleanText(value);
  if (text && !object[key]) object[key] = text;
}

function pageRange(start, end) {
  const first = firstString(start);
  if (!first) return '';
  const last = firstString(end);
  return last ? `${first}-${last}` : first;
}

function toArray(value) {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

function uniqueAuthors(authors) {
  const seen = new Set();
  const out = [];
  for (const author of authors) {
    const key = JSON.stringify(author).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(author);
  }
  return out;
}

function decodeJsonLdEntities(text) {
  return String(text || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&#x([0-9a-fA-F]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)));
}

function isValidYear(year) {
  return Number.isFinite(year) && year >= 1000 && year <= 9999;
}

function isValidYmd(year, month, day) {
  if (!isValidYear(year) || month < 1 || month > 12 || day < 1 || day > 31) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

function stripPairedWrappers(value) {
  let s = value.trim();
  const pairs = [['<', '>'], ['(', ')'], ['[', ']'], ['{', '}'], ['"', '"'], ["'", "'"], ['\u201c', '\u201d'], ['\u2018', '\u2019']];
  let changed = true;
  while (changed) {
    changed = false;
    for (const [open, close] of pairs) {
      if (s.startsWith(open) && s.endsWith(close)) {
        s = s.slice(open.length, -close.length).trim();
        changed = true;
      }
    }
  }
  return s;
}

function stripUnmatchedTrailing(value, open, close) {
  let s = value;
  while (s.endsWith(close)) {
    let balance = 0;
    for (const char of s) {
      if (char === open) balance += 1;
      else if (char === close) balance -= 1;
    }
    if (balance >= 0) break;
    s = s.slice(0, -1).trim();
  }
  return s;
}
