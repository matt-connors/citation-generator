import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { isPublishedDate, utcDay } from '../../src/lib/publication';

const guidesDir = join(process.cwd(), 'src/content/guides');
const cutoff = '2026-06-29';

interface GuideEntry {
  slug: string;
  pubDate: string;
  body: string;
}

function frontmatterField(frontmatter: string, key: string): string {
  const line = frontmatter.split(/\r?\n/).find((entry) => entry.startsWith(`${key}:`));
  return line?.slice(key.length + 1).trim().replace(/^['"]|['"]$/g, '') ?? '';
}

function readGuides(): GuideEntry[] {
  return readdirSync(guidesDir)
    .filter((file) => file.endsWith('.mdx'))
    .map((file) => {
      const source = readFileSync(join(guidesDir, file), 'utf8');
      const frontmatter = source.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? '';
      return {
        slug: file.replace(/\.mdx$/, ''),
        pubDate: frontmatterField(frontmatter, 'pubDate'),
        body: source.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, ''),
      };
    });
}

describe('guide internal links', () => {
  it('does not link from currently published guide bodies to future-dated guides', () => {
    const guides = readGuides();
    const bySlug = new Map(guides.map((guide) => [guide.slug, guide]));
    const failures: string[] = [];

    for (const guide of guides) {
      if (!isPublishedDate(guide.pubDate, cutoff)) continue;

      for (const match of guide.body.matchAll(/\]\(\/guides\/([a-z0-9-]+)(?:#[^)]+)?\)/g)) {
        const targetSlug = match[1];
        const target = bySlug.get(targetSlug);
        if (!target) continue;
        if (!isPublishedDate(target.pubDate, cutoff)) {
          failures.push(`${guide.slug} links to future guide ${target.slug} (${target.pubDate})`);
        }
      }
    }

    expect(failures).toEqual([]);
  });

  it('does not link from queued future guide bodies to guides scheduled later than themselves', () => {
    const guides = readGuides();
    const bySlug = new Map(guides.map((guide) => [guide.slug, guide]));
    const failures: string[] = [];

    for (const guide of guides) {
      if (isPublishedDate(guide.pubDate, cutoff)) continue;

      for (const match of guide.body.matchAll(/\]\(\/guides\/([a-z0-9-]+)(?:#[^)]+)?\)/g)) {
        const targetSlug = match[1];
        const target = bySlug.get(targetSlug);
        if (!target) continue;
        if (utcDay(target.pubDate) > utcDay(guide.pubDate)) {
          failures.push(`${guide.slug} (${guide.pubDate}) links to later guide ${target.slug} (${target.pubDate})`);
        }
      }
    }

    expect(failures).toEqual([]);
  });
});
