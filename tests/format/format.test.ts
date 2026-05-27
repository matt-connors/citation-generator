import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { formatCitation, registerStyle, registerLocale } from '../../functions/lib/format/citeproc';

const ROOT = join(__dirname, '..', '..');
const FIX_ROOT = join(__dirname, 'fixtures');
const STYLES = ['mla-9', 'apa-7', 'chicago-18'] as const;

beforeAll(() => {
  registerLocale('en-US', readFileSync(join(ROOT, 'functions/lib/format/locales/locales-en-US.xml'), 'utf-8'));
  for (const s of STYLES) {
    registerStyle(s, readFileSync(join(ROOT, `functions/lib/format/styles/${s}.csl`), 'utf-8'));
  }
});

const fixtures = readdirSync(FIX_ROOT).filter((d) => {
  const p = join(FIX_ROOT, d);
  return statSync(p).isDirectory() && existsSync(join(p, 'csl.json'));
});

describe('formatting (fixture corpus)', () => {
  for (const name of fixtures) {
    for (const style of STYLES) {
      const goldPath = join(FIX_ROOT, name, `${style}.txt`);
      if (!existsSync(goldPath)) continue;
      it(`${name} → ${style}`, () => {
        const csl = JSON.parse(readFileSync(join(FIX_ROOT, name, 'csl.json'), 'utf-8'));
        const expected = readFileSync(goldPath, 'utf-8').replace(/\r?\n$/, '');
        const rt = formatCitation(csl, style);
        const actual = rt.map((seg) => (seg.italic ? `<i>${seg.text}</i>` : seg.text)).join('');
        expect(actual).toBe(expected);
      });
    }
  }
});
