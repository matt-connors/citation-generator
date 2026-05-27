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

  it('returns distinct output for distinct items sharing the same id (or distinct ids in sequence)', () => {
    // Bug regression: with engine caching, calling formatCitation twice in a row
    // with the same id but different content used to return the first item's output.
    const itemA: CSLItem = {
      id: 'X', type: 'webpage', title: 'AAA',
      author: [{ family: 'AlphaLast', given: 'AlphaFirst' }],
      issued: { 'date-parts': [[2020]] },
      URL: 'https://a.example.com',
    };
    const itemB: CSLItem = {
      id: 'X', type: 'webpage', title: 'BBB',
      author: [{ family: 'BetaLast', given: 'BetaFirst' }],
      issued: { 'date-parts': [[2021]] },
      URL: 'https://b.example.com',
    };
    const a = formatCitation(itemA, 'mla-9').map((r) => r.text).join('');
    const b = formatCitation(itemB, 'mla-9').map((r) => r.text).join('');
    expect(a).toContain('AAA');
    expect(a).toContain('AlphaLast');
    expect(b).toContain('BBB');
    expect(b).toContain('BetaLast');
    expect(a).not.toBe(b);
  });

  it('decodes numeric HTML entities in rendered output', () => {
    // Bug regression: citeproc-js emits &#38; for &amp;, our decoder dropped this on the floor.
    const item: CSLItem = {
      id: 'multi-author', type: 'webpage', title: 'X',
      author: [
        { family: 'Doe', given: 'Jane' },
        { family: 'Smith', given: 'John' },
      ],
      issued: { 'date-parts': [[2024]] },
      URL: 'https://x.com',
    };
    const rendered = formatCitation(item, 'apa-7').map((r) => r.text).join('');
    expect(rendered).not.toMatch(/&#\d+;/);
    expect(rendered).not.toMatch(/&#x[0-9a-f]+;/i);
    expect(rendered).toContain('&'); // APA uses & between final two authors
  });
});
