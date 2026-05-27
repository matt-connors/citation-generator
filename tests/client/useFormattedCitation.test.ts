// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useFormattedCitation, _resetCacheForTests } from '../../src/lib/citations/useFormattedCitation';

beforeEach(() => {
  _resetCacheForTests();
  globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({
    formatted: [{ text: 'Doe, Jane. ' }, { text: 'Title', italic: true }, { text: '.' }],
  }), { status: 200, headers: { 'content-type': 'application/json' } })) as any;
});

describe('useFormattedCitation', () => {
  it('fetches and returns formatted rich text', async () => {
    const csl = { id: 'u1', type: 'webpage' as const, title: 'Title' };
    const { result } = renderHook(() => useFormattedCitation({ uuid: 'u1', csl }, 'mla-9'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.formatted).toEqual([
      { text: 'Doe, Jane. ' }, { text: 'Title', italic: true }, { text: '.' },
    ]);
    expect(result.current.error).toBeNull();
  });

  it('caches by (uuid, style) so a second call does not refetch', async () => {
    const csl = { id: 'u1', type: 'webpage' as const, title: 'Title' };
    const { result: r1, rerender } = renderHook(
      ({ s }) => useFormattedCitation({ uuid: 'u1', csl }, s as any),
      { initialProps: { s: 'mla-9' } },
    );
    await waitFor(() => expect(r1.current.loading).toBe(false));
    const callsAfterFirst = (globalThis.fetch as any).mock.calls.length;
    rerender({ s: 'mla-9' });
    await waitFor(() => expect(r1.current.loading).toBe(false));
    expect((globalThis.fetch as any).mock.calls.length).toBe(callsAfterFirst);
  });

  it('refetches when the same uuid has different csl content (edit flow)', async () => {
    // Bug regression: cache was keyed by (uuid, style) only, so editing a citation
    // returned stale formatted output. Cache now must include CSL content.
    let callCount = 0;
    globalThis.fetch = vi.fn(async () => {
      callCount += 1;
      return new Response(JSON.stringify({
        formatted: [{ text: callCount === 1 ? 'first' : 'second' }],
      }), { status: 200 });
    }) as any;

    const initial = { id: 'u1', type: 'webpage' as const, title: 'Title A' };
    const edited = { id: 'u1', type: 'webpage' as const, title: 'Title B' };

    const { result, rerender } = renderHook(
      ({ csl }) => useFormattedCitation({ uuid: 'u1', csl }, 'mla-9'),
      { initialProps: { csl: initial } },
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.formatted.map(r => r.text).join('')).toBe('first');

    rerender({ csl: edited });
    await waitFor(() => expect(result.current.formatted.map(r => r.text).join('')).toBe('second'));
    expect(callCount).toBe(2);
  });

  it('cache distinguishes citations whose only difference is in a nested field', async () => {
    // Regression: a first attempt at the fingerprint sort used
    // `JSON.stringify(csl, Object.keys(csl).sort())`. The array-replacer
    // form of JSON.stringify is an allow-list applied at every nesting
    // level, so nested keys (author[].family, author[].given,
    // issued.date-parts) were dropped from the fingerprint and edits
    // to nested fields silently hit the stale cache.
    let callCount = 0;
    const responses = ['Smith citation', 'Jones citation'];
    globalThis.fetch = vi.fn(async () => {
      const body = JSON.stringify({ formatted: [{ text: responses[callCount] }] });
      callCount += 1;
      return new Response(body, { status: 200 });
    }) as any;

    const initial = {
      id: 'u1', type: 'webpage' as const, title: 'T',
      author: [{ family: 'Smith', given: 'John' }],
    };
    const edited = {
      id: 'u1', type: 'webpage' as const, title: 'T',
      author: [{ family: 'Jones', given: 'John' }],
    };

    const { result, rerender } = renderHook(
      ({ csl }) => useFormattedCitation({ uuid: 'u1', csl }, 'mla-9'),
      { initialProps: { csl: initial } },
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.formatted.map((r) => r.text).join('')).toBe('Smith citation');

    rerender({ csl: edited });
    await waitFor(() =>
      expect(result.current.formatted.map((r) => r.text).join('')).toBe('Jones citation'),
    );
    expect(callCount).toBe(2);
  });

  it('cache is insensitive to CSL key insertion order', async () => {
    // Regression: cslFingerprint used JSON.stringify(csl) without sorting
    // keys, so two CSL items with identical content but different insertion
    // order produced different cache keys, causing cache misses when an
    // edit-and-respread reordered fields.
    let callCount = 0;
    globalThis.fetch = vi.fn(async () => {
      callCount += 1;
      return new Response(JSON.stringify({
        formatted: [{ text: 'ok' }],
      }), { status: 200 });
    }) as any;

    const initial = { id: 'u1', type: 'webpage' as const, title: 'T', URL: 'https://x.com' };
    const reordered = { URL: 'https://x.com', title: 'T', type: 'webpage' as const, id: 'u1' };

    const { result, rerender } = renderHook(
      ({ csl }) => useFormattedCitation({ uuid: 'u1', csl }, 'mla-9'),
      { initialProps: { csl: initial } },
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(callCount).toBe(1);

    rerender({ csl: reordered });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(callCount).toBe(1);
  });

  it('surfaces an error when /api/format returns non-200', async () => {
    globalThis.fetch = vi.fn(async () => new Response('boom', { status: 500 })) as any;
    const csl = { id: 'u2', type: 'webpage' as const, title: 'X' };
    const { result } = renderHook(() => useFormattedCitation({ uuid: 'u2', csl }, 'mla-9'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeTruthy();
  });
});
