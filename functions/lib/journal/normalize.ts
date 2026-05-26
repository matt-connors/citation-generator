import type { CSLItem, CSLName } from '../csl-types';
import { parseAuthorName } from '../extract/author-parse';
import { parseIsoDate } from '../extract/date-parse';
import { validateDoi } from './doi-detect';
import type { CrossrefWork } from './crossref';
import type { OpenAlexWork } from './openalex';

export function normalizeCrossref(work: CrossrefWork): CSLItem {
  const csl: CSLItem = {
    id: work.DOI || '',
    type: 'article-journal',
  };
  if (work.title?.length) csl.title = work.title[0];
  if (work.author?.length) {
    const a: CSLName[] = [];
    for (const author of work.author) {
      if (author.literal) a.push({ literal: author.literal });
      else if (author.family) a.push({ family: author.family, ...(author.given ? { given: author.given } : {}) });
      else if (author.name) {
        const parsed = parseAuthorName(author.name);
        if (parsed) a.push(parsed);
      }
    }
    if (a.length) csl.author = a;
  }
  if (work['container-title']?.length) csl['container-title'] = work['container-title'][0];
  if (work.issued?.['date-parts']?.[0]) csl.issued = { 'date-parts': [work.issued['date-parts'][0]] };
  if (work.volume) csl.volume = work.volume;
  if (work.issue) csl.issue = work.issue;
  if (work.page) csl.page = work.page;
  if (work.DOI) csl.DOI = work.DOI;
  return csl;
}

export function normalizeOpenAlex(work: OpenAlexWork): CSLItem {
  const doi = validateDoi(work.doi) || '';
  const csl: CSLItem = {
    id: doi,
    type: 'article-journal',
  };
  if (work.title) csl.title = work.title;
  if (work.authorships?.length) {
    const a: CSLName[] = [];
    for (const aa of work.authorships) {
      const name = aa.author?.display_name;
      if (!name) continue;
      const parsed = parseAuthorName(name);
      if (parsed) a.push(parsed);
    }
    if (a.length) csl.author = a;
  }
  if (work.host_venue?.display_name) csl['container-title'] = work.host_venue.display_name;
  if (work.publication_date) {
    const dp = parseIsoDate(work.publication_date);
    if (dp) csl.issued = { 'date-parts': [dp] };
  }
  if (doi) csl.DOI = doi;
  if (work.volume) csl.volume = work.volume;
  if (work.issue) csl.issue = work.issue;
  if (work.first_page) csl.page = work.last_page ? `${work.first_page}-${work.last_page}` : work.first_page;
  return csl;
}
