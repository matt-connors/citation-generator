import { describe, it, expect } from 'vitest';
import type { CSLItem, CSLName, CSLDate, RichText, ExtractEnvelope, FormatRequest } from '../functions/lib/csl-types';

describe('csl-types', () => {
  it('allows a structured author name', () => {
    const n: CSLName = { family: 'Smith', given: 'John' };
    expect(n.family).toBe('Smith');
  });

  it('allows a literal (corporate) author', () => {
    const n: CSLName = { literal: 'Wikimedia Foundation' };
    expect('literal' in n).toBe(true);
  });

  it('encodes a y/m/d date in CSL date-parts shape', () => {
    const d: CSLDate = { 'date-parts': [[2026, 5, 26]] };
    expect(d['date-parts'][0][0]).toBe(2026);
  });

  it('encodes a webpage CSL item', () => {
    const item: CSLItem = {
      id: 'abc',
      type: 'webpage',
      title: 't',
      author: [{ family: 'A' }],
      issued: { 'date-parts': [[2026]] },
      URL: 'https://x',
    };
    expect(item.type).toBe('webpage');
  });

  it('envelopes a server response', () => {
    const env: ExtractEnvelope = {
      uuid: 'u',
      type: 'webpage',
      csl: { id: 'u', type: 'webpage' },
    };
    expect(env.type).toBe('webpage');
  });

  it('models a format request', () => {
    const req: FormatRequest = { csl: { id: 'u', type: 'webpage' }, style: 'mla-9' };
    expect(req.style).toBe('mla-9');
  });
});
