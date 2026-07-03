import { describe, expect, it } from 'vitest';
import { filterPublishedGuides, isPublishedDate, utcDay } from '../../src/lib/publication';

describe('isPublishedDate', () => {
  it('publishes dates before or on the current day', () => {
    expect(isPublishedDate('2026-07-13', '2026-07-13T00:01:00Z')).toBe(true);
    expect(isPublishedDate('2026-07-12', '2026-07-13T00:01:00Z')).toBe(true);
  });

  it('hides future publication dates', () => {
    expect(isPublishedDate('2026-07-14', '2026-07-13T23:59:59Z')).toBe(false);
  });

  it('normalizes date-only strings and Date objects to the same UTC day', () => {
    expect(utcDay('2026-07-13')).toBe(utcDay(new Date('2026-07-13T18:30:00Z')));
  });
});

describe('filterPublishedGuides', () => {
  it('keeps only guides whose pubDate is due', () => {
    const entries = [
      { slug: 'published', data: { pubDate: new Date('2026-07-01T00:00:00Z') } },
      { slug: 'today', data: { pubDate: new Date('2026-07-13T00:00:00Z') } },
      { slug: 'future', data: { pubDate: new Date('2026-07-27T00:00:00Z') } },
    ];

    expect(filterPublishedGuides(entries, '2026-07-13').map((entry) => entry.slug))
      .toEqual(['published', 'today']);
  });
});
