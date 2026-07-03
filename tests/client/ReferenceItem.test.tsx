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
        checked={false}
        onToggle={() => {}}
        citationFormat="mla-9"
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

  it('uses an icon-only marker for field warnings instead of inline warning copy', async () => {
    const source: StoredSource = {
      uuid: 'u1',
      csl: { id: 'u1', type: 'webpage', title: 'My Title' },
      quality: {
        score: 70,
        warnings: [
          {
            code: 'author_not_found',
            field: 'author',
            severity: 'review',
            message: 'No author was found.',
            action: 'confirm-no-listed-author',
          },
          {
            code: 'date_not_found',
            field: 'issued',
            severity: 'review',
            message: 'No publication date was found.',
            action: 'review-field',
          },
        ],
      },
    };
    const { container } = render(
      <ReferenceItem
        source={source}
        checked={false}
        onToggle={() => {}}
        citationFormat="mla-9"
        setSources={() => {}}
      />,
    );

    await waitFor(() => {
      expect(container.textContent).toContain('My Title');
    });

    expect(container.querySelector('[aria-label="Citation has fields to review"]')).toBeTruthy();
    expect(container.textContent).not.toContain('citation fields need review');
    expect(container.textContent).not.toContain('No author was found');
    expect(container.textContent).not.toContain('No publication date was found');
  });

  it('does not show the row warning marker once all field warnings are dismissed', async () => {
    const source: StoredSource = {
      uuid: 'u1',
      csl: { id: 'u1', type: 'webpage', title: 'My Title' },
      dismissedWarningKeys: ['title:title_conflict'],
      quality: {
        score: 90,
        warnings: [
          {
            code: 'title_conflict',
            field: 'title',
            severity: 'review',
            message: 'We found conflicting title information.',
            action: 'review-field',
          },
        ],
      },
    };
    const { container } = render(
      <ReferenceItem
        source={source}
        checked={false}
        onToggle={() => {}}
        citationFormat="mla-9"
        setSources={() => {}}
      />,
    );

    await waitFor(() => {
      expect(container.textContent).toContain('My Title');
    });

    expect(container.querySelector('[aria-label="Citation has fields to review"]')).toBeNull();
  });
});
