import { describe, it, expect } from 'vitest';
import { validateCitationQuality } from '../../functions/lib/validation/citation-quality';
import type { CSLItem, FieldEvidence, FieldProvenance } from '../../functions/lib/csl-types';

describe('validateCitationQuality', () => {
  it('treats missing author and date as review warnings, not hard errors', () => {
    const csl: CSLItem = {
      id: 'https://example.com/p',
      type: 'webpage',
      title: 'Example',
      URL: 'https://example.com/p',
    };
    const quality = validateCitationQuality(csl);
    expect(quality.warnings.map((w) => [w.code, w.severity])).toContainEqual(['author_not_found', 'review']);
    expect(quality.warnings.map((w) => [w.code, w.severity])).toContainEqual(['date_not_found', 'review']);
    expect(quality.warnings.some((w) => w.severity === 'error')).toBe(false);
  });

  it('does not count blank author entries as a present author', () => {
    const quality = validateCitationQuality({
      id: 'https://example.com/p',
      type: 'webpage',
      title: 'Example',
      URL: 'https://example.com/p',
      author: [{ literal: '   ' }, { family: '', given: ' ' }],
      issued: { 'date-parts': [[2026, 6, 30]] },
    });

    expect(quality.warnings.map((w) => w.code)).toContain('author_not_found');
  });

  it('flags conflicting evidence without overwriting the winner', () => {
    const winner: FieldEvidence = {
      field: 'issued',
      normalizedValue: { 'date-parts': [[2026, 1, 15]] },
      source: 'jsonld',
      acquisition: 'fetch',
      confidence: 0.95,
    };
    const conflict: FieldEvidence = {
      field: 'issued',
      normalizedValue: { 'date-parts': [[2026, 1, 16]] },
      source: 'opengraph',
      acquisition: 'fetch',
      confidence: 0.75,
    };
    const provenance: Partial<Record<keyof CSLItem, FieldProvenance>> = {
      issued: { winner, candidates: [winner, conflict], conflicts: [conflict] },
    };
    const quality = validateCitationQuality({
      id: 'https://example.com/p',
      type: 'webpage',
      title: 'Example',
      URL: 'https://example.com/p',
      issued: { 'date-parts': [[2026, 1, 15]] },
      author: [{ family: 'Doe', given: 'Jane' }],
    }, { provenance });

    expect(quality.warnings.some((w) => w.code === 'issued_conflict')).toBe(true);
  });
});
