import { describe, it, expect } from 'vitest';
import { isTestRequest } from '../functions/lib/test-context';

describe('isTestRequest', () => {
  it('returns true on X-Mla-Test: 1 header', () => {
    const r = new Request('https://m.com/api/cite-website?url=https://x.com', {
      headers: { 'x-mla-test': '1' },
    });
    expect(isTestRequest(r)).toBe(true);
  });

  it('header is case-insensitive (Fetch API normalizes header names)', () => {
    const r = new Request('https://m.com/api/format', {
      method: 'POST',
      headers: { 'X-MLA-Test': '1', 'content-type': 'application/json' },
      body: '{}',
    });
    expect(isTestRequest(r)).toBe(true);
  });

  it('returns true on ?nocache=1 query param', () => {
    const r = new Request('https://m.com/api/cite-website?url=https://x.com&nocache=1');
    expect(isTestRequest(r)).toBe(true);
  });

  it('returns false on a normal request', () => {
    const r = new Request('https://m.com/api/cite-website?url=https://x.com');
    expect(isTestRequest(r)).toBe(false);
  });

  it('returns false on X-Mla-Test set to a value other than "1"', () => {
    const r = new Request('https://m.com/api/cite-website?url=https://x.com', {
      headers: { 'x-mla-test': 'true' },
    });
    expect(isTestRequest(r)).toBe(false);
  });

  it('returns false on nocache=0', () => {
    const r = new Request('https://m.com/api/cite-website?url=https://x.com&nocache=0');
    expect(isTestRequest(r)).toBe(false);
  });

  it('header takes priority over query (either signal sufficient)', () => {
    const r = new Request('https://m.com/api/cite-website?url=https://x.com', {
      headers: { 'x-mla-test': '1' },
    });
    expect(isTestRequest(r)).toBe(true);
  });
});
