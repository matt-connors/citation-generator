import { describe, it, expect } from 'vitest';
import * as cheerio from 'cheerio';
import { twitterSignal } from '../../../functions/lib/extract/signals/twitter';

describe('twitterSignal', () => {
  it('reads twitter:title', () => {
    const $ = cheerio.load(`<meta name="twitter:title" content="T Title" />`);
    expect(twitterSignal($).fields.title).toBe('T Title');
  });

  it('reads twitter:site as container-title', () => {
    const $ = cheerio.load(`<meta name="twitter:site" content="@nyt" />`);
    expect(twitterSignal($).fields['container-title']).toBeUndefined();

    const $2 = cheerio.load(`<meta name="twitter:site" content="The New York Times" />`);
    expect(twitterSignal($2).fields['container-title']).toBe('The New York Times');
  });

  it('returns empty when no twitter tags', () => {
    expect(twitterSignal(cheerio.load(`<html></html>`)).fields).toEqual({});
  });
});
