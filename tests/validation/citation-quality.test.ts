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

  it('suggests choose-source-type for ambiguous .gov webpages', () => {
    const quality = validateCitationQuality({
      id: 'https://www.cdc.gov/diabetes/about/index.html',
      type: 'webpage',
      title: 'Diabetes Basics',
      URL: 'https://www.cdc.gov/diabetes/about/index.html',
      author: [{ literal: 'CDC' }],
      issued: { 'date-parts': [[2026, 1, 26]] },
    });
    expect(quality.warnings.map((w) => [w.code, w.action])).toContainEqual([
      'source_type_ambiguous',
      'choose-source-type',
    ]);
  });

  it('accepts pipeline typeWarnings without duplicating gov detection when already provided', () => {
    const quality = validateCitationQuality({
      id: 'https://www.cdc.gov/x',
      type: 'webpage',
      title: 'X',
      URL: 'https://www.cdc.gov/x',
      author: [{ literal: 'CDC' }],
      issued: { 'date-parts': [[2026, 1, 1]] },
    }, {
      typeWarnings: [{
        code: 'source_type_ambiguous',
        field: 'type',
        severity: 'review',
        message: 'Review source type.',
        action: 'choose-source-type',
      }],
    });
    expect(quality.warnings.filter((w) => w.code === 'source_type_ambiguous')).toHaveLength(1);
  });

  it('does not re-flag gov pages when pipeline supplied an empty typeWarnings list', () => {
    const quality = validateCitationQuality({
      id: 'https://www.cdc.gov/research/paper',
      type: 'webpage',
      title: 'Scholarly Note',
      URL: 'https://www.cdc.gov/research/paper',
      author: [{ literal: 'CDC' }],
      issued: { 'date-parts': [[2026, 1, 1]] },
    }, {
      typeWarnings: [],
    });
    expect(quality.warnings.map((w) => w.code)).not.toContain('source_type_ambiguous');
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

  it('flags an AI-filled field so the user verifies it', () => {
    const winner: FieldEvidence = {
      field: 'publisher',
      normalizedValue: 'Example Press',
      source: 'ai-extract',
      acquisition: 'ai',
      confidence: 0.82,
    };
    const provenance: Partial<Record<keyof CSLItem, FieldProvenance>> = {
      publisher: { winner, candidates: [winner], conflicts: [] },
    };
    const quality = validateCitationQuality({
      id: 'https://example.com/p',
      type: 'webpage',
      title: 'Example',
      URL: 'https://example.com/p',
      publisher: 'Example Press',
      author: [{ family: 'Doe', given: 'Jane' }],
      issued: { 'date-parts': [[2026, 1, 15]] },
    }, { provenance });

    const warning = quality.warnings.find((w) => w.code === 'publisher_ai_suggested');
    expect(warning).toBeDefined();
    expect(warning?.field).toBe('publisher');
    expect(warning?.severity).toBe('review');
  });

  it('flags a social/video URL that produced no platform metadata as an error', () => {
    const quality = validateCitationQuality({
      id: 'https://www.tiktok.com/@x/video/1',
      type: 'webpage',
      title: 'Someone on TikTok',
      URL: 'https://www.tiktok.com/@x/video/1',
    });
    const warning = quality.warnings.find((w) => w.code === 'social_unresolved');
    expect(warning).toBeDefined();
    expect(warning?.severity).toBe('error');
    expect(warning?.action).toBe('use-extension');
    expect(warning?.message).toContain('TikTok');
  });

  it('does not flag social_unresolved once platform metadata is present', () => {
    const quality = validateCitationQuality({
      id: 'https://www.tiktok.com/@x/video/1',
      type: 'webpage',
      title: 'A real caption',
      URL: 'https://www.tiktok.com/@x/video/1',
      author: [{ family: 'Cook', given: 'Phillip' }],
      issued: { 'date-parts': [[2021, 9, 17]] },
      custom: { social: { platform: 'tiktok', handle: 'x', kind: 'video' } },
    });
    expect(quality.warnings.some((w) => w.code === 'social_unresolved')).toBe(false);
  });

  it('does not flag social_unresolved for a non-social URL', () => {
    const quality = validateCitationQuality({
      id: 'https://example.com/p',
      type: 'webpage',
      title: 'Example',
      URL: 'https://example.com/p',
    });
    expect(quality.warnings.some((w) => w.code === 'social_unresolved')).toBe(false);
  });

  it('does not flag AI-suggested for a normally-extracted winner', () => {
    const winner: FieldEvidence = {
      field: 'publisher',
      normalizedValue: 'Example Press',
      source: 'jsonld',
      acquisition: 'fetch',
      confidence: 0.9,
    };
    const provenance: Partial<Record<keyof CSLItem, FieldProvenance>> = {
      publisher: { winner, candidates: [winner], conflicts: [] },
    };
    const quality = validateCitationQuality({
      id: 'https://example.com/p',
      type: 'webpage',
      title: 'Example',
      URL: 'https://example.com/p',
      publisher: 'Example Press',
      author: [{ family: 'Doe', given: 'Jane' }],
      issued: { 'date-parts': [[2026, 1, 15]] },
    }, { provenance });

    expect(quality.warnings.some((w) => w.code.endsWith('_ai_suggested'))).toBe(false);
  });
});
