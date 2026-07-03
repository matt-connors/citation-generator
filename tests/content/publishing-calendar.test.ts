import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const calendarPath = join(process.cwd(), 'docs/content-research/publishing-calendar.json');
const guidesDir = join(process.cwd(), 'src/content/guides');
const ogDir = join(process.cwd(), 'public/og');
const draftedStatuses = new Set(['expanded-in-repo', 'drafted-in-repo']);
const dayMs = 24 * 60 * 60 * 1000;

interface CalendarEntry {
  publishDate: string;
  slug: string;
  status: string;
  primaryKeyword: string;
}

function readCalendar(): CalendarEntry[] {
  return JSON.parse(readFileSync(calendarPath, 'utf8')) as CalendarEntry[];
}

function frontmatterField(source: string, key: string): string {
  const frontmatter = source.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? '';
  const line = frontmatter.split(/\r?\n/).find((entry) => entry.startsWith(`${key}:`));
  return line?.slice(key.length + 1).trim().replace(/^['"]|['"]$/g, '') ?? '';
}

describe('publishing calendar', () => {
  it('keeps entries in a two-week cadence', () => {
    const entries = readCalendar();
    const failures: string[] = [];

    for (let i = 1; i < entries.length; i += 1) {
      const previous = Date.parse(`${entries[i - 1].publishDate}T00:00:00Z`);
      const current = Date.parse(`${entries[i].publishDate}T00:00:00Z`);
      if (current - previous !== 14 * dayMs) {
        failures.push(`${entries[i - 1].slug} -> ${entries[i].slug}`);
      }
    }

    expect(failures).toEqual([]);
  });

  it('matches drafted calendar entries to local guide frontmatter and OG images', () => {
    const failures: string[] = [];

    for (const entry of readCalendar()) {
      if (!draftedStatuses.has(entry.status)) continue;

      const guidePath = join(guidesDir, `${entry.slug}.mdx`);
      const ogPath = join(ogDir, `${entry.slug}.png`);

      if (!existsSync(guidePath)) {
        failures.push(`${entry.slug} is ${entry.status} but has no local guide file`);
        continue;
      }

      const source = readFileSync(guidePath, 'utf8');
      const pubDate = frontmatterField(source, 'pubDate');
      const title = frontmatterField(source, 'title').toLowerCase();
      const description = frontmatterField(source, 'description').toLowerCase();
      const primaryKeyword = entry.primaryKeyword.toLowerCase();

      if (pubDate !== entry.publishDate) {
        failures.push(`${entry.slug} calendar date ${entry.publishDate} does not match pubDate ${pubDate}`);
      }

      if (!existsSync(ogPath)) {
        failures.push(`${entry.slug} is missing ${ogPath}`);
      }

      if (!title.includes(primaryKeyword) && !description.includes(primaryKeyword)) {
        failures.push(`${entry.slug} title/description does not include primary keyword "${entry.primaryKeyword}"`);
      }
    }

    expect(failures).toEqual([]);
  });
});
