import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { GUIDE_CATEGORIES } from '../../src/lib/guide-categories';

const guidesDir = join(process.cwd(), 'src/content/guides');
const titleMax = 70;
const descriptionMax = 160;

function frontmatterField(source: string, key: string): string {
  const frontmatter = source.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? '';
  const line = frontmatter.split(/\r?\n/).find((entry) => entry.startsWith(`${key}:`));
  return line?.slice(key.length + 1).trim().replace(/^['"]|['"]$/g, '') ?? '';
}

function pageConstant(source: string, key: 'title' | 'description'): string | null {
  const match = source.match(new RegExp(`const ${key} =\\s*(["'])((?:(?!\\1).)*)\\1;`, 'm'));
  return match?.[2] ?? null;
}

describe('SEO metadata', () => {
  it('keeps guide titles and meta descriptions within search-snippet limits', () => {
    const failures: string[] = [];

    for (const file of readdirSync(guidesDir).filter((entry) => entry.endsWith('.mdx'))) {
      const source = readFileSync(join(guidesDir, file), 'utf8');
      const title = frontmatterField(source, 'title');
      const description = frontmatterField(source, 'description');

      if (title.length > titleMax) failures.push(`${file} title ${title.length}`);
      if (description.length > descriptionMax) failures.push(`${file} description ${description.length}`);
    }

    expect(failures).toEqual([]);
  });

  it('keeps top-level page and category descriptions within search-snippet limits', () => {
    const pageFiles = [
      'src/pages/index.astro',
      'src/pages/about.astro',
      'src/pages/ama-citation-generator.astro',
      'src/pages/apa-citation-generator.astro',
      'src/pages/chicago-citation-generator.astro',
      'src/pages/harvard-referencing-generator.astro',
      'src/pages/ieee-citation-generator.astro',
      'src/pages/mla-citation-generator.astro',
      'src/pages/my-references.astro',
      'src/pages/vancouver-citation-generator.astro',
      'src/pages/guides/index.astro',
    ];
    const failures: string[] = [];

    for (const file of pageFiles) {
      const source = readFileSync(join(process.cwd(), file), 'utf8');
      const title = pageConstant(source, 'title');
      const description = pageConstant(source, 'description');

      if (title && title.length > titleMax) failures.push(`${file} title ${title.length}`);
      if (description && description.length > descriptionMax) {
        failures.push(`${file} description ${description.length}`);
      }
    }

    for (const category of GUIDE_CATEGORIES) {
      if (category.description.length > descriptionMax) {
        failures.push(`category:${category.key} description ${category.description.length}`);
      }
    }

    expect(failures).toEqual([]);
  });

  it('serves static robots.txt with the sitemap index', () => {
    const robotsPath = join(process.cwd(), 'public/robots.txt');
    expect(existsSync(robotsPath)).toBe(true);
    expect(readFileSync(robotsPath, 'utf8')).toContain('Sitemap: https://mlagenerator.com/sitemap-index.xml');
  });

  it('marks legal pages noindex', () => {
    for (const file of ['src/pages/privacy.astro', 'src/pages/terms.astro']) {
      expect(readFileSync(join(process.cwd(), file), 'utf8')).toContain('robots="noindex, follow"');
    }
  });
});
