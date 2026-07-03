import { describe, it, expect } from 'vitest';
import * as cheerio from 'cheerio';
import { microdataSignal } from '../../../functions/lib/extract/signals/microdata';

describe('microdataSignal', () => {
  it('reads itemprop headline/author/datePublished', () => {
    const $ = cheerio.load(`<article itemscope itemtype="https://schema.org/Article">
      <h1 itemprop="headline">My headline</h1>
      <span itemprop="author">Jane Doe</span>
      <time itemprop="datePublished" datetime="2026-05-26"></time>
    </article>`);
    const r = microdataSignal($);
    expect(r.fields.title).toBe('My headline');
    expect(r.fields.author).toEqual([{ family: 'Doe', given: 'Jane' }]);
    expect(r.fields.issued).toEqual({ 'date-parts': [[2026, 5, 26]] });
    expect(r.confidence.title).toBeCloseTo(0.85);
  });

  it('falls back to itemprop=name when headline missing', () => {
    const $ = cheerio.load(`<div itemprop="name">Just a name</div>`);
    const r = microdataSignal($);
    expect(r.fields.title).toBe('Just a name');
  });

  it('reads content attribute when text empty', () => {
    const $ = cheerio.load(`<meta itemprop="datePublished" content="2024-01-15">`);
    const r = microdataSignal($);
    expect(r.fields.issued).toEqual({ 'date-parts': [[2024, 1, 15]] });
  });

  it('collects repeated author itemprops', () => {
    const $ = cheerio.load(`
      <span itemprop="author">Jane Doe</span>
      <span itemprop="author">John Smith</span>
    `);
    expect(microdataSignal($).fields.author).toEqual([
      { family: 'Doe', given: 'Jane' },
      { family: 'Smith', given: 'John' },
    ]);
  });

  it('extracts scholarly metadata itemprops', () => {
    const $ = cheerio.load(`<article itemscope itemtype="https://schema.org/ScholarlyArticle">
      <h1 itemprop="headline">A Microdata Paper</h1>
      <meta itemprop="identifier" content="https://doi.org/10.5555/micro.2026.001." />
      <div itemprop="isPartOf" itemscope>
        <span itemprop="name">Journal of Structured Data</span>
      </div>
      <meta itemprop="volumeNumber" content="8" />
      <meta itemprop="issueNumber" content="4" />
      <meta itemprop="pageStart" content="44" />
      <meta itemprop="pageEnd" content="59" />
      <meta itemprop="abstract" content="A microdata extraction abstract." />
    </article>`);
    const r = microdataSignal($);
    expect(r.fields.DOI).toBe('10.5555/micro.2026.001');
    expect(r.fields['container-title']).toBe('Journal of Structured Data');
    expect(r.fields.volume).toBe('8');
    expect(r.fields.issue).toBe('4');
    expect(r.fields.page).toBe('44-59');
    expect(r.fields.abstract).toBe('A microdata extraction abstract.');
  });

  it('returns empty when nothing matches', () => {
    const $ = cheerio.load(`<html><body><p>plain</p></body></html>`);
    const r = microdataSignal($);
    expect(r.fields).toEqual({});
  });
});
