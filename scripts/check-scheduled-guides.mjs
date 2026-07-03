import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const guidesDir = join(root, 'src/content/guides');
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const args = new Map();
for (const arg of process.argv.slice(2)) {
    const [key, value = 'true'] = arg.split('=');
    args.set(key, value);
}

function utcDay(value) {
    const raw = value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
    const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) throw new Error(`Invalid date: ${value}`);
    const [, y, m, d] = match;
    return Math.floor(Date.UTC(Number(y), Number(m) - 1, Number(d)) / MS_PER_DAY);
}

function field(frontmatter, key) {
    const line = frontmatter.split(/\r?\n/).find((entry) => entry.startsWith(`${key}:`));
    if (!line) return '';
    return line.slice(key.length + 1).trim().replace(/^['"]|['"]$/g, '');
}

function readGuides() {
    return readdirSync(guidesDir)
        .filter((file) => file.endsWith('.mdx'))
        .map((file) => {
            const source = readFileSync(join(guidesDir, file), 'utf8');
            const frontmatter = source.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? '';
            return {
                slug: file.replace(/\.mdx$/, ''),
                title: field(frontmatter, 'title'),
                pubDate: field(frontmatter, 'pubDate'),
                category: field(frontmatter, 'category'),
            };
        })
        .filter((guide) => guide.pubDate)
        .sort((a, b) => a.pubDate.localeCompare(b.pubDate) || a.slug.localeCompare(b.slug));
}

async function readLiveUrls(sitemapUrl) {
    const response = await fetch(sitemapUrl);
    if (!response.ok) throw new Error(`Could not fetch ${sitemapUrl}: ${response.status}`);
    const xml = await response.text();
    return new Set(
        [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)]
            .map((match) => match[1].replace(/\/$/, '')),
    );
}

function guideUrl(slug) {
    return `https://mlagenerator.com/guides/${slug}`;
}

function writeTriggerFile(outPath, report) {
    const absolute = join(root, outPath);
    const dir = dirname(absolute);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(
        absolute,
        `${JSON.stringify({
            generatedAt: report.checkedAt,
            publishDate: report.publishDate,
            dueUnlisted: report.dueUnlisted.map(({ slug, title, pubDate }) => ({ slug, title, pubDate })),
        }, null, 2)}\n`,
    );
}

const publishDate = (process.env.CONTENT_PUBLISH_AT || new Date().toISOString()).slice(0, 10);
const today = utcDay(publishDate);
const guides = readGuides();
const due = guides.filter((guide) => utcDay(guide.pubDate) <= today);
const future = guides.filter((guide) => utcDay(guide.pubDate) > today);
const sitemapUrl = args.get('--live-sitemap');

let liveUrls = null;
let liveSitemapError = '';
if (sitemapUrl) {
    try {
        liveUrls = await readLiveUrls(sitemapUrl);
    } catch (err) {
        liveSitemapError = err instanceof Error ? err.message : String(err);
    }
}

const dueUnlisted = liveUrls
    ? due.filter((guide) => !liveUrls.has(guideUrl(guide.slug)))
    : [];

const report = {
    checkedAt: new Date().toISOString(),
    publishDate,
    liveSitemap: sitemapUrl || null,
    liveSitemapError,
    dueCount: due.length,
    dueUnlisted,
    nextScheduled: future.slice(0, 12),
};

const triggerPath = args.get('--write-trigger');
if (triggerPath) {
    if (liveSitemapError) {
        console.warn(`[scheduled-guides] skipped trigger write: ${liveSitemapError}`);
    } else if (dueUnlisted.length > 0) {
        writeTriggerFile(triggerPath, report);
        console.log(`[scheduled-guides] wrote ${triggerPath} for ${dueUnlisted.length} due guide(s).`);
    } else {
        console.log('[scheduled-guides] no due unpublished guides found.');
    }
}

if (args.has('--json')) {
    console.log(JSON.stringify(report, null, 2));
} else {
    console.log(`Checked scheduled guides for ${publishDate}.`);
    if (liveSitemapError) console.log(`Live sitemap error: ${liveSitemapError}`);
    console.log(`Due guides: ${due.length}`);
    console.log(`Due but not live: ${dueUnlisted.length}`);
    for (const guide of dueUnlisted) {
        console.log(`  - ${guide.pubDate} ${guide.slug} - ${guide.title}`);
    }
    console.log('Next scheduled guides:');
    for (const guide of report.nextScheduled) {
        console.log(`  - ${guide.pubDate} ${guide.slug} - ${guide.title}`);
    }
}
