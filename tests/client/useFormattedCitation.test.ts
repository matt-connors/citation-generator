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

  it('surfaces an error when /api/format returns non-200', async () => {
    globalThis.fetch = vi.fn(async () => new Response('boom', { status: 500 })) as any;
    const csl = { id: 'u2', type: 'webpage' as const, title: 'X' };
    const { result } = renderHook(() => useFormattedCitation({ uuid: 'u2', csl }, 'mla-9'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeTruthy();
  });
});
