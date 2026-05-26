import { describe, it, expect } from 'vitest';
import { normalizeUrl } from '../../functions/lib/extract/url-normalize';

describe('normalizeUrl', () => {
  it('lowercases scheme and host', () => {
    expect(normalizeUrl('HTTPS://Example.COM/Path')).toBe('https://example.com/Path');
  });
  it('strips utm_* tracking params', () => {
    expect(normalizeUrl('https://x.com/p?a=1&utm_source=tw&utm_medium=x'))
      .toBe('https://x.com/p?a=1');
  });
  it('strips fbclid, gclid, ref, mc_cid, mc_eid', () => {
    expect(normalizeUrl('https://x.com/p?fbclid=1&gclid=2&ref=3&mc_cid=4&mc_eid=5&keep=ok'))
      .toBe('https://x.com/p?keep=ok');
  });
  it('drops the fragment', () => {
    expect(normalizeUrl('https://x.com/p#section')).toBe('https://x.com/p');
  });
  it('sorts remaining query params for stable keys', () => {
    expect(normalizeUrl('https://x.com/p?b=2&a=1')).toBe('https://x.com/p?a=1&b=2');
  });
  it('preserves trailing slashes as given', () => {
    expect(normalizeUrl('https://x.com/p/')).toBe('https://x.com/p/');
  });
  it('throws on invalid input', () => {
    expect(() => normalizeUrl('not a url')).toThrow();
  });
});
