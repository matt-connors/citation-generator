import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { formatCitation, registerStyle, registerLocale } from '../../functions/lib/format/citeproc';
import type { CSLItem } from '../../functions/lib/csl-types';

const PROJECT_ROOT = join(__dirname, '..', '..');

beforeAll(() => {
  registerLocale('en-US', readFileSync(join(PROJECT_ROOT, 'functions/lib/format/locales/locales-en-US.xml'), 'utf-8'));
  for (const s of ['mla-9', 'apa-7', 'chicago-18', 'ama-11', 'harvard', 'ieee', 'vancouver'] as const) {
    registerStyle(s, readFileSync(join(PROJECT_ROOT, `functions/lib/format/styles/${s}.csl`), 'utf-8'));
  }
});

const SAMPLE: CSLItem = {
  id: 'test',
  type: 'webpage',
  title: 'A Sample Web Article',
  author: [{ family: 'Doe', given: 'Jane' }],
  issued: { 'date-parts': [[2026, 5, 26]] },
  accessed: { 'date-parts': [[2026, 5, 26]] },
  URL: 'https://example.com/article',
  'container-title': 'Example',
};

describe('formatCitation', () => {
  it('renders MLA 9', () => {
    const out = formatCitation(SAMPLE, 'mla-9');
    expect(out.length).toBeGreaterThan(0);
    const text = out.map((r) => r.text).join('');
    expect(text).toContain('Doe');
    expect(text).toContain('Jane');
    expect(text).toContain('Sample Web Article');
    expect(text).toContain('example.com');
    const containerSeg = out.find((r) => r.italic);
    expect(containerSeg?.text).toContain('Example');
  });

  it('renders APA 7', () => {
    const out = formatCitation(SAMPLE, 'apa-7');
    const text = out.map((r) => r.text).join('');
    expect(text).toContain('Doe');
    expect(text).toContain('(2026');
  });

  it('renders Chicago 18', () => {
    const out = formatCitation(SAMPLE, 'chicago-18');
    const text = out.map((r) => r.text).join('');
    expect(text).toContain('Doe');
    expect(text).toContain('2026');
  });

  it('throws on unknown style', () => {
    expect(() => formatCitation(SAMPLE, 'made-up' as any)).toThrow();
  });
});
