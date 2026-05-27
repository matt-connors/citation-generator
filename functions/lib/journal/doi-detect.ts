import type { CheerioAPI } from 'cheerio';

const DOI_RE = /\b(10\.\d{4,9}\/[-._;()/:A-Z0-9]+)/i;

export function validateDoi(input: string | null | undefined): string | null {
  if (!input) return null;
  let s = String(input).trim();
  s = s.replace(/^https?:\/\/(dx\.)?doi\.org\//i, '');
  s = s.replace(/^doi:\s*/i, '');
  const m = s.match(/^(10\.\d{4,9}\/[-._;()/:A-Z0-9]+)$/i);
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
