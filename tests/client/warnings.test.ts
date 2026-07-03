import { describe, it, expect } from 'vitest';
import {
  isDismissibleCitationWarning,
  isCitationWarningDismissed,
  visibleCitationWarnings,
  warningDismissalKey,
} from '../../src/lib/references/warnings';
import type { CitationQualityWarning } from '../../src/lib/citations/csl-types';

const w = (over: Partial<CitationQualityWarning>): CitationQualityWarning => ({
  code: 'title_ai_suggested',
  field: 'title',
  severity: 'review',
  message: 'This value was suggested by AI.',
  action: 'review-field',
  ...over,
});

describe('citation warning dismissal', () => {
  it('allows dismissing an AI-suggested warning ("I verified this")', () => {
    expect(isDismissibleCitationWarning(w({}))).toBe(true);
  });

  it('still allows dismissing conflicts but never hard errors / missing fields', () => {
    expect(isDismissibleCitationWarning(w({ code: 'issued_conflict' }))).toBe(true);
    expect(isDismissibleCitationWarning(w({ code: 'title_missing', severity: 'error' }))).toBe(false);
    expect(isDismissibleCitationWarning(w({ code: 'author_not_found' }))).toBe(false);
  });

  it('hides an AI-suggested warning once dismissed by its key', () => {
    const warning = w({ field: 'publisher', code: 'publisher_ai_suggested' });
    const key = warningDismissalKey(warning);
    expect(key).toBe('publisher:publisher_ai_suggested');
    expect(isCitationWarningDismissed(warning, [key])).toBe(true);
    expect(visibleCitationWarnings([warning], [key])).toEqual([]);
    expect(visibleCitationWarnings([warning], [])).toHaveLength(1);
  });
});
