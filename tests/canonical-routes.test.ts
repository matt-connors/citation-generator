import { describe, expect, it } from 'vitest';
import { getCanonicalTrailingSlashRedirectUrl } from '../src/lib/canonical-routes';

describe('canonical trailing slash routes', () => {
  it('redirects slashless worker-routed pages and preserves query strings', () => {
    const redirectUrl = getCanonicalTrailingSlashRedirectUrl(
      new Request('https://mlagenerator.com/my-references?citationStyle=mla-9'),
    );

    expect(redirectUrl).toBe('https://mlagenerator.com/my-references/?citationStyle=mla-9');
  });

  it('redirects canonical static page shapes if they are routed through the worker', () => {
    const paths = [
      '/guides',
      '/guides/apa',
      '/guides/category/how-to',
      '/apa-citation-generator',
    ];

    expect(paths.map((path) => getCanonicalTrailingSlashRedirectUrl(
      new Request(`https://mlagenerator.com${path}`),
    ))).toEqual([
      'https://mlagenerator.com/guides/',
      'https://mlagenerator.com/guides/apa/',
      'https://mlagenerator.com/guides/category/how-to/',
      'https://mlagenerator.com/apa-citation-generator/',
    ]);
  });

  it('redirects HEAD requests used by link and status checkers', () => {
    const redirectUrl = getCanonicalTrailingSlashRedirectUrl(
      new Request('https://mlagenerator.com/my-references', { method: 'HEAD' }),
    );

    expect(redirectUrl).toBe('https://mlagenerator.com/my-references/');
  });

  it('leaves API and already-canonical paths alone', () => {
    expect(getCanonicalTrailingSlashRedirectUrl(
      new Request('https://mlagenerator.com/api/format', { method: 'POST' }),
    )).toBeNull();
    expect(getCanonicalTrailingSlashRedirectUrl(
      new Request('https://mlagenerator.com/my-references/'),
    )).toBeNull();
  });
});
