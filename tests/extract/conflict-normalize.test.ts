import { describe, it, expect } from 'vitest';
import { mergeSignals, type NamedSignal } from '../../functions/lib/extract/merge';

// These tests lock in the field-aware conflict detection in mergeSignals: cosmetic
// differences (URL protocol/www/slash/tracking, date precision, name shape) must
// NOT surface as `${field}_conflict`, while genuinely different values still do.
// A higher-confidence "winner" plus a lower-confidence "candidate" are supplied so
// the winner is deterministic and the candidate is what conflict detection judges.

function merge(field: string, winnerValue: unknown, candidateValue: unknown) {
  const winner: NamedSignal = {
    name: 'jsonld',
    fields: { [field]: winnerValue } as any,
    confidence: { [field]: 0.95 } as any,
  };
  const candidate: NamedSignal = {
    name: 'heuristic',
    fields: { [field]: candidateValue } as any,
    confidence: { [field]: 0.4 } as any,
  };
  const result = mergeSignals([winner, candidate]);
  return result;
}

describe('mergeSignals field-aware conflict detection', () => {
  describe('URL', () => {
    it('does not flag URLs differing only by protocol, www, trailing slash, or tracking params', () => {
      const { csl, provenance } = merge(
        'URL',
        'https://www.example.com/article/',
        'http://example.com/article?utm_source=news&fbclid=abc&gclid=xyz&ref=home&mc_cid=1',
      );
      expect(provenance.URL?.conflicts).toHaveLength(0);
      // Winner value must be untouched by conflict normalization.
      expect(csl.URL).toBe('https://www.example.com/article/');
    });

    it('still flags URLs that point at genuinely different pages', () => {
      const { provenance } = merge(
        'URL',
        'https://example.com/article',
        'https://example.com/other-article',
      );
      expect(provenance.URL?.conflicts).toHaveLength(1);
    });

    it('keeps non-tracking query params significant', () => {
      const { provenance } = merge(
        'URL',
        'https://example.com/search?q=cats',
        'https://example.com/search?q=dogs',
      );
      expect(provenance.URL?.conflicts).toHaveLength(1);
    });
  });

  describe('issued (date precision)', () => {
    it('does not flag a year-only date against a full date that agrees on the year', () => {
      const { csl, provenance } = merge(
        'issued',
        { 'date-parts': [[2024, 3, 15]] },
        { 'date-parts': [[2024]] },
      );
      expect(provenance.issued?.conflicts).toHaveLength(0);
      expect(csl.issued).toEqual({ 'date-parts': [[2024, 3, 15]] });
    });

    it('flags dates that disagree on a shared part (same month, different day)', () => {
      const { provenance } = merge(
        'issued',
        { 'date-parts': [[2024, 1, 2]] },
        { 'date-parts': [[2024, 1, 26]] },
      );
      expect(provenance.issued?.conflicts).toHaveLength(1);
    });

    it('flags dates that disagree on the year', () => {
      const { provenance } = merge(
        'issued',
        { 'date-parts': [[2024]] },
        { 'date-parts': [[2023]] },
      );
      expect(provenance.issued?.conflicts).toHaveLength(1);
    });
  });

  describe('author / editor (name shape)', () => {
    it('does not flag the same person expressed as a literal vs family/given', () => {
      const { csl, provenance } = merge(
        'author',
        [{ family: 'Roe', given: 'Jane' }],
        [{ literal: 'Jane Roe' }],
      );
      expect(provenance.author?.conflicts).toHaveLength(0);
      expect(csl.author).toEqual([{ family: 'Roe', given: 'Jane' }]);
    });

    it('treats a "Family, Given" literal as the same person', () => {
      const { provenance } = merge(
        'author',
        [{ family: 'Roe', given: 'Jane' }],
        [{ literal: 'Roe, Jane' }],
      );
      expect(provenance.author?.conflicts).toHaveLength(0);
    });

    it('ignores order and duplicate entries (same set of people)', () => {
      const winner = [{ family: 'Smith', given: 'John' }, { family: 'Doe', given: 'Jane' }];
      // Same two people, reversed and with a duplicate — mirrors the citation_author
      // + DC.creator double-listing seen on real journal pages.
      const candidate = [
        { family: 'Doe', given: 'Jane' },
        { family: 'Smith', given: 'John' },
        { family: 'Doe', given: 'Jane' },
      ];
      const { provenance } = merge('author', winner, candidate);
      expect(provenance.author?.conflicts).toHaveLength(0);
    });

    it('is case-insensitive (structured vs upper-case byline)', () => {
      const { provenance } = merge(
        'author',
        [{ family: 'Rush', given: 'Claire' }, { family: 'Boone', given: 'Rebecca' }],
        [{ family: 'RUSH', given: 'CLAIRE' }, { family: 'BOONE', given: 'REBECCA' }],
      );
      expect(provenance.author?.conflicts).toHaveLength(0);
    });

    it('flags a genuinely different set of authors', () => {
      const { provenance } = merge(
        'author',
        [{ family: 'Roe', given: 'Jane' }],
        [{ family: 'Smith', given: 'John' }],
      );
      expect(provenance.author?.conflicts).toHaveLength(1);
    });

    it('flags when one side lists an extra author', () => {
      const { provenance } = merge(
        'author',
        [{ family: 'Roe', given: 'Jane' }],
        [{ family: 'Roe', given: 'Jane' }, { family: 'Smith', given: 'John' }],
      );
      expect(provenance.author?.conflicts).toHaveLength(1);
    });
  });

  describe('unrelated fields fall back to strict comparison', () => {
    it('still flags conflicting publisher values', () => {
      const { provenance } = merge('publisher', 'Example University Press', 'Different Press');
      expect(provenance.publisher?.conflicts).toHaveLength(1);
    });

    it('does not flag identical publisher values', () => {
      const { provenance } = merge('publisher', 'Example University Press', 'Example University Press');
      expect(provenance.publisher?.conflicts).toHaveLength(0);
    });
  });
});
