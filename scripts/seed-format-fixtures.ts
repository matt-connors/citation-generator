// Run with: npx tsx scripts/seed-format-fixtures.ts
// Writes <fixture>/<style>.txt for any style not already present.
// To regenerate a golden, delete the .txt file and re-run.
import { readFileSync, writeFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { formatCitation, registerStyle, registerLocale } from '../functions/lib/format/citeproc';

const ROOT = join(__dirname, '..');
const FIX_ROOT = join(ROOT, 'tests/format/fixtures');
const STYLES = ['mla-9', 'apa-7', 'chicago-18'] as const;

registerLocale('en-US', readFileSync(join(ROOT, 'functions/lib/format/locales/locales-en-US.xml'), 'utf-8'));
for (const s of STYLES) {
  registerStyle(s, readFileSync(join(ROOT, `functions/lib/format/styles/${s}.csl`), 'utf-8'));
}

const dirs = readdirSync(FIX_ROOT).filter((d) => statSync(join(FIX_ROOT, d)).isDirectory());

let written = 0;
for (const name of dirs) {
  const cslPath = join(FIX_ROOT, name, 'csl.json');
  if (!existsSync(cslPath)) continue;
  const csl = JSON.parse(readFileSync(cslPath, 'utf-8'));
  for (const style of STYLES) {
    const out = join(FIX_ROOT, name, `${style}.txt`);
    if (existsSync(out)) continue;
    const rt = formatCitation(csl, style);
    const text = rt.map((seg) => (seg.italic ? `<i>${seg.text}</i>` : seg.text)).join('');
    writeFileSync(out, text + '\n');
    console.log(`wrote ${name}/${style}.txt`);
    written++;
  }
}
console.log(`Done. ${written} files written.`);
