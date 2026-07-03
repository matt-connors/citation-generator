export const API_ORIGIN = 'https://mlagenerator.com';
export const INLINE_CSL_PARAM = 'csl';
export const REFERENCES_STORAGE_KEY = 'sources_v2';
export const HISTORY_STORAGE_KEY = 'citationHistory';
export const TAB_STATE_STORAGE_KEY = 'tabCitationState';
export const MAX_HISTORY_ITEMS = 8;

export const CITATION_STYLES = [
  { label: 'MLA 9th edition', value: 'mla-9', default: true },
  { label: 'APA 7th edition', value: 'apa-7' },
  { label: 'Chicago 18th edition', value: 'chicago-18' },
  { label: 'AMA 11th edition', value: 'ama-11' },
  { label: 'Harvard', value: 'harvard' },
  { label: 'IEEE', value: 'ieee' },
  { label: 'Vancouver', value: 'vancouver' },
].sort((a, b) => a.label.localeCompare(b.label));

export const DEFAULT_STYLE = 'mla-9';

export function isSupportedStyle(value) {
  return CITATION_STYLES.some((style) => style.value === value);
}

export function isCiteableUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function tabHost(value) {
  try {
    return new URL(value).hostname.replace(/^www\./i, '');
  } catch {
    return '';
  }
}

export function buildFormatApiUrl() {
  return new URL('/api/format', API_ORIGIN).href;
}

export function buildReferencesUrl(style) {
  const url = new URL('/my-references/', API_ORIGIN);
  url.searchParams.set('citationStyle', isSupportedStyle(style) ? style : DEFAULT_STYLE);
  return url.href;
}

export function buildEditOnSiteUrl(pageUrl, style, csl) {
  const url = new URL(buildReferencesUrl(style));
  if (csl) url.searchParams.set(INLINE_CSL_PARAM, encodeInlineCslSource({
    uuid: csl.id || pageUrl,
    csl: cslForInlineHandoff(csl),
  }));
  else url.searchParams.set('website', pageUrl);
  return url.href;
}

export function cslForInlineHandoff(csl) {
  const rest = { ...(csl || {}) };
  delete rest.abstract;
  return rest;
}

export function encodeInlineCslSource(source) {
  const json = JSON.stringify(source);
  const bytes = new TextEncoder().encode(json);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function sourceFromCsl(csl, pageUrl) {
  const normalized = cslForInlineHandoff(csl || {});
  const uuid = normalized.id || normalized.URL || pageUrl;
  return {
    uuid,
    csl: {
      ...normalized,
      id: normalized.id || uuid,
      URL: normalized.URL || pageUrl,
    },
  };
}

export function mergeStoredSources(existing, source) {
  const list = Array.isArray(existing) ? existing : [];
  const sourceId = source?.uuid || source?.csl?.id;
  if (!sourceId || !source?.csl) return list;
  const next = list.filter((item) => item?.uuid !== sourceId && item?.csl?.id !== sourceId);
  next.push(source);
  return next;
}

export function historyEntryFromCitation(csl, style, plain, now = new Date()) {
  const source = sourceFromCsl(csl, csl?.URL || csl?.id || '');
  return {
    id: source.uuid,
    title: source.csl.title || source.csl.URL || source.uuid,
    url: source.csl.URL || source.uuid,
    style: isSupportedStyle(style) ? style : DEFAULT_STYLE,
    plain: plain || '',
    csl: source.csl,
    createdAt: now.toISOString(),
  };
}

export function mergeHistoryEntries(existing, entry, limit = MAX_HISTORY_ITEMS) {
  const list = Array.isArray(existing) ? existing : [];
  if (!entry?.id || !entry?.csl) return list.slice(0, limit);
  return [
    entry,
    ...list.filter((item) => item?.id !== entry.id),
  ].slice(0, limit);
}

export function tabStateKey(tabId, url) {
  return `${tabId || 'active'}:${url || ''}`;
}

export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => {
    if (char === '&') return '&amp;';
    if (char === '<') return '&lt;';
    if (char === '>') return '&gt;';
    if (char === '"') return '&quot;';
    return '&#39;';
  });
}

export function richTextToHtml(segments) {
  return (segments || [])
    .map((segment) => segment?.italic
      ? `<i>${escapeHtml(segment.text || '')}</i>`
      : escapeHtml(segment?.text || ''))
    .join('');
}

export function richTextToPlain(segments) {
  return (segments || []).map((segment) => segment?.text || '').join('');
}

export function displayTitle(tab) {
  const title = (tab?.title || '').trim();
  if (title) return title;
  return tab?.url || 'Current page';
}

export function errorMessage(error) {
  const message = error instanceof Error ? error.message : String(error || '');
  if (/aborted|timeout/i.test(message)) return 'The request timed out.';
  if (/failed to fetch|network/i.test(message)) return 'The citation service could not be reached.';
  return message || 'Citation failed.';
}
