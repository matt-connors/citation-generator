// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import React from 'react';
import ReferenceItem from '../../src/components/react/ReferenceItem';
import { _resetCacheForTests } from '../../src/lib/citations/useFormattedCitation';
import type { StoredSource } from '../../src/lib/references/storage';

beforeEach(() => {
  _resetCacheForTests();
  // jsdom does not implement window.matchMedia — @react-hook/media-query needs it.
  if (!(window as any).matchMedia) {
    (window as any).matchMedia = (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    });
  }
  globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({
    formatted: [{ text: 'Doe, Jane. ' }, { text: 'My Title', italic: true }, { text: '.' }],
  }), { status: 200 })) as any;
});

describe('ReferenceItem', () => {
  it('renders the formatted citation', async () => {
    const source: StoredSource = {
      uuid: 'u1',
      csl: { id: 'u1', type: 'webpage', title: 'My Title', author: [{ family: 'Doe', given: 'Jane' }] },
    };
    const { container } = render(
      <ReferenceItem
        source={source}
        sources={[source]}
        index={0}
        citationFormat="mla-9"
        onCheckChange={() => {}}
        setSources={() => {}}
      />,
    );
    await waitFor(() => {
      expect(container.textContent).toContain('Doe');
      expect(container.textContent).toContain('My Title');
    });
    const italic = container.querySelector('i, em');
    expect(italic?.textContent).toContain('My Title');
  });
});
