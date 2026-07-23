import { describe, it, expect } from 'vitest';
import * as cheerio from 'cheerio';
import {
  collectPageTypeHints,
  inferSourceType,
  isGovernmentHost,
  isNewsHost,
  isYouTubeHost,
} from '../../functions/lib/extract/infer-type';

describe('inferSourceType', () => {
  it('promotes journal landing pages with scholarly locators', () => {
    const result = inferSourceType({
      'container-title': 'Nature',
      volume: '12',
      title: 'A Study',
    }, 'https://example.com/article');
    expect(result.type).toBe('article-journal');
    expect(result.fieldPatches).toEqual({});
  });

  it('detects YouTube hosts and applies APA video field patches', () => {
    const result = inferSourceType(
      { title: 'A Video', author: [{ literal: 'Channel Name' }] },
      'https://www.youtube.com/watch?v=abc123',
    );
    expect(result.type).toBe('webpage');
    expect(result.fieldPatches).toEqual({
      genre: 'Video',
      'container-title': 'YouTube',
    });
  });

  it('detects youtu.be short links', () => {
    const result = inferSourceType({ title: 'Clip' }, 'https://youtu.be/abc123');
    expect(result.type).toBe('webpage');
    expect(result.fieldPatches.genre).toBe('Video');
    expect(result.fieldPatches['container-title']).toBe('YouTube');
  });

  it('classifies NewsArticle schema as article-newspaper', () => {
    const result = inferSourceType(
      { title: 'Breaking', author: [{ family: 'Doe', given: 'Jane' }] },
      'https://example.com/story',
      { schemaTypes: ['NewsArticle'] },
    );
    expect(result.type).toBe('article-newspaper');
  });

  it('classifies known news hosts with article signals as article-newspaper', () => {
    const result = inferSourceType(
      { title: 'Headline', 'container-title': 'AP News' },
      'https://apnews.com/article/xyz',
      { schemaTypes: [], ogType: 'article' },
    );
    expect(result.type).toBe('article-newspaper');
  });

  it('keeps ordinary websites as webpage', () => {
    const result = inferSourceType(
      { title: 'Docs', 'container-title': 'Example Docs' },
      'https://docs.example.com/guide',
      { schemaTypes: ['WebPage'], ogType: 'website' },
    );
    expect(result.type).toBe('webpage');
    expect(result.warnings).toEqual([]);
  });

  it('emits choose-source-type for ambiguous .gov pages without forcing report', () => {
    const result = inferSourceType(
      { title: 'Diabetes Basics', author: [{ literal: 'CDC' }] },
      'https://www.cdc.gov/diabetes/about/index.html',
      { schemaTypes: ['WebPage'] },
    );
    expect(result.type).toBe('webpage');
    expect(result.warnings).toEqual([
      expect.objectContaining({
        code: 'source_type_ambiguous',
        action: 'choose-source-type',
        severity: 'review',
      }),
    ]);
  });

  it('does not warn for non-government webpages', () => {
    const result = inferSourceType(
      { title: 'Blog Post' },
      'https://example.com/post',
    );
    expect(result.warnings).toEqual([]);
  });
});

describe('host helpers', () => {
  it('recognizes YouTube hosts', () => {
    expect(isYouTubeHost('www.youtube.com')).toBe(true);
    expect(isYouTubeHost('youtu.be')).toBe(true);
    expect(isYouTubeHost('music.youtube.com')).toBe(true);
    expect(isYouTubeHost('notyoutube.com')).toBe(false);
  });

  it('recognizes government hosts', () => {
    expect(isGovernmentHost('www.cdc.gov')).toBe(true);
    expect(isGovernmentHost('nhs.gov.uk')).toBe(true);
    expect(isGovernmentHost('example.com')).toBe(false);
  });

  it('recognizes news hosts', () => {
    expect(isNewsHost('www.theguardian.com')).toBe(true);
    expect(isNewsHost('apnews.com')).toBe(true);
    expect(isNewsHost('example.com')).toBe(false);
  });
});

describe('collectPageTypeHints', () => {
  it('collects schema.org types and og:type', () => {
    const html = `<!doctype html><html><head>
      <meta property="og:type" content="article" />
      <script type="application/ld+json">${JSON.stringify({
        '@type': 'NewsArticle',
        headline: 'H',
      })}</script>
    </head></html>`;
    const $ = cheerio.load(html);
    const hints = collectPageTypeHints($);
    expect(hints.ogType).toBe('article');
    expect(hints.schemaTypes).toContain('NewsArticle');
  });
});
