import { describe, it, expect } from 'vitest';
import * as cheerio from 'cheerio';
import { heuristicSignal } from '../../../functions/lib/extract/signals/heuristic';

describe('heuristicSignal', () => {
  it('reads <title>', () => {
    const $ = cheerio.load(`<html><head><title>Page Title</title></head></html>`);
    expect(heuristicSignal($).fields.title).toBe('Page Title');
  });

  it('strips a trailing " | Site Name" from <title>', () => {
    const $ = cheerio.load(`<html><head><title>Article — The Site</title></head></html>`);
    const r = heuristicSignal($);
    expect(r.fields.title).toBe('Article');
  });

  it('reads rel=author link text', () => {
    const $ = cheerio.load(`<a rel="author" href="/x">Jane Doe</a>`);
    expect(heuristicSignal($).fields.author).toEqual([{ family: 'Doe', given: 'Jane' }]);
  });

  it('reads .byline text and strips a leading "By "', () => {
    const $ = cheerio.load(`<div class="byline">By Jane Doe</div>`);
    expect(heuristicSignal($).fields.author).toEqual([{ family: 'Doe', given: 'Jane' }]);
  });

  it('reads multiple authors from flexible byline selectors', () => {
    const $ = cheerio.load(`<div data-testid="article-author">By Jane Doe and John Smith</div>`);
    expect(heuristicSignal($).fields.author).toEqual([
      { family: 'Doe', given: 'Jane' },
      { family: 'Smith', given: 'John' },
    ]);
  });

  it('strips trailing published text from bylines', () => {
    const $ = cheerio.load(`<div class="article-author">By Jane Doe Published May 26, 2026</div>`);
    expect(heuristicSignal($).fields.author).toEqual([{ family: 'Doe', given: 'Jane' }]);
  });

  it('skips a lone role-word byline label and reads the sibling author element', () => {
    // Reported bug (joelonsoftware.com): "by" sits in its own .byline span and the
    // name in a sibling .author span; .first() grabbed "by" → author {family:"by"}.
    // Iterating the candidates skips the empty-parsing "by" and lands on the name.
    const $ = cheerio.load(
      `<span class="byline"> by </span>` +
      `<span class="author vcard"><a class="url fn n" href="/author/x">Joel Spolsky</a></span>`,
    );
    expect(heuristicSignal($).fields.author).toEqual([{ family: 'Spolsky', given: 'Joel' }]);
  });

  it('keeps a "Posted by <name>" single-element byline instead of deleting it', () => {
    // cleanBylineText must not treat a LEADING "Posted" as a trailing date clause.
    const $ = cheerio.load(`<div class="byline">Posted by Joel Spolsky</div>`);
    expect(heuristicSignal($).fields.author).toEqual([{ family: 'Spolsky', given: 'Joel' }]);
  });

  it('reads <time datetime>', () => {
    const $ = cheerio.load(`<time datetime="2026-05-26">May 26</time>`);
    expect(heuristicSignal($).fields.issued).toEqual({ 'date-parts': [[2026, 5, 26]] });
  });

  it('reads a canonical link URL', () => {
    const $ = cheerio.load(`<link rel="canonical" href="/articles/canonical" />`);
    expect(heuristicSignal($).fields.URL).toBe('/articles/canonical');
  });

  it('rejects a canonical URL containing a JS "undefined" artifact segment', () => {
    // YouTube's consent shell serves <link rel="canonical" href=".../undefined">;
    // trusting it would replace the pasted URL with garbage.
    const $ = cheerio.load(`<link rel="canonical" href="https://www.youtube.com/undefined" />`);
    expect(heuristicSignal($).fields.URL).toBeUndefined();
    const $2 = cheerio.load(`<link rel="canonical" href="https://example.com/null" />`);
    expect(heuristicSignal($2).fields.URL).toBeUndefined();
    // …but a path that merely contains the substring is fine.
    const $3 = cheerio.load(`<link rel="canonical" href="https://example.com/undefined-behavior-in-c" />`);
    expect(heuristicSignal($3).fields.URL).toBe('https://example.com/undefined-behavior-in-c');
  });

  it('returns empty when nothing present', () => {
    expect(heuristicSignal(cheerio.load(`<html></html>`)).fields).toEqual({});
  });
});
