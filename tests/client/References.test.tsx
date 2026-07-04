// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, waitFor, act } from '@testing-library/react';
import React from 'react';
import References from '../../src/components/react/References';
import { _resetCacheForTests } from '../../src/lib/citations/useFormattedCitation';
import { STORAGE_KEY } from '../../src/lib/references/storage';

beforeEach(() => {
  _resetCacheForTests();
  const store: Record<string, string> = {
    [STORAGE_KEY]: JSON.stringify([
      { uuid: 'a', csl: { id: 'a', type: 'webpage', title: 'Alpha' } },
      { uuid: 'b', csl: { id: 'b', type: 'webpage', title: 'Beta' } },
    ]),
  };
  (globalThis as any).localStorage = {
    getItem: (k: string) => (k in store ? store[k] : null),
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { for (const k of Object.keys(store)) delete store[k]; },
  };
  if (!(window as any).matchMedia) {
    (window as any).matchMedia = (query: string) => ({
      matches: false, media: query, onchange: null,
      addListener: () => {}, removeListener: () => {},
      addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false,
    });
  }
  globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({ formatted: [{ text: 'X' }] }), { status: 200 })) as any;
});

describe('References selection label', () => {
  it('shows the SELECTED count, not the total, when references are selected', async () => {
    const { container } = render(<References />);
    const sel = 'input[type="checkbox"][aria-label^="Select reference"]';
    // Both stored sources load from localStorage.
    await waitFor(() => expect(container.querySelectorAll(sel).length).toBe(2));
    const boxes = container.querySelectorAll(sel);

    fireEvent.click(boxes[0]);
    await waitFor(() => expect(container.textContent).toContain('1 source selected'));
    // Regression: must NOT display the total ("2 sources selected") when only 1 is selected.
    expect(container.textContent).not.toContain('2 sources selected');

    fireEvent.click(boxes[1]);
    await waitFor(() => expect(container.textContent).toContain('2 sources selected'));

    // Deselecting all returns to the plain total.
    fireEvent.click(boxes[0]);
    fireEvent.click(boxes[1]);
    await waitFor(() => {
      expect(container.textContent).toContain('2 sources');
      expect(container.textContent).not.toContain('selected');
    });
  });
});

describe('References loading skeleton', () => {
  function makeDeferred() {
    let resolve!: (v: any) => void;
    const promise = new Promise((res) => { resolve = res; });
    return { promise, resolve };
  }

  it('shows a skeleton row while a submitted URL is fetching, then replaces it in place', async () => {
    localStorage.clear();
    Object.defineProperty(window, 'location', {
      writable: true, value: new URL('http://localhost/my-references?website=https://x.com/p'),
    });
    const cite = makeDeferred();
    globalThis.fetch = vi.fn((url: any) => {
      if (String(url).includes('/api/cite-website')) return cite.promise;
      // /api/format for any resolved rows.
      return Promise.resolve(new Response(JSON.stringify({ formatted: [{ text: 'Formatted' }] }), { status: 200 }));
    }) as any;

    const { container, queryByRole } = render(<References />);

    // Skeleton appears immediately — the list renders even with 0 real sources.
    await waitFor(() => expect(queryByRole('status')).not.toBeNull());
    expect(queryByRole('status')?.getAttribute('aria-busy')).toBe('true');
    expect(container.querySelectorAll('input[aria-label^="Select reference"]').length).toBe(0);

    // Resolve the citation → skeleton is replaced by a real, selectable row.
    await act(async () => {
      cite.resolve(new Response(JSON.stringify({
        uuid: 'https://x.com/p', type: 'webpage',
        csl: { id: 'u', type: 'webpage', title: 'Resolved Title', URL: 'https://x.com/p' },
      }), { status: 200 }));
    });

    await waitFor(() => expect(queryByRole('status')).toBeNull());
    expect(container.querySelectorAll('input[aria-label^="Select reference"]').length).toBe(1);
  });
});
