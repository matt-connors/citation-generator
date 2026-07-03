import type { CheerioAPI } from 'cheerio';

const DOI_RE = /\b(10\.\d{4,9}\/[^\s"'#?]+)/i;
const DOI_EXACT_RE = /^(10\.\d{4,9}\/[^\s"'#?]+)$/i;

function stripPairedWrappers(value: string): string {
  let s = value.trim();
  const pairs: Array<[string, string]> = [
    ['<', '>'],
    ['(', ')'],
    ['[', ']'],
    ['{', '}'],
    ['"', '"'],
    ["'", "'"],
    ['“', '”'],
    ['‘', '’'],
  ];
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

function stripUnmatchedTrailing(value: string, open: string, close: string): string {
  let s = value;
  while (s.endsWith(close)) {
    let balance = 0;
    for (const ch of s) {
      if (ch === open) balance += 1;
      else if (ch === close) balance -= 1;
    }
    if (balance >= 0) break;
    s = s.slice(0, -1).trim();
  }
  return s;
}

function normalizeDoiCandidate(input: string): string {
  let s = stripPairedWrappers(input);
  s = s.replace(/[.,;:]+$/g, '');
  s = stripPairedWrappers(s);
  s = s.replace(/^https?:\/\/(dx\.)?doi\.org\//i, '');
  s = s.replace(/^doi:\s*/i, '');
  s = s.replace(/[?#].*$/, '');
  s = stripPairedWrappers(s);
  s = s.replace(/[.,;:]+$/g, '');
  s = stripUnmatchedTrailing(s, '(', ')');
  s = stripUnmatchedTrailing(s, '[', ']');
  s = stripUnmatchedTrailing(s, '{', '}');
  return s;
}

export function validateDoi(input: string | null | undefined): string | null {
  if (!input) return null;
  const s = normalizeDoiCandidate(String(input));
  const m = s.match(DOI_EXACT_RE);
  return m ? m[1] : null;
}

export function extractDoi($: CheerioAPI): string | null {
  const metaCandidates = ['citation_doi', 'dc.identifier', 'DC.identifier', 'prism.doi'];
  for (const name of metaCandidates) {
    const v = $(`meta[name="${name}" i]`).attr('content');
    const doi = validateDoi(v);
    if (doi) return doi;
  }
  const text = $('body').text();
  const m = text.match(DOI_RE);
  if (m) return validateDoi(m[1]);
  return null;
}
