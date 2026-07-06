import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as cheerio from 'cheerio';
import { platformSignal } from '../../../functions/lib/extract/signals/platform';

const FIXTURES = join(__dirname, '..', 'fixtures');

function loadFixture(name: string) {
  const html = readFileSync(join(FIXTURES, name, 'input.html'), 'utf-8');
  const url = readFileSync(join(FIXTURES, name, 'input.url'), 'utf-8').trim();
  return { $: cheerio.load(html), url };
}

// Synthetic TikTok page with the same hydration-blob shape as the real capture.
function tiktokHtml(itemStruct: Record<string, unknown>): string {
  const blob = JSON.stringify({
    __DEFAULT_SCOPE__: {
      'webapp.video-detail': { itemInfo: { itemStruct } },
    },
  });
  return `<html><head><script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application/json">${blob}</script></head><body></body></html>`;
}

describe('platformSignal: TikTok', () => {
  it('extracts creator, caption, exact date, and canonical URL from the real capture', () => {
    const { $, url } = loadFixture('tiktok-video');
    const r = platformSignal($, url);
    expect(r.fields.title).toBe('Fighting fire with fire. #sciencetok #learnontiktok');
    expect(r.fields.author).toEqual([{ family: 'Cook', given: 'Phillip' }]);
    // createTime 1631899181 → 2021-09-17 UTC, matching APA Style's own
    // published example for this exact video.
    expect(r.fields.issued).toEqual({ 'date-parts': [[2021, 9, 17]] });
    expect(r.fields['container-title']).toBe('TikTok');
    expect(r.fields.URL).toBe('https://www.tiktok.com/@chemteacherphil/video/7008953610872605957');
    expect(r.social).toEqual({
      platform: 'tiktok',
      handle: 'chemteacherphil',
      displayName: 'Phillip Cook',
      kind: 'video',
    });
  });

  it('keeps a display name literal when it is just the handle with spacing', () => {
    const $ = cheerio.load(tiktokHtml({
      desc: 'a video',
      createTime: '1631899181',
      id: '123',
      author: { nickname: 'Everyday Astronaut', uniqueId: 'everydayastronaut' },
    }));
    const r = platformSignal($, 'https://www.tiktok.com/@everydayastronaut/video/123');
    expect(r.fields.author).toEqual([{ literal: 'Everyday Astronaut' }]);
  });

  it('falls back to the @handle when no display name exists', () => {
    const $ = cheerio.load(tiktokHtml({
      desc: 'a video',
      createTime: '1631899181',
      id: '123',
      author: { uniqueId: 'somehandle' },
    }));
    const r = platformSignal($, 'https://www.tiktok.com/@somehandle/video/123');
    expect(r.fields.author).toEqual([{ literal: '@somehandle' }]);
  });

  it('returns nothing for a TikTok bot-wall page without the hydration blob', () => {
    const $ = cheerio.load('<html><head><title>TikTok</title></head></html>');
    const r = platformSignal($, 'https://www.tiktok.com/@x/video/1');
    expect(r.fields).toEqual({});
    expect(r.social).toBeUndefined();
  });
});

describe('platformSignal: YouTube', () => {
  it('extracts title, literal channel author, handle, and upload date from the real capture', () => {
    const { $, url } = loadFixture('youtube-watch');
    const r = platformSignal($, url);
    expect(r.fields.title).toBe('Me at the zoo');
    // Channel names are labels, not person names — must never invert.
    expect(r.fields.author).toEqual([{ literal: 'jawed' }]);
    expect(r.fields.issued).toEqual({ 'date-parts': [[2005, 4, 23]] });
    expect(r.fields['container-title']).toBe('YouTube');
    expect(r.social?.platform).toBe('youtube');
    expect(r.social?.handle).toBe('jawed');
  });

  it('keeps a multi-word channel name literal', () => {
    const $ = cheerio.load(`
      <html><body>
        <meta itemprop="name" content="Some Video">
        <span itemprop="author" itemscope>
          <link itemprop="url" href="http://www.youtube.com/@chemteacherphil">
          <link itemprop="name" content="Chem Teacher Phil">
        </span>
        <meta itemprop="datePublished" content="2021-09-17">
      </body></html>`);
    const r = platformSignal($, 'https://www.youtube.com/watch?v=abc');
    expect(r.fields.author).toEqual([{ literal: 'Chem Teacher Phil' }]);
    expect(r.fields.title).toBe('Some Video');
  });
});

describe('platformSignal: Instagram', () => {
  it('parses author, caption, handle, and date out of the og strings (real capture)', () => {
    const { $, url } = loadFixture('instagram-post');
    const r = platformSignal($, url);
    expect(r.fields.title).toBe('I love @spacecenterhou! Some of the best Spaceflight hardware on display, including a flown @spacex Falcon 9 booster!!!');
    expect(r.fields.author).toEqual([{ literal: 'Everyday Astronaut' }]);
    expect(r.fields.issued).toEqual({ 'date-parts': [[2021, 9, 29]] });
    expect(r.fields['container-title']).toBe('Instagram');
    expect(r.social).toEqual({
      platform: 'instagram',
      handle: 'everydayastronaut',
      displayName: 'Everyday Astronaut',
      kind: 'photo',
    });
  });

  it('marks a Reel as video and parses a person name whose handle differs', () => {
    const $ = cheerio.load(`
      <html><head>
        <meta property="og:title" content='Jane Doe on Instagram: "watch this"' />
        <meta property="og:description" content='12 likes, 1 comments - jdoe_pics on January 5, 2026: "watch this"' />
        <meta property="og:url" content="https://www.instagram.com/jdoe_pics/reel/XYZ/" />
      </head></html>`);
    const r = platformSignal($, 'https://www.instagram.com/reel/XYZ/');
    expect(r.social?.kind).toBe('video');
    expect(r.fields.author).toEqual([{ family: 'Doe', given: 'Jane' }]);
  });

  it('keeps a person-shaped display name literal when the handle is just the name', () => {
    // Deliberate trade-off: "Jane Doe" @janedoe COULD be a person, but the
    // same shape is how brands present ("Everyday Astronaut"
    // @everydayastronaut), and mis-inverting a brand is worse than leaving a
    // person un-inverted. The my-references editor lets the user flip it.
    const $ = cheerio.load(`
      <html><head>
        <meta property="og:title" content='Jane Doe on Instagram: "hello"' />
        <meta property="og:description" content='12 likes, 1 comments - janedoe on January 5, 2026: "hello"' />
        <meta property="og:url" content="https://www.instagram.com/janedoe/p/XYZ/" />
      </head></html>`);
    const r = platformSignal($, 'https://www.instagram.com/p/XYZ/');
    expect(r.fields.author).toEqual([{ literal: 'Jane Doe' }]);
  });
});

describe('platformSignal: other hosts', () => {
  it('does nothing on a non-platform host', () => {
    const $ = cheerio.load('<html><head><title>News</title></head></html>');
    const r = platformSignal($, 'https://example.com/article');
    expect(r.fields).toEqual({});
    expect(r.social).toBeUndefined();
  });
});
