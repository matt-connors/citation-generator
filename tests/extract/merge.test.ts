import { describe, it, expect } from 'vitest';
import { mergeSignals } from '../../functions/lib/extract/merge';

describe('mergeSignals', () => {
  it('picks the highest-confidence value per field', () => {
    const a = { name: 'meta', fields: { title: 'A' }, confidence: { title: 0.55 } };
    const b = { name: 'jsonld', fields: { title: 'B' }, confidence: { title: 0.95 } };
    const c = { name: 'og', fields: { title: 'C' }, confidence: { title: 0.75 } };
    const { csl, signals } = mergeSignals([a, b, c]);
    expect(csl.title).toBe('B');
    expect(signals.title).toBe('jsonld');
  });

  it('falls back to lower-confidence signal when higher is absent', () => {
    const a = { name: 'meta', fields: { publisher: 'M' }, confidence: { publisher: 0.55 } };
    const b = { name: 'jsonld', fields: { title: 'B' }, confidence: { title: 0.95 } };
    const { csl } = mergeSignals([a, b]);
    expect(csl.publisher).toBe('M');
    expect(csl.title).toBe('B');
  });

  it('records winning-signal name per field for debug', () => {
    const a = { name: 'og', fields: { title: 't', URL: 'u' }, confidence: { title: 0.75, URL: 0.75 } };
    const { signals } = mergeSignals([a]);
    expect(signals).toEqual({ title: 'og', URL: 'og' });
  });

  it('returns empty fields and empty signals when no input has confidence', () => {
    const { csl, signals } = mergeSignals([]);
    expect(csl).toEqual({});
    expect(signals).toEqual({});
  });
});
