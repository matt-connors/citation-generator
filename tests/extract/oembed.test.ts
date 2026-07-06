import { describe, it, expect } from 'vitest';
import { oembedEndpointFor, shouldRunOembedAssist, runOembedAssist } from '../../functions/lib/extract/oembed';
import type { CSLItem } from '../../functions/lib/csl-types';

// Real payload shape returned by publish.twitter.com/oembed for x.com/jack/status/20.
const X_PAYLOAD = {
  url: 'https://x.com/jack/status/20',
  author_name: 'jack',
  author_url: 'https://x.com/jack',
  html: '<blockquote class="twitter-tweet"><p lang="en" dir="ltr">just setting up my twttr</p>&mdash; jack (@jack) <a href="https://x.com/jack/status/20?ref_src=twsrc%5Etfw">March 21, 2006</a></blockquote>\n',
  provider_name: 'X',
  version: '1.0',
};

const TIKTOK_PAYLOAD = {
  version: '1.0',
  type: 'video',
  title: 'Fighting fire with fire. #sciencetok #learnontiktok',
  author_url: 'https://www.tiktok.com/@chemteacherphil',
  author_name: 'Phillip Cook',
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

function bareItem(url: string): CSLItem {
  return { id: url, type: 'webpage', URL: url };
}

describe('oembedEndpointFor', () => {
  it('maps X status URLs (x.com and twitter.com) to publish.twitter.com', () => {
    expect(oembedEndpointFor('https://x.com/jack/status/20')).toContain('publish.twitter.com/oembed');
    expect(oembedEndpointFor('https://twitter.com/jack/status/20')).toContain('publish.twitter.com/oembed');
  });

  it('does not fire for X profile pages', () => {
    expect(oembedEndpointFor('https://x.com/jack')).toBeNull();
  });

  it('maps TikTok video URLs and YouTube watch URLs', () => {
    expect(oembedEndpointFor('https://www.tiktok.com/@x/video/123')).toContain('tiktok.com/oembed');
    expect(oembedEndpointFor('https://www.youtube.com/watch?v=abc')).toContain('youtube.com/oembed');
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

describe('runOembedAssist: X', () => {
  it('extracts post text, author, handle, date, and container from the embed html', async () => {
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

  it('flattens multi-line posts into a single-line title', async () => {
    const payload = {
      ...X_PAYLOAD,
      html: '<blockquote class="twitter-tweet"><p>line one<br>line two</p>&mdash; NASA (@NASA) <a href="https://x.com/NASA/status/1">November 23, 2023</a></blockquote>',
      author_name: 'NASA',
      author_url: 'https://x.com/NASA',
    };
    const result = await runOembedAssist('https://x.com/NASA/status/1', {
      fetchFn: async () => jsonResponse(payload),
    });
    const byField = Object.fromEntries(result!.evidence.map((e) => [e.field, e.normalizedValue]));
    expect(byField.title).toBe('line one line two');
    expect(byField.author).toEqual([{ literal: 'NASA' }]);
  });
});

describe('runOembedAssist: TikTok', () => {
  it('supplies caption and creator (no date — oEmbed does not carry one)', async () => {
    const result = await runOembedAssist('https://www.tiktok.com/@chemteacherphil/video/7008953610872605957', {
      fetchFn: async () => jsonResponse(TIKTOK_PAYLOAD),
    });
    const byField = Object.fromEntries(result!.evidence.map((e) => [e.field, e.normalizedValue]));
    expect(byField.title).toBe('Fighting fire with fire. #sciencetok #learnontiktok');
    expect(byField.author).toEqual([{ family: 'Cook', given: 'Phillip' }]);
    expect(byField.issued).toBeUndefined();
    expect(result!.social?.handle).toBe('chemteacherphil');
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
