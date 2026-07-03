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
  const doi = validateDoi(work.doi) || validateDoi(work.primary_location?.id) || '';
  const csl: CSLItem = {
    id: doi,
    type: 'article-journal',
  };
  if (work.title || work.display_name) csl.title = work.title || work.display_name;
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
  const containerTitle =
    work.host_venue?.display_name ||
    work.primary_location?.source?.display_name ||
    work.primary_location?.raw_source_name ||
    undefined;
  if (containerTitle) csl['container-title'] = containerTitle;
  if (work.publication_date) {
    const dp = parseIsoDate(work.publication_date);
    if (dp) csl.issued = { 'date-parts': [dp] };
  } else if (work.publication_year) {
    csl.issued = { 'date-parts': [[work.publication_year]] };
  }
  if (doi) csl.DOI = doi;
  const volume = work.volume || work.biblio?.volume || undefined;
  const issue = work.issue || work.biblio?.issue || undefined;
  const firstPage = work.first_page || work.biblio?.first_page || undefined;
  const lastPage = work.last_page || work.biblio?.last_page || undefined;
  if (volume) csl.volume = volume;
  if (issue) csl.issue = issue;
  if (firstPage) csl.page = lastPage ? `${firstPage}-${lastPage}` : firstPage;
  return csl;
}
