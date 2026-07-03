import { describe, it, expect } from 'vitest';
import { mergeSignals } from '../../functions/lib/extract/merge';

describe('mergeSignals provenance', () => {
  it('records winner, candidates, and conflicts for each field', () => {
    const result = mergeSignals([
      {
        name: 'heuristic',
        fields: { title: 'Heuristic Title' },
        confidence: { title: 0.4 },
      },
      {
        name: 'jsonld',
        fields: { title: 'Structured Title' },
        confidence: { title: 0.95 },
      },
    ], { acquisition: 'fetch', acquiredAt: '2026-06-30T00:00:00.000Z' });

    expect(result.csl.title).toBe('Structured Title');
    expect(result.signals.title).toBe('jsonld');
    expect(result.provenance.title?.winner?.source).toBe('jsonld');
    expect(result.provenance.title?.winner?.acquisition).toBe('fetch');
    expect(result.provenance.title?.candidates).toHaveLength(2);
    expect(result.provenance.title?.conflicts).toHaveLength(1);
  });
});
