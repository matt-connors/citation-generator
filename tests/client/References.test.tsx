// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/react';
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
    const sel = 'input[type="checkbox"][aria-label="Select this reference"]';
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
