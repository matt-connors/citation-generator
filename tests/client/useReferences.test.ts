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

  it('setCitationFormat updates state', async () => {
    const { result } = renderHook(() => useReferences());
    await waitFor(() => expect(result.current.citationFormat).toBe('mla-9'));
    act(() => result.current.setCitationFormat('apa-7'));
    expect(result.current.citationFormat).toBe('apa-7');
  });
});
