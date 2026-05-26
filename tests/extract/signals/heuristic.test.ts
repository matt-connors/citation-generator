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

  it('reads <time datetime>', () => {
    const $ = cheerio.load(`<time datetime="2026-05-26">May 26</time>`);
    expect(heuristicSignal($).fields.issued).toEqual({ 'date-parts': [[2026, 5, 26]] });
  });

  it('returns empty when nothing present', () => {
    expect(heuristicSignal(cheerio.load(`<html></html>`)).fields).toEqual({});
  });
});
