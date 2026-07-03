import { describe, expect, it } from 'vitest';

const extractor = await import('../../chrome-extension/page-extractor.mjs');

describe('chrome extension page extractor', () => {
  it('extracts rich citation details from citation meta and JSON-LD snapshots', () => {
    const snapshot = {
      url: 'https://journals.example.org/article?utm_source=x',
      title: 'Fallback page title',
      h1: 'Fallback H1',
      canonicalUrl: 'https://journals.example.org/article',
      meta: [
        { name: 'citation_title', content: 'Accurate Web Citation Extraction' },
        { name: 'citation_author', content: 'Ada Lovelace' },
        { name: 'citation_author', content: 'Hopper, Grace' },
        { name: 'citation_publication_date', content: '2026-05-14' },
        { name: 'citation_journal_title', content: 'Journal of Metadata' },
        { name: 'citation_volume', content: '12' },
        { name: 'citation_issue', content: '3' },
        { name: 'citation_pages', content: '44-51' },
        { name: 'citation_doi', content: 'https://doi.org/10.1234/example.2026.5' },
      ],
      jsonld: [
        JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'ScholarlyArticle',
          publisher: { '@type': 'Organization', name: 'Metadata Press' },
          abstract: 'A test abstract.',
        }),
      ],
      bylineCandidates: [],
      timeCandidates: [],
    };

    const { csl, detailCount } = extractor.citationFromSnapshot(snapshot, new Date('2026-06-27T12:00:00Z'));
    expect(csl).toMatchObject({
      id: 'https://journals.example.org/article',
      type: 'article-journal',
      URL: 'https://journals.example.org/article',
      title: 'Accurate Web Citation Extraction',
      'container-title': 'Journal of Metadata',
      publisher: 'Metadata Press',
      volume: '12',
      issue: '3',
      page: '44-51',
      DOI: '10.1234/example.2026.5',
      accessed: { 'date-parts': [[2026, 6, 27]] },
    });
    expect(csl.author).toEqual([
      { family: 'Lovelace', given: 'Ada' },
      { family: 'Hopper', given: 'Grace' },
    ]);
    expect(csl.issued).toEqual({ 'date-parts': [[2026, 5, 14]] });
    expect(detailCount).toBeGreaterThanOrEqual(9);
  });

  it('uses active-page fallbacks when structured metadata is sparse', () => {
    const snapshot = {
      url: 'https://www.example.com/story',
      title: 'Story headline - Example News',
      h1: 'Story headline',
      canonicalUrl: '',
      meta: [
        { property: 'og:site_name', content: 'Example News' },
      ],
      jsonld: [],
      bylineCandidates: ['By Jane Doe'],
      timeCandidates: ['June 2, 2026'],
    };

    const { csl } = extractor.citationFromSnapshot(snapshot, new Date('2026-06-27T12:00:00Z'));
    expect(csl).toMatchObject({
      id: 'https://www.example.com/story',
      type: 'webpage',
      URL: 'https://www.example.com/story',
      title: 'Story headline',
      'container-title': 'Example News',
      issued: { 'date-parts': [[2026, 6, 2]] },
    });
    expect(csl.author).toEqual([{ family: 'Doe', given: 'Jane' }]);
  });

  it('formats captured detail rows for the popup without empty fields', () => {
    const rows = extractor.detailRows({
      title: 'A Title',
      author: [{ family: 'Smith', given: 'Pat' }, { literal: 'CDC' }],
      issued: { 'date-parts': [[2026, 1]] },
      DOI: '',
    });

    expect(rows).toEqual([
      { label: 'Title', value: 'A Title' },
      { label: 'Author', value: 'Pat Smith, CDC' },
      { label: 'Date', value: '2026-1' },
    ]);
  });
});
