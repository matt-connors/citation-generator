import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { extname, join } from 'node:path';
import { categoryPath } from '../../src/lib/guide-categories';

const scanRoots = ['src', 'chrome-extension'];
const sourceExtensions = new Set(['.astro', '.mdx', '.tsx', '.ts', '.mjs', '.js', '.html']);

const sourceLinkPatterns: Array<[string, RegExp]> = [
  ['attribute', /(?:href|action)\s*=\s*\\?["']([^"'\\]+)\\?["']/g],
  ['markdown', /\]\((\/[^)\s]+)\)/g],
  ['new URL', /new URL\(\s*["']([^"']+)["']/g],
  ['siteUrl', /siteUrl\(\s*["']([^"']+)["']/g],
  ['href object', /href:\s*["']([^"']+)["']/g],
];

function walk(dir: string): string[] {
  return readdirSync(join(process.cwd(), dir), { withFileTypes: true }).flatMap((entry) => {
    const relative = join(dir, entry.name);
    if (entry.isDirectory()) return walk(relative);
    return sourceExtensions.has(extname(entry.name)) ? [relative] : [];
  });
}

function isInternalPageUrl(raw: string): boolean {
  if (!raw.startsWith('/') || raw === '/') return false;
  if (raw.startsWith('//') || raw.startsWith('/#')) return false;
  if (raw.startsWith('/api/') || raw.startsWith('/_') || raw.startsWith('/cdn-cgi/')) return false;

  const pathname = raw.split(/[?#]/)[0];
  if (pathname === '/') return false;
  return !/\.[a-z0-9]+$/i.test(pathname);
}

function hasTrailingSlashBeforeQueryOrHash(raw: string): boolean {
  return raw.split(/[?#]/)[0].endsWith('/');
}

describe('canonical internal links', () => {
  it('keeps authored internal page links slash-terminated', () => {
    const failures: string[] = [];

    for (const file of scanRoots.flatMap(walk)) {
      const source = readFileSync(join(process.cwd(), file), 'utf8');
      for (const [label, pattern] of sourceLinkPatterns) {
        pattern.lastIndex = 0;
        for (const match of source.matchAll(pattern)) {
          const raw = match[1];
          if (isInternalPageUrl(raw) && !hasTrailingSlashBeforeQueryOrHash(raw)) {
            const line = source.slice(0, match.index).split(/\r?\n/).length;
            failures.push(`${file}:${line} ${label} ${raw}`);
          }
        }
      }
    }

    expect(failures).toEqual([]);
  });

  it('keeps dynamic guide route builders slash-terminated', () => {
    const failures: string[] = [];
    const dynamicGuidePattern = /\/guides(?:\/category)?\/\$\{[^}]+\}(?!\/)/g;

    for (const file of scanRoots.flatMap(walk)) {
      const source = readFileSync(join(process.cwd(), file), 'utf8');
      for (const match of source.matchAll(dynamicGuidePattern)) {
        const line = source.slice(0, match.index).split(/\r?\n/).length;
        failures.push(`${file}:${line} ${match[0]}`);
      }
    }

    expect(categoryPath('how-to')).toBe('/guides/category/how-to/');
    expect(failures).toEqual([]);
  });

  it('keeps static Cloudflare redirects for slashless canonical page routes', () => {
    const redirects = readFileSync(join(process.cwd(), 'public/_redirects'), 'utf8')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'));
    const redirectSet = new Set(redirects);
    const expectedRules = [
      '/guides /guides/ 301',
      '/about /about/ 301',
      '/privacy /privacy/ 301',
      '/terms /terms/ 301',
      '/my-references /my-references/ 301',
      '/admin/analytics /admin/analytics/ 301',
      '/ama-citation-generator /ama-citation-generator/ 301',
      '/apa-citation-generator /apa-citation-generator/ 301',
      '/chicago-citation-generator /chicago-citation-generator/ 301',
      '/harvard-referencing-generator /harvard-referencing-generator/ 301',
      '/ieee-citation-generator /ieee-citation-generator/ 301',
      '/mla-citation-generator /mla-citation-generator/ 301',
      '/vancouver-citation-generator /vancouver-citation-generator/ 301',
      '/guides/category/:category /guides/category/:category/ 301',
      '/guides/:slug /guides/:slug/ 301',
    ];

    expect(expectedRules.filter((rule) => !redirectSet.has(rule))).toEqual([]);
  });
});
