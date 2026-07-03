import { describe, expect, it } from 'vitest';
import citationStyles from '../../src/components/citationStyles';
import { decodeInlineCslParam } from '../../src/lib/references/inline-csl';
import { SUPPORTED_STYLES } from '../../functions/api/format/handler';

const core = await import('../../chrome-extension/popup-core.mjs');

describe('chrome extension popup core', () => {
  it('accepts only HTTP(S) tab URLs for citation', () => {
    expect(core.isCiteableUrl('https://example.com/article')).toBe(true);
    expect(core.isCiteableUrl('http://example.com/article')).toBe(true);
    expect(core.isCiteableUrl('chrome://extensions')).toBe(false);
    expect(core.isCiteableUrl('file:///C:/tmp/article.html')).toBe(false);
    expect(core.isCiteableUrl('not a url')).toBe(false);
  });

  it('keeps extension style options aligned with app and format API styles', () => {
    expect(core.CITATION_STYLES).toEqual(citationStyles);
    expect(core.CITATION_STYLES.map((style: any) => style.value).sort())
      .toEqual([...SUPPORTED_STYLES].sort());
  });

  it('builds production API and edit URLs with encoded source URLs', () => {
    const page = 'https://example.com/path?a=1&b=two words';
    expect(core.buildFormatApiUrl()).toBe('https://mlagenerator.com/api/format');
    expect(core.buildReferencesUrl('apa-7'))
      .toBe('https://mlagenerator.com/my-references/?citationStyle=apa-7');
    expect(core.buildReferencesUrl('bad-style'))
      .toBe('https://mlagenerator.com/my-references/?citationStyle=mla-9');
    const editUrl = new URL(core.buildEditOnSiteUrl(page, 'apa-7'));
    expect(editUrl.origin + editUrl.pathname).toBe('https://mlagenerator.com/my-references/');
    expect(editUrl.searchParams.get('website')).toBe(page);
    expect(editUrl.searchParams.get('citationStyle')).toBe('apa-7');
  });

  it('can hand exact extension-captured CSL to the references page', () => {
    const page = 'https://example.com/article';
    const csl = {
      id: page,
      type: 'webpage',
      title: 'Unicode & web metadata',
      URL: page,
      abstract: 'This can be long and is not editable on the references page.',
    };
    const editUrl = new URL(core.buildEditOnSiteUrl(page, 'apa-7', csl));
    expect(editUrl.searchParams.has('website')).toBe(false);
    expect(editUrl.searchParams.get('citationStyle')).toBe('apa-7');
    expect(decodeInlineCslParam(editUrl.searchParams.get('csl'))).toEqual({
      uuid: page,
      csl: {
        id: page,
        type: 'webpage',
        title: 'Unicode & web metadata',
        URL: page,
      },
    });
  });

  it('builds source records and updates reference storage without duplicates', () => {
    const source = core.sourceFromCsl({
      id: 'https://example.com/a',
      type: 'webpage',
      title: 'Updated',
      URL: 'https://example.com/a',
      abstract: 'Not imported into editable storage.',
    }, 'https://example.com/a');

    expect(source).toEqual({
      uuid: 'https://example.com/a',
      csl: {
        id: 'https://example.com/a',
        type: 'webpage',
        title: 'Updated',
        URL: 'https://example.com/a',
      },
    });

    expect(core.mergeStoredSources([
      { uuid: 'old', csl: { id: 'old', type: 'webpage' } },
      { uuid: 'https://example.com/a', csl: { id: 'https://example.com/a', type: 'webpage', title: 'Old' } },
    ], source)).toEqual([
      { uuid: 'old', csl: { id: 'old', type: 'webpage' } },
      source,
    ]);
  });

  it('stores bounded citation history with most recent entries first', () => {
    const first = core.historyEntryFromCitation({
      id: 'https://example.com/a',
      type: 'webpage',
      title: 'A',
      URL: 'https://example.com/a',
    }, 'apa-7', 'A citation.', new Date('2026-06-27T10:00:00Z'));
    const second = core.historyEntryFromCitation({
      id: 'https://example.com/b',
      type: 'webpage',
      title: 'B',
      URL: 'https://example.com/b',
    }, 'mla-9', 'B citation.', new Date('2026-06-27T11:00:00Z'));
    const updatedFirst = core.historyEntryFromCitation({
      id: 'https://example.com/a',
      type: 'webpage',
      title: 'A updated',
      URL: 'https://example.com/a',
    }, 'chicago-18', 'A updated citation.', new Date('2026-06-27T12:00:00Z'));

    const history = core.mergeHistoryEntries(
      core.mergeHistoryEntries(core.mergeHistoryEntries([], first), second),
      updatedFirst,
    );

    expect(history.map((entry: any) => entry.id)).toEqual(['https://example.com/a', 'https://example.com/b']);
    expect(history[0]).toMatchObject({
      title: 'A updated',
      style: 'chicago-18',
      plain: 'A updated citation.',
    });
  });

  it('keys saved popup state by tab and loaded URL', () => {
    expect(core.tabStateKey(123, 'https://example.com/article'))
      .toBe('123:https://example.com/article');
    expect(core.tabStateKey(undefined, 'https://example.com/article'))
      .toBe('active:https://example.com/article');
  });

  it('falls back to MLA when edit URL style is unsupported', () => {
    const editUrl = new URL(core.buildEditOnSiteUrl('https://example.com', 'bad-style'));
    expect(editUrl.searchParams.get('website')).toBe('https://example.com');
    expect(editUrl.searchParams.get('citationStyle')).toBe('mla-9');
  });

  it('renders rich citation segments safely', () => {
    const segments = [
      { text: 'A <Title>', italic: true },
      { text: ' & Co.' },
    ];
    expect(core.richTextToHtml(segments)).toBe('<i>A &lt;Title&gt;</i> &amp; Co.');
    expect(core.richTextToPlain(segments)).toBe('A <Title> & Co.');
  });

  it('derives compact tab labels', () => {
    expect(core.tabHost('https://www.example.com/a')).toBe('example.com');
    expect(core.displayTitle({ title: 'Article Title', url: 'https://example.com/a' })).toBe('Article Title');
    expect(core.displayTitle({ title: '', url: 'https://example.com/a' })).toBe('https://example.com/a');
  });
});
