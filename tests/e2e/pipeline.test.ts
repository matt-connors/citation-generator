import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runExtractionPipeline } from '../../functions/lib/extract/pipeline';
import { formatCitation, registerStyle, registerLocale } from '../../functions/lib/format/citeproc';

const ROOT = join(__dirname, '..', '..');
const FIXTURE_NAME = 'nature-paper';

beforeAll(() => {
  registerLocale('en-US', readFileSync(join(ROOT, 'functions/lib/format/locales/locales-en-US.xml'), 'utf-8'));
  registerStyle('mla-9', readFileSync(join(ROOT, 'functions/lib/format/styles/mla-9.csl'), 'utf-8'));
});

describe('end-to-end: HTML -> CSL -> MLA 9', () => {
  it('produces a non-empty MLA 9 citation from a richly marked-up fixture', () => {
    const dir = join(ROOT, `tests/extract/fixtures/${FIXTURE_NAME}`);
    const html = readFileSync(join(dir, 'input.html'), 'utf-8');
    const url = readFileSync(join(dir, 'input.url'), 'utf-8').trim();
    const { csl } = runExtractionPipeline(html, url);
    const rt = formatCitation(csl, 'mla-9');
    const text = rt.map((r) => r.text).join('');
    expect(text.length).toBeGreaterThan(20);
    expect(text).toMatch(/\./); // contains at least a period
  });
});
