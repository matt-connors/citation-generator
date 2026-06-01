// Generate per-guide Open Graph images as static PNGs committed under
// public/og/<slug>.png. This is a LOCAL, manual step — it is intentionally NOT
// wired into `npm run build`, so the Cloudflare deploy never depends on the
// image renderer. Re-run it when guide titles/categories change:
//
//   npm install -D @resvg/resvg-js   # if not already installed
//   node scripts/gen-og-images.mjs
//
// Design: 1200x630, white card, brand-green category pill, large wrapped
// title, "MLA Generator" wordmark, and the domain. Text is rendered with the
// system font (Arial) via resvg.

import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Resvg } from '@resvg/resvg-js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const guidesDir = join(root, 'src/content/guides');
const outDir = join(root, 'public/og');

// Mirror of src/lib/guide-categories.ts labels (kept in sync manually).
const CATEGORY_LABEL = {
    'style-guide': 'Style guide',
    'how-to': 'How to cite',
    'concept': 'Concept',
    'comparison': 'Comparison',
    'meta': 'Reference',
};

const W = 1200;
const H = 630;
const PAD = 80;
const TEXT_W = W - PAD * 2; // usable text width
const BRAND = '#B2FF51';
const DARK = '#1A1A1A';
const LIGHT = '#6D6D6D';

function escapeXml(s) {
    return s.replace(/[&<>"']/g, (c) =>
        c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : '&apos;');
}

// Greedy word-wrap by estimated width. Arial at the given px size averages
// ~0.52em per char; we wrap a little conservatively so text never clips.
function wrapTitle(title, fontSize, maxWidth, maxLines) {
    const avgChar = fontSize * 0.54;
    const maxChars = Math.floor(maxWidth / avgChar);
    const words = title.split(/\s+/);
    const lines = [];
    let line = '';
    for (const word of words) {
        const candidate = line ? `${line} ${word}` : word;
        if (candidate.length <= maxChars || !line) {
            line = candidate;
        } else {
            lines.push(line);
            line = word;
        }
    }
    if (line) lines.push(line);
    if (lines.length > maxLines) {
        const kept = lines.slice(0, maxLines);
        kept[maxLines - 1] = kept[maxLines - 1].replace(/\s+\S*$/, '') + '…';
        return kept;
    }
    return lines;
}

function parseFrontmatter(src) {
    const title = src.match(/^title:\s*(.+)$/m)?.[1]?.trim() ?? '';
    const category = src.match(/^category:\s*['"]?([a-z-]+)/m)?.[1] ?? '';
    // Strip surrounding quotes from the YAML scalar.
    const cleanTitle = title.replace(/^['"]|['"]$/g, '').replace(/^['"]|['"]$/g, '');
    return { title: cleanTitle, category };
}

function buildSvg(title, categoryLabel) {
    // Title: pick a font size that fits up to 3 lines.
    let fontSize = 64;
    let lines = wrapTitle(title, fontSize, TEXT_W, 3);
    if (lines.length > 2) {
        fontSize = 54;
        lines = wrapTitle(title, fontSize, TEXT_W, 3);
    }
    const lineHeight = fontSize * 1.18;
    // Vertically center the title block in the available middle band.
    const blockTop = 250;
    const titleTspans = lines
        .map((ln, i) => `<tspan x="${PAD}" y="${blockTop + i * lineHeight}">${escapeXml(ln)}</tspan>`)
        .join('');

    const pillText = escapeXml(categoryLabel.toUpperCase());
    const pillW = 40 + pillText.length * 13;

    return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${W}" height="${H}" fill="#ffffff"/>
  <rect x="0" y="0" width="16" height="${H}" fill="${BRAND}"/>
  <text x="${PAD}" y="110" font-family="Arial" font-size="34" font-weight="700" fill="${DARK}">MLA Generator</text>
  <rect x="${PAD}" y="150" width="${pillW}" height="44" rx="22" fill="${BRAND}"/>
  <text x="${PAD + pillW / 2}" y="179" font-family="Arial" font-size="20" font-weight="700" fill="${DARK}" text-anchor="middle" letter-spacing="1">${pillText}</text>
  <text font-family="Arial" font-size="${fontSize}" font-weight="700" fill="${DARK}">${titleTspans}</text>
  <text x="${PAD}" y="${H - 70}" font-family="Arial" font-size="26" font-weight="400" fill="${LIGHT}">mlagenerator.com</text>
</svg>`;
}

function main() {
    if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
    const files = readdirSync(guidesDir).filter((f) => f.endsWith('.mdx'));
    let count = 0;
    for (const file of files) {
        const slug = file.replace(/\.mdx$/, '');
        const { title, category } = parseFrontmatter(readFileSync(join(guidesDir, file), 'utf8'));
        if (!title) {
            console.warn(`  ! skipped ${file} (no title)`);
            continue;
        }
        const label = CATEGORY_LABEL[category] ?? 'Guide';
        const svg = buildSvg(title, label);
        const resvg = new Resvg(svg, {
            font: { loadSystemFonts: true, defaultFontFamily: 'Arial' },
            fitTo: { mode: 'width', value: W },
        });
        const png = resvg.render().asPng();
        writeFileSync(join(outDir, `${slug}.png`), png);
        count++;
        console.log(`  wrote og/${slug}.png (${png.length} B) — "${title.slice(0, 50)}"`);
    }
    console.log(`\nGenerated ${count} OG images into public/og/`);
}

main();
