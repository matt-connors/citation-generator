// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useReferences } from '../../src/lib/references/useReferences';
import { STORAGE_KEY } from '../../src/lib/references/storage';

beforeEach(() => {
  localStorage.clear();
  Object.defineProperty(window, 'location', {
    writable: true,
    value: new URL('http://localhost/my-references'),
  });
  globalThis.fetch = vi.fn() as any;
});

describe('useReferences', () => {
  it('starts empty when localStorage is empty', async () => {
    const { result } = renderHook(() => useReferences());
    await waitFor(() => expect(result.current.sourceCount).toBe(0));
  });

  it('loads existing v2 sources', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([
      { uuid: 'u1', csl: { id: 'u1', type: 'webpage', title: 'T' } },
    ]));
    const { result } = renderHook(() => useReferences());
    await waitFor(() => expect(result.current.sourceCount).toBe(1));
    expect(result.current.sources[0].uuid).toBe('u1');
  });

  it('silently ignores legacy v1 sources', async () => {
    localStorage.setItem('sources', JSON.stringify([{ uuid: 'old', citationType: 'website', citationInfo: {} }]));
    const { result } = renderHook(() => useReferences());
    await waitFor(() => expect(result.current.sourceCount).toBe(0));
  });

  it('fetches /api/cite-website when ?website= present', async () => {
    Object.defineProperty(window, 'location', {
      writable: true,
      value: new URL('http://localhost/my-references?website=https://x.com/p'),
    });
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({
      uuid: 'https://x.com/p',
      type: 'webpage',
      csl: { id: 'u', type: 'webpage', title: 'T' },
    }), { status: 200 })) as any;
    const { result } = renderHook(() => useReferences());
    await waitFor(() => expect(result.current.sourceCount).toBe(1));
    expect((globalThis.fetch as any).mock.calls[0][0]).toContain('/api/cite-website');
  });

  it('stores citation quality metadata returned by cite endpoints', async () => {
    Object.defineProperty(window, 'location', {
      writable: true,
      value: new URL('http://localhost/my-references?website=https://x.com/p'),
    });
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({
      uuid: 'https://x.com/p',
      type: 'webpage',
      csl: { id: 'u', type: 'webpage', title: 'T' },
      _quality: {
        score: 90,
        warnings: [{
          code: 'author_not_found',
          field: 'author',
          severity: 'review',
          message: 'No author was found.',
          action: 'confirm-no-listed-author',
        }],
      },
      _provenance: {
        title: {
          winner: { field: 'title', normalizedValue: 'T', source: 'heuristic', confidence: 0.4 },
          candidates: [],
          conflicts: [],
        },
      },
    }), { status: 200 })) as any;

    const { result } = renderHook(() => useReferences());
    await waitFor(() => expect(result.current.sourceCount).toBe(1));

    expect(result.current.sources[0].quality?.warnings[0].code).toBe('author_not_found');
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    expect(saved[0].quality.warnings[0].code).toBe('author_not_found');
  });

  it('creates a reviewable placeholder when website fetching is blocked', async () => {
    Object.defineProperty(window, 'location', {
      writable: true,
      value: new URL('http://localhost/my-references?website=https://blocked.example/p'),
    });
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({
      code: 'blocked',
      error: 'Access denied',
    }), { status: 400 })) as any;

    const { result } = renderHook(() => useReferences());
    await waitFor(() => expect(result.current.sourceCount).toBe(1));

    expect(result.current.sources[0].csl.URL).toBe('https://blocked.example/p');
    expect(result.current.sources[0].quality?.warnings[0].code).toBe('fetch_blocked');
    expect(result.current.sources[0].quality?.warnings[0].action).toBe('use-extension');
  });

  it('fetches /api/cite-journal when ?journal= present', async () => {
    Object.defineProperty(window, 'location', {
      writable: true,
      value: new URL('http://localhost/my-references?journal=10.1038/s41586-021-03828-1'),
    });
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({
      uuid: '10.1038/s41586-021-03828-1',
      type: 'article-journal',
      csl: { id: 'j', type: 'article-journal', title: 'Journal Article' },
    }), { status: 200 })) as any;
    const { result } = renderHook(() => useReferences());
    await waitFor(() => expect(result.current.sourceCount).toBe(1));
    expect((globalThis.fetch as any).mock.calls[0][0])
      .toBe('/api/cite-journal?doi=10.1038%2Fs41586-021-03828-1');
  });

  it('also accepts ?doi= as a journal lookup alias', async () => {
    Object.defineProperty(window, 'location', {
      writable: true,
      value: new URL('http://localhost/my-references?doi=10.1038/s41586-021-03828-1'),
    });
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({
      uuid: '10.1038/s41586-021-03828-1',
      type: 'article-journal',
      csl: { id: 'j', type: 'article-journal', title: 'Journal Article' },
    }), { status: 200 })) as any;
    const { result } = renderHook(() => useReferences());
    await waitFor(() => expect(result.current.sourceCount).toBe(1));
    expect((globalThis.fetch as any).mock.calls[0][0]).toContain('/api/cite-journal');
  });

  it('setCitationFormat updates state', async () => {
    const { result } = renderHook(() => useReferences());
    await waitFor(() => expect(result.current.citationFormat).toBe('mla-9'));
    act(() => result.current.setCitationFormat('apa-7'));
    expect(result.current.citationFormat).toBe('apa-7');
  });

  describe('selection (uuid-based, not DOM indices)', () => {
    beforeEach(() => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([
        { uuid: 'a', csl: { id: 'a', type: 'webpage', title: 'A' } },
        { uuid: 'b', csl: { id: 'b', type: 'webpage', title: 'B' } },
        { uuid: 'c', csl: { id: 'c', type: 'webpage', title: 'C' } },
      ]));
    });

    it('toggleSelected adds and removes uuids; selectedCount tracks size', async () => {
      const { result } = renderHook(() => useReferences());
      await waitFor(() => expect(result.current.sourceCount).toBe(3));
      expect(result.current.selectedCount).toBe(0);

      act(() => result.current.toggleSelected('a', true));
      act(() => result.current.toggleSelected('c', true));
      expect(result.current.selectedCount).toBe(2);
      expect(result.current.selected.has('a')).toBe(true);
      expect(result.current.selected.has('b')).toBe(false);
      expect(result.current.selected.has('c')).toBe(true);

      act(() => result.current.toggleSelected('a', false));
      expect(result.current.selectedCount).toBe(1);
      expect(result.current.selected.has('a')).toBe(false);
    });

    it('selectAll(true) selects every source; selectAll(false) clears', async () => {
      const { result } = renderHook(() => useReferences());
      await waitFor(() => expect(result.current.sourceCount).toBe(3));

      act(() => result.current.selectAll(true));
      expect(result.current.selectedCount).toBe(3);
      ['a', 'b', 'c'].forEach((u) => expect(result.current.selected.has(u)).toBe(true));

      act(() => result.current.selectAll(false));
      expect(result.current.selectedCount).toBe(0);
    });

    it('handleDelete removes only selected uuids and clears selection', async () => {
      const { result } = renderHook(() => useReferences());
      await waitFor(() => expect(result.current.sourceCount).toBe(3));

      act(() => result.current.toggleSelected('b', true));
      act(() => result.current.handleDelete());

      expect(result.current.sources.map((s) => s.uuid)).toEqual(['a', 'c']);
      expect(result.current.selectedCount).toBe(0);
    });

    it('selectAll captured before sources arrive still selects the new sources', async () => {
      // Regression: selectAll was useCallback([sources]) — a render that captured
      // the callback before a fetch added new uuids would operate on the stale
      // snapshot and miss the in-flight source. Now reads sources via a ref so
      // the captured reference always sees the latest list.
      localStorage.clear();
      const { result } = renderHook(() => useReferences());
      await waitFor(() => expect(result.current.sourceCount).toBe(0));

      const staleSelectAll = result.current.selectAll;
      act(() => result.current.setSources([
        { uuid: 'x', csl: { id: 'x', type: 'webpage', title: 'X' } },
        { uuid: 'y', csl: { id: 'y', type: 'webpage', title: 'Y' } },
      ]));

      act(() => staleSelectAll(true));
      expect(result.current.selectedCount).toBe(2);
      expect(result.current.selected.has('x')).toBe(true);
      expect(result.current.selected.has('y')).toBe(true);
    });

    it('selection survives list reordering by uuid (not index)', async () => {
      const { result } = renderHook(() => useReferences());
      await waitFor(() => expect(result.current.sourceCount).toBe(3));

      act(() => result.current.toggleSelected('b', true));
      // Reorder: move 'b' to front
      act(() => result.current.setSources((prev) => [prev[1], prev[0], prev[2]]));

      // 'b' still selected even though its index changed from 1 to 0
      expect(result.current.selected.has('b')).toBe(true);
      expect(result.current.selectedCount).toBe(1);
    });
  });
});
