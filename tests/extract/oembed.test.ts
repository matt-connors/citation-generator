import { describe, it, expect } from 'vitest';
import { oembedEndpointFor, shouldRunOembedAssist, runOembedAssist, tiktokDateFromUrl } from '../../functions/lib/extract/oembed';
import type { CSLItem } from '../../functions/lib/csl-types';

// Real payload shape returned by cdn.syndication.twimg.com/tweet-result for
// x.com/jack/status/20.
const X_PAYLOAD = {
  __typename: 'Tweet',
  id_str: '20',
  text: 'just setting up my twttr',
  created_at: '2006-03-21T20:50:14.000Z',
  display_text_range: [0, 24],
  user: { name: 'jack', screen_name: 'jack' },
};

const TIKTOK_PAYLOAD = {
  version: '1.0',
  type: 'video',
  title: 'Fighting fire with fire. #sciencetok #learnontiktok',
  author_url: 'https://www.tiktok.com/@chemteacherphil',
  author_name: 'Phillip Cook',
};

const YOUTUBE_PAYLOAD = {
  title: 'Me at the zoo',
  author_name: 'jawed',
  author_url: 'https://www.youtube.com/@jawed',
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

function bareItem(url: string): CSLItem {
  return { id: url, type: 'webpage', URL: url };
}

describe('oembedEndpointFor', () => {
  it('maps X status URLs (x.com and twitter.com) to the syndication API', () => {
    expect(oembedEndpointFor('https://x.com/jack/status/20')).toContain('cdn.syndication.twimg.com/tweet-result');
    expect(oembedEndpointFor('https://x.com/jack/status/20')).toContain('id=20');
    expect(oembedEndpointFor('https://twitter.com/jack/status/20')).toContain('cdn.syndication.twimg.com');
  });

  it('does not fire for X profile pages', () => {
    expect(oembedEndpointFor('https://x.com/jack')).toBeNull();
  });

  it('maps TikTok video URLs and YouTube watch URLs', () => {
    expect(oembedEndpointFor('https://www.tiktok.com/@x/video/123')).toContain('tiktok.com/oembed');
    expect(oembedEndpointFor('https://www.youtube.com/watch?v=abc')).toContain('youtube.com/oembed');
    expect(oembedEndpointFor('https://youtu.be/abc')).toContain('youtube.com/oembed');
  });

  it('ignores other hosts and malformed URLs', () => {
    expect(oembedEndpointFor('https://example.com/a')).toBeNull();
    expect(oembedEndpointFor('not a url')).toBeNull();
  });
});

describe('shouldRunOembedAssist', () => {
  it('runs when title or author is missing on a platform URL', () => {
    expect(shouldRunOembedAssist(bareItem('https://x.com/jack/status/20'), 'https://x.com/jack/status/20')).toBe(true);
  });

  it('skips when the HTML extraction already produced title and author', () => {
    const csl: CSLItem = {
      ...bareItem('https://www.tiktok.com/@x/video/1'),
      title: 'caption',
      author: [{ family: 'Cook', given: 'Phillip' }],
    };
    expect(shouldRunOembedAssist(csl, 'https://www.tiktok.com/@x/video/1')).toBe(false);
  });

  it('never runs for non-platform URLs', () => {
    expect(shouldRunOembedAssist(bareItem('https://example.com'), 'https://example.com')).toBe(false);
  });
});

describe('tiktokDateFromUrl', () => {
  it('recovers the posting date from the video ID timestamp bits', () => {
    // 7008953610872605957 >> 32 === 1631899180 === 2021-09-17 UTC.
    expect(tiktokDateFromUrl('https://www.tiktok.com/@chemteacherphil/video/7008953610872605957'))
      .toEqual([2021, 9, 17]);
  });

  it('returns null for a URL without a video ID', () => {
    expect(tiktokDateFromUrl('https://www.tiktok.com/@chemteacherphil')).toBeNull();
  });

  it('rejects an out-of-range (pre-2015) timestamp', () => {
    // A small numeric ID shifts to a timestamp near the Unix epoch.
    expect(tiktokDateFromUrl('https://www.tiktok.com/@x/video/123456')).toBeNull();
  });
});

describe('runOembedAssist: X (syndication)', () => {
  it('extracts post text, author, handle, date, and container', async () => {
    const result = await runOembedAssist('https://x.com/jack/status/20', {
      fetchFn: async () => jsonResponse(X_PAYLOAD),
      acquiredAt: '2026-07-06T00:00:00.000Z',
    });
    expect(result).not.toBeNull();
    const byField = Object.fromEntries(result!.evidence.map((e) => [e.field, e.normalizedValue]));
    expect(byField.title).toBe('just setting up my twttr');
    expect(byField.author).toEqual([{ family: 'jack' }]);
    expect(byField.issued).toEqual({ 'date-parts': [[2006, 3, 21]] });
    expect(byField['container-title']).toBe('X');
    expect(result!.social).toEqual({ platform: 'x', handle: 'jack', displayName: 'jack', kind: 'post' });
    for (const e of result!.evidence) {
      expect(e.source).toBe('oembed');
      expect(e.acquisition).toBe('authority');
    }
  });

  it('trims trailing media t.co links using display_text_range', async () => {
    const payload = {
      __typename: 'Tweet',
      text: 'Look at this photo https://t.co/abc123',
      created_at: '2023-11-23T00:00:00.000Z',
      display_text_range: [0, 18],
      user: { name: 'NASA', screen_name: 'NASA' },
    };
    const result = await runOembedAssist('https://x.com/NASA/status/1', { fetchFn: async () => jsonResponse(payload) });
    const byField = Object.fromEntries(result!.evidence.map((e) => [e.field, e.normalizedValue]));
    expect(byField.title).toBe('Look at this photo');
    expect(byField.author).toEqual([{ literal: 'NASA' }]);
  });

  it('returns null for a deleted post (TweetTombstone) — fail honestly, do not invent', async () => {
    const tombstone = { __typename: 'TweetTombstone', tombstone: { text: { text: 'This Post was deleted' } } };
    const result = await runOembedAssist('https://x.com/x/status/1', { fetchFn: async () => jsonResponse(tombstone) });
    expect(result).toBeNull();
  });
});

describe('runOembedAssist: TikTok', () => {
  it('supplies caption, creator, and the URL-derived posting date', async () => {
    const result = await runOembedAssist('https://www.tiktok.com/@chemteacherphil/video/7008953610872605957', {
      fetchFn: async () => jsonResponse(TIKTOK_PAYLOAD),
    });
    const byField = Object.fromEntries(result!.evidence.map((e) => [e.field, e.normalizedValue]));
    expect(byField.title).toBe('Fighting fire with fire. #sciencetok #learnontiktok');
    expect(byField.author).toEqual([{ family: 'Cook', given: 'Phillip' }]);
    expect(byField.issued).toEqual({ 'date-parts': [[2021, 9, 17]] });
    expect(result!.social?.handle).toBe('chemteacherphil');
  });
});

describe('runOembedAssist: YouTube', () => {
  it('supplies title and channel as a literal author (no date from oEmbed)', async () => {
    const result = await runOembedAssist('https://www.youtube.com/watch?v=jNQXAC9IVRw', {
      fetchFn: async () => jsonResponse(YOUTUBE_PAYLOAD),
    });
    const byField = Object.fromEntries(result!.evidence.map((e) => [e.field, e.normalizedValue]));
    expect(byField.title).toBe('Me at the zoo');
    expect(byField.author).toEqual([{ literal: 'jawed' }]);
    expect(byField.issued).toBeUndefined();
    expect(result!.social).toEqual({ platform: 'youtube', handle: 'jawed', displayName: 'jawed', kind: 'video' });
  });
});

describe('runOembedAssist: failure paths', () => {
  it('returns null on a non-200 response', async () => {
    const result = await runOembedAssist('https://x.com/jack/status/20', {
      fetchFn: async () => jsonResponse({}, 404),
    });
    expect(result).toBeNull();
  });

  it('returns null when fetch throws', async () => {
    const result = await runOembedAssist('https://x.com/jack/status/20', {
      fetchFn: async () => { throw new Error('network'); },
    });
    expect(result).toBeNull();
  });

  it('returns null on a non-JSON body', async () => {
    const result = await runOembedAssist('https://x.com/jack/status/20', {
      fetchFn: async () => new Response('<html>error page</html>', { status: 200 }),
    });
    expect(result).toBeNull();
  });
});
