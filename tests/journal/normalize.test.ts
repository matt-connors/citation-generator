import { describe, it, expect } from 'vitest';
import { normalizeCrossref, normalizeOpenAlex } from '../../functions/lib/journal/normalize';

describe('normalizeCrossref', () => {
  it('maps title, authors, container, year, volume, issue, page, DOI', () => {
    const csl = normalizeCrossref({
      title: ['The Title'],
      author: [
        { family: 'Doe', given: 'Jane' },
        { family: 'Smith', given: 'John' },
      ],
      'container-title': ['Nature'],
      issued: { 'date-parts': [[2021, 8, 4]] },
      volume: '596',
      issue: '7871',
      page: '583-589',
      DOI: '10.1038/s41586-021-03828-1',
    } as any);
    expect(csl.type).toBe('article-journal');
    expect(csl.title).toBe('The Title');
    expect(csl.author).toEqual([{ family: 'Doe', given: 'Jane' }, { family: 'Smith', given: 'John' }]);
    expect(csl['container-title']).toBe('Nature');
    expect(csl.issued).toEqual({ 'date-parts': [[2021, 8, 4]] });
    expect(csl.volume).toBe('596');
    expect(csl.issue).toBe('7871');
    expect(csl.page).toBe('583-589');
    expect(csl.DOI).toBe('10.1038/s41586-021-03828-1');
  });
});

describe('normalizeOpenAlex', () => {
  it('maps title, authorships, host venue, publication_date, DOI', () => {
    const csl = normalizeOpenAlex({
      title: 'A Work',
      authorships: [
        { author: { display_name: 'Jane Doe' } },
        { author: { display_name: 'John Smith' } },
      ],
      host_venue: { display_name: 'Nature' },
      publication_date: '2021-08-04',
      doi: 'https://doi.org/10.1038/s41586-021-03828-1',
      volume: '596',
      issue: '7871',
      first_page: '583',
      last_page: '589',
    } as any);
    expect(csl.title).toBe('A Work');
    expect(csl.author).toEqual([
      { family: 'Doe', given: 'Jane' },
      { family: 'Smith', given: 'John' },
    ]);
    expect(csl['container-title']).toBe('Nature');
    expect(csl.issued).toEqual({ 'date-parts': [[2021, 8, 4]] });
    expect(csl.DOI).toBe('10.1038/s41586-021-03828-1');
    expect(csl.volume).toBe('596');
    expect(csl.page).toBe('583-589');
  });

  it('maps current OpenAlex primary_location and biblio fields', () => {
    const csl = normalizeOpenAlex({
      display_name: 'Highly accurate protein structure prediction for the human proteome',
      authorships: [
        { author: { display_name: 'Kathryn Tunyasuvunakool' } },
      ],
      primary_location: {
        id: 'doi:10.1038/s41586-021-03828-1',
        source: { display_name: 'Nature' },
        raw_source_name: 'Nature',
      },
      publication_date: '2021-07-22',
      biblio: {
        volume: '596',
        issue: '7873',
        first_page: '590',
        last_page: '596',
      },
    } as any);

    expect(csl.title).toBe('Highly accurate protein structure prediction for the human proteome');
    expect(csl.author).toEqual([{ family: 'Tunyasuvunakool', given: 'Kathryn' }]);
    expect(csl['container-title']).toBe('Nature');
    expect(csl.issued).toEqual({ 'date-parts': [[2021, 7, 22]] });
    expect(csl.DOI).toBe('10.1038/s41586-021-03828-1');
    expect(csl.volume).toBe('596');
    expect(csl.issue).toBe('7873');
    expect(csl.page).toBe('590-596');
  });
});
