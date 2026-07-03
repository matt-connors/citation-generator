import { describe, it, expect, vi } from 'vitest';
import { runAiFieldAssist } from '../../functions/lib/ai/citation-assist';
import type { CSLItem } from '../../functions/lib/csl-types';

// A realistic page body (>50 chars, or runAiFieldAssist early-returns []). Every
// snippet used below is a verbatim substring of this text.
const PAGE = 'By Jane Doe and John Smith, staff writers. Published January 15, 2026. '
  + 'Appears in the journal Nature. This is the article body text used for testing the guardrail.';

// Build a mocked AI binding that returns the given proposals, exactly like the
// Cloudflare Workers-AI response shape ({ response: "<json string>" }).
function aiWith(proposals: unknown[]) {
  return { run: vi.fn(async () => ({ response: JSON.stringify({ proposals }) })) };
}

async function assist(
  proposals: unknown[],
  opts: { csl?: Partial<CSLItem>; text?: string; rendered?: string } = {},
) {
  const ai = aiWith(proposals);
  const evidence = await runAiFieldAssist({
    ai,
    csl: { type: 'webpage', ...(opts.csl ?? {}) } as CSLItem,
    url: 'https://example.com/article',
    fetchedText: opts.text ?? PAGE,
    renderedText: opts.rendered,
    acquiredAt: '2026-07-03T00:00:00.000Z',
  });
  return { ai, evidence, fields: evidence.map((e) => e.field) };
}

const P = (over: Record<string, unknown>) => ({
  field: 'author',
  value: 'Jane Doe',
  evidenceSnippet: 'By Jane Doe and John Smith, staff writers',
  evidenceSource: 'fetched',
  confidence: 0.9,
  ...over,
});

describe('runAiFieldAssist — evidence guardrail', () => {
  // ---- The core invariant (HOLE A): snippet in page is NOT enough; the value
  // itself must be supported by (appear verbatim within) the cited snippet. ----

  it('drops an author value that is absent from its (real) cited snippet', async () => {
    const { evidence, fields } = await assist([
      P({
        field: 'author',
        value: 'Fabricated McMadeup',
        evidenceSnippet: 'This is the article body text used for testing', // real page text
      }),
    ]);
    expect(fields).not.toContain('author');
    expect(evidence).toEqual([]);
  });

  it('drops a date value absent from its cited snippet', async () => {
    const { fields } = await assist([
      P({
        field: 'issued',
        value: 'December 1, 1999', // not anywhere in the page
        evidenceSnippet: 'This is the article body text used for testing',
      }),
    ]);
    expect(fields).not.toContain('issued');
  });

  it('drops a fabricated DOI backed by an unrelated real snippet', async () => {
    const { fields } = await assist([
      P({
        field: 'DOI',
        value: '10.9999/totally-fake',
        evidenceSnippet: 'Appears in the journal Nature',
        confidence: 0.95,
      }),
    ]);
    expect(fields).not.toContain('DOI');
  });

  it('drops a structured date object (unverifiable by substring)', async () => {
    const { fields } = await assist([
      P({
        field: 'issued',
        value: { 'date-parts': [[1999, 1, 1]] }, // object -> cannot verify against text
        evidenceSnippet: 'Published January 15, 2026',
      }),
    ]);
    expect(fields).not.toContain('issued');
  });

  it('rejects a one-common-word snippet paired with an unrelated value (HOLE B)', async () => {
    const { fields } = await assist([
      P({ field: 'title', value: 'Anything At All', evidenceSnippet: 'the' }),
    ]);
    expect(fields).not.toContain('title');
  });

  // ---- The guardrail must not over-reject genuine, on-page values. ----

  it('accepts a value that is a verbatim substring of its snippet', async () => {
    const { evidence } = await assist([
      P({ field: 'author', value: 'Jane Doe', evidenceSnippet: 'By Jane Doe and John Smith, staff writers' }),
    ]);
    expect(evidence).toHaveLength(1);
    expect(evidence[0].field).toBe('author');
    expect(evidence[0].normalizedValue).toEqual([{ family: 'Doe', given: 'Jane' }]);
  });

  it('accepts a verbatim date and parses it', async () => {
    const { evidence } = await assist([
      P({ field: 'issued', value: 'January 15, 2026', evidenceSnippet: 'Published January 15, 2026' }),
    ]);
    expect(evidence).toHaveLength(1);
    expect(evidence[0].normalizedValue).toEqual({ 'date-parts': [[2026, 1, 15]], raw: 'January 15, 2026' });
  });

  it('accepts an author list only when every name is in the snippet', async () => {
    const ok = await assist([
      P({ field: 'author', value: ['Jane Doe', 'John Smith'], evidenceSnippet: 'By Jane Doe and John Smith, staff writers' }),
    ]);
    expect(ok.evidence).toHaveLength(1);
    expect(ok.evidence[0].normalizedValue).toEqual([
      { family: 'Doe', given: 'Jane' },
      { family: 'Smith', given: 'John' },
    ]);

    const bad = await assist([
      P({ field: 'author', value: ['Jane Doe', 'Ghost Writer'], evidenceSnippet: 'By Jane Doe and John Smith, staff writers' }),
    ]);
    expect(bad.fields).not.toContain('author'); // one unsupported name invalidates the list
  });

  it('matches case- and whitespace-insensitively (does not over-reject)', async () => {
    const { evidence } = await assist(
      [P({ field: 'title', value: 'the ARTICLE body', evidenceSnippet: 'This is the article body text' })],
      { text: 'This  is   the ARTICLE   body text used for testing the citation guardrail thoroughly.' },
    );
    expect(evidence).toHaveLength(1);
    expect(evidence[0].field).toBe('title');
    expect(evidence[0].normalizedValue).toBe('the ARTICLE body');
  });

  // ---- Supporting gates. ----

  it('drops an empty / whitespace-only snippet', async () => {
    const { fields } = await assist([P({ evidenceSnippet: '   ' })]);
    expect(fields).not.toContain('author');
  });

  it('drops a proposal with confidence below the floor', async () => {
    const { fields } = await assist([P({ confidence: 0.69 })]);
    expect(fields).not.toContain('author');
  });

  it('drops a proposal with confidence above 1', async () => {
    const { fields } = await assist([P({ confidence: 2 })]);
    expect(fields).not.toContain('author');
  });

  it('never overrides a field already present in the CSL (additive only)', async () => {
    const { fields } = await assist(
      [P({ field: 'author', value: 'Jane Doe', evidenceSnippet: 'By Jane Doe and John Smith, staff writers' })],
      { csl: { author: [{ family: 'Existing', given: 'Author' }] } },
    );
    expect(fields).not.toContain('author');
  });

  it('caps accepted confidence at 0.82 and tags provenance as ai-extract', async () => {
    const { evidence } = await assist([
      P({ field: 'author', value: 'Jane Doe', evidenceSnippet: 'By Jane Doe and John Smith, staff writers', confidence: 0.99 }),
    ]);
    expect(evidence[0].confidence).toBe(0.82);
    expect(evidence[0].source).toBe('ai-extract');
    expect(evidence[0].acquisition).toBe('ai');
  });

  it('returns nothing when the page text is too short to trust', async () => {
    const { ai, evidence } = await assist(
      [P({ field: 'author', value: 'Jane Doe', evidenceSnippet: 'Jane Doe' })],
      { text: 'too short' },
    );
    expect(evidence).toEqual([]);
    expect(ai.run).not.toHaveBeenCalled();
  });

  // ---- Hardening from adversarial review. ----

  it('drops a value synthesized across the fetched/rendered boundary', async () => {
    // "Jane Fakeman" appears on NEITHER document; only across the join.
    const { fields } = await assist(
      [P({
        field: 'author',
        value: 'Jane Fakeman',
        evidenceSnippet: 'writing to Jane Fakeman covers technology',
        confidence: 0.9,
      })],
      {
        text: 'Reach the newsroom by writing to Jane',
        rendered: 'Fakeman covers technology for the outlet and edits weekend features here.',
      },
    );
    expect(fields).not.toContain('author');
  });

  it('accepts a snippet that lives entirely within the rendered source', async () => {
    const { evidence } = await assist(
      [P({ field: 'author', value: 'Jane Doe', evidenceSnippet: 'By Jane Doe and John Smith, staff writers' })],
      { text: 'A short stub with almost no metadata at all in it whatsoever.', rendered: PAGE },
    );
    expect(evidence).toHaveLength(1);
    expect(evidence[0].field).toBe('author');
  });

  it('rejects a numeric value coerced into a non-date field (page year → volume)', async () => {
    const { fields } = await assist([
      P({ field: 'volume', value: 2026, evidenceSnippet: 'Published January 15, 2026' }),
    ]);
    expect(fields).not.toContain('volume');
  });

  it('rejects an author list containing a bare number', async () => {
    const { fields } = await assist([
      P({ field: 'author', value: ['Jane Doe', 2026], evidenceSnippet: 'By Jane Doe and John Smith, staff writers' }),
    ]);
    expect(fields).not.toContain('author');
  });

  it('rejects body prose misattributed to DOI (shape check)', async () => {
    const { fields } = await assist([
      P({ field: 'DOI', value: 'the article body text', evidenceSnippet: 'This is the article body text used for testing' }),
    ]);
    expect(fields).not.toContain('DOI');
  });

  it('accepts a real DOI present on the page', async () => {
    const { evidence } = await assist(
      [P({ field: 'DOI', value: '10.1038/s41586-020-2649-2', evidenceSnippet: 'doi:10.1038/s41586-020-2649-2 for reference' })],
      { text: 'Full text below. Cite as doi:10.1038/s41586-020-2649-2 for reference in your bibliography.' },
    );
    expect(evidence).toHaveLength(1);
    expect(evidence[0].field).toBe('DOI');
    expect(evidence[0].normalizedValue).toBe('10.1038/s41586-020-2649-2');
  });

  it('emits at most one evidence per field when the model proposes it twice', async () => {
    const { evidence, fields } = await assist([
      P({ field: 'author', value: 'Jane Doe', evidenceSnippet: 'By Jane Doe and John Smith, staff writers', confidence: 0.8 }),
      P({ field: 'author', value: 'John Smith', evidenceSnippet: 'By Jane Doe and John Smith, staff writers', confidence: 0.9 }),
    ]);
    expect(fields.filter((f) => f === 'author')).toHaveLength(1);
    expect(evidence).toHaveLength(1);
  });

  it('matches across a curly/straight apostrophe difference (recall)', async () => {
    const { evidence } = await assist(
      [P({ field: 'title', value: "Cat's Cradle Study", evidenceSnippet: 'The Cat’s Cradle Study appears' })],
      { text: 'Reviewed here: The Cat’s Cradle Study appears widely across schools and libraries this year.' },
    );
    expect(evidence).toHaveLength(1);
    expect(evidence[0].field).toBe('title');
  });
});
