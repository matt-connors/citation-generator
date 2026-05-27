import { describe, it, expect } from 'vitest';
import { normalizeOpenLibrary, normalizeGoogleBooks } from '../../functions/lib/book/normalize';

describe('normalizeOpenLibrary', () => {
  it('maps title, authors, publisher, year, place', () => {
    const csl = normalizeOpenLibrary({
      title: 'Republic',
      authors: [{ name: 'Plato' }, { name: 'G. M. A. Grube' }],
      publishers: [{ name: 'Hackett' }],
      publish_date: '1992',
      publish_places: [{ name: 'Indianapolis' }],
    }, '9780140449136');
    expect(csl.id).toBe('9780140449136');
    expect(csl.type).toBe('book');
    expect(csl.title).toBe('Republic');
    expect(csl.author).toEqual([{ family: 'Plato' }, { family: 'Grube', given: 'G. M. A.' }]);
    expect(csl.publisher).toBe('Hackett');
    expect(csl.issued).toEqual({ 'date-parts': [[1992]] });
    expect(csl['publisher-place']).toBe('Indianapolis');
    expect(csl.ISBN).toBe('9780140449136');
  });

  it('handles missing optional fields', () => {
    const csl = normalizeOpenLibrary({ title: 'X' }, '111');
    expect(csl.title).toBe('X');
    expect(csl.author).toBeUndefined();
    expect(csl.publisher).toBeUndefined();
  });
});

describe('normalizeGoogleBooks', () => {
  it('maps title, authors (string array), publisher, date', () => {
    const csl = normalizeGoogleBooks({
      title: 'A Brief History of Time',
      authors: ['Stephen Hawking'],
      publisher: 'Bantam',
      publishedDate: '1998-09-01',
    }, '9780553418811');
    expect(csl.title).toBe('A Brief History of Time');
    expect(csl.author).toEqual([{ family: 'Hawking', given: 'Stephen' }]);
    expect(csl.publisher).toBe('Bantam');
    expect(csl.issued).toEqual({ 'date-parts': [[1998, 9, 1]] });
    expect(csl.ISBN).toBe('9780553418811');
  });

  it('merges title + subtitle with ": "', () => {
    const csl = normalizeGoogleBooks({
      title: 'A Walk in the Woods',
      subtitle: 'Rediscovering America on the Appalachian Trail',
      authors: ['Bill Bryson'],
    }, '9781400079988');
    expect(csl.title).toBe('A Walk in the Woods: Rediscovering America on the Appalachian Trail');
  });
});
