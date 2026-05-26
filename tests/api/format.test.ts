import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { handleFormat } from '../../functions/api/format/handler';
import { registerStyle, registerLocale } from '../../functions/lib/format/citeproc';

const ROOT = join(__dirname, '..', '..');

beforeAll(() => {
  registerLocale('en-US', readFileSync(join(ROOT, 'functions/lib/format/locales/locales-en-US.xml'), 'utf-8'));
  for (const s of ['mla-9', 'apa-7', 'chicago-18', 'ama-11', 'harvard', 'ieee', 'vancouver']) {
    registerStyle(s as any, readFileSync(join(ROOT, `functions/lib/format/styles/${s}.csl`), 'utf-8'));
  }
});

describe('handleFormat', () => {
  it('400s on missing body', async () => {
    const req = new Request('https://m.com/api/format', { method: 'POST', body: '' });
    const res = await handleFormat(req);
    expect(res.status).toBe(400);
  });

  it('400s on invalid JSON', async () => {
    const req = new Request('https://m.com/api/format', { method: 'POST', body: 'not json' });
    const res = await handleFormat(req);
    expect(res.status).toBe(400);
  });

  it('400s on unsupported style', async () => {
    const body = JSON.stringify({ csl: { id: 'x', type: 'webpage', title: 't' }, style: 'made-up' });
    const req = new Request('https://m.com/api/format', { method: 'POST', body });
    const res = await handleFormat(req);
    expect(res.status).toBe(400);
  });

  it('returns RichText[] for MLA 9', async () => {
    const body = JSON.stringify({
      csl: {
        id: 'x', type: 'webpage', title: 'A Title',
        author: [{ family: 'Doe', given: 'Jane' }],
        issued: { 'date-parts': [[2026]] },
        URL: 'https://example.com',
      },
      style: 'mla-9',
    });
    const req = new Request('https://m.com/api/format', { method: 'POST', body });
    const res = await handleFormat(req);
    expect(res.status).toBe(200);
    const out = await res.json() as { formatted: Array<{ text: string; italic?: boolean }> };
    expect(out.formatted.length).toBeGreaterThan(0);
    expect(out.formatted.map((r) => r.text).join('')).toContain('Doe');
  });
});
