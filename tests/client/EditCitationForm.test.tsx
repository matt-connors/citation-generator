// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import React from 'react';
import EditCitationForm from '../../src/components/react/EditCitationForm';
import type { StoredSource } from '../../src/lib/references/storage';
import type { CSLItem } from '../../src/lib/citations/csl-types';

describe('EditCitationForm currentRef sync', () => {
  // Regression: tap-outside-on-mobile / ESC closes the dialog before the form's
  // 500ms debounce flushes typed input. Parent reads `currentRef` to decide
  // empty-vs-flush before the form unmounts and the timer is cleared.

  it('populates currentRef with the initial CSL after mount', () => {
    const currentRef = React.createRef<CSLItem | null>() as React.MutableRefObject<CSLItem | null>;
    currentRef.current = null;
    const source: StoredSource = {
      uuid: 'u1',
      csl: { id: 'u1', type: 'webpage', title: 'Initial' },
    };
    render(<EditCitationForm source={source} setSources={() => {}} currentRef={currentRef} />);
    expect(currentRef.current?.title).toBe('Initial');
  });

  it('updates currentRef synchronously after typed input (before debounce fires)', () => {
    const currentRef = React.createRef<CSLItem | null>() as React.MutableRefObject<CSLItem | null>;
    currentRef.current = null;
    const setSources = vi.fn();
    const source: StoredSource = {
      uuid: 'u1',
      csl: { id: 'u1', type: 'webpage' },
    };
    const { container } = render(
      <EditCitationForm source={source} setSources={setSources} currentRef={currentRef} />,
    );

    // The Title field is the first text-like input; the form has many fields,
    // so we locate by placeholder/label-style. Using container.querySelector
    // since EditCitationFormComponents.tsx renders raw HTML inputs.
    const titleInput = container.querySelector('input[type="text"]') as HTMLInputElement;
    expect(titleInput).toBeTruthy();

    fireEvent.change(titleInput, { target: { value: 'Hello' } });

    // Ref should reflect the typed value immediately (no 500ms wait), so a
    // parent reading it on a fast tap-outside gets the latest, not stale.
    expect(currentRef.current?.title).toBe('Hello');

    // The debounced setSources has NOT fired yet — confirming the ref-based
    // flush path is the only way to recover this input on synchronous close.
    expect(setSources).not.toHaveBeenCalled();
  });
});

describe('EditCitationForm quality warnings', () => {
  it('renders concise warning text under the affected fields instead of a generic review block', () => {
    const source: StoredSource = {
      uuid: 'u1',
      csl: { id: 'u1', type: 'webpage', title: 'Extracted Title' },
      quality: {
        score: 62,
        warnings: [
          {
            code: 'author_not_found',
            field: 'author',
            severity: 'review',
            message: 'No author was found. If this source lists a person or organization, add it.',
            action: 'confirm-no-listed-author',
          },
          {
            code: 'date_not_found',
            field: 'issued',
            severity: 'review',
            message: 'No publication date was found.',
            action: 'review-field',
          },
          {
            code: 'title_conflict',
            field: 'title',
            severity: 'warning',
            message: 'We found conflicting title information.',
            action: 'review-field',
          },
          {
            code: 'fetch_partial',
            severity: 'warning',
            message: 'The page appeared to load only partially.',
            action: 'paste-text',
          },
        ],
      },
    };

    const { container, getByText, queryByText } = render(<EditCitationForm source={source} setSources={() => {}} />);

    expect(getByText('Add the listed author or organization, if the source has one.')).toBeTruthy();
    expect(getByText('Add the published or updated date, if the source lists one.')).toBeTruthy();
    expect(getByText('Multiple titles were found; confirm this title.')).toBeTruthy();
    expect(container.querySelectorAll('button[aria-label^="Dismiss warning:"]')).toHaveLength(1);
    expect(queryByText('Review suggested fields')).toBeNull();
    expect(queryByText(/No author was found/)).toBeNull();
    expect(queryByText(/page appeared to load only partially/)).toBeNull();
  });

  it('dismisses optional warnings for only the current citation', () => {
    const setSources = vi.fn();
    const source: StoredSource = {
      uuid: 'u1',
      csl: { id: 'u1', type: 'webpage', title: 'Extracted Title' },
      quality: {
        score: 78,
        warnings: [
          {
            code: 'title_conflict',
            field: 'title',
            severity: 'review',
            message: 'We found conflicting title information.',
            action: 'review-field',
          },
          {
            code: 'url_missing',
            field: 'URL',
            severity: 'error',
            message: 'No URL was found.',
            action: 'review-field',
          },
        ],
      },
    };

    const { container } = render(<EditCitationForm source={source} setSources={setSources} />);

    const dismissButtons = container.querySelectorAll('button[aria-label^="Dismiss warning:"]');
    expect(dismissButtons).toHaveLength(1);
    expect(dismissButtons[0].getAttribute('aria-label')).toBe('Dismiss warning: Multiple titles were found; confirm this title.');
    fireEvent.click(dismissButtons[0]);

    expect(setSources).toHaveBeenCalledTimes(1);
    const updater = setSources.mock.calls[0][0] as (prev: StoredSource[]) => StoredSource[];
    const next = updater([
      source,
      { uuid: 'u2', csl: { id: 'u2', type: 'webpage', title: 'Other' } },
    ]);
    expect(next[0].dismissedWarningKeys).toEqual(['title:title_conflict']);
    expect(next[1].dismissedWarningKeys).toBeUndefined();
  });

  it('does not render warnings that were already dismissed on the citation', () => {
    const source: StoredSource = {
      uuid: 'u1',
      csl: { id: 'u1', type: 'webpage', title: 'Extracted Title' },
      dismissedWarningKeys: ['title:title_conflict'],
      quality: {
        score: 88,
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

    const { container } = render(<EditCitationForm source={source} setSources={() => {}} />);

    expect(container.textContent).not.toContain('Multiple titles were found; confirm this title.');
    expect(container.querySelector('button[aria-label^="Dismiss warning:"]')).toBeNull();
  });

  it('does not show a missing-author warning once an author value exists locally', () => {
    const source: StoredSource = {
      uuid: 'u1',
      csl: {
        id: 'u1',
        type: 'webpage',
        title: 'Title',
        author: [{ family: 'Doe', given: 'Jane' }],
      },
      quality: {
        score: 80,
        warnings: [
          {
            code: 'author_not_found',
            field: 'author',
            severity: 'review',
            message: 'No author was found.',
            action: 'confirm-no-listed-author',
          },
        ],
      },
    };

    const { container } = render(<EditCitationForm source={source} setSources={() => {}} />);

    expect(container.textContent).not.toContain('Add the listed author or organization, if the source has one.');
  });
});

describe('EditCitationForm contributors', () => {
  // Regression: Add Person / Add Organization wrote to the global store instead
  // of the form's local state. The form renders contributors from local state,
  // so the new row never appeared — clicking the buttons looked like a no-op.
  const clickButton = (container: HTMLElement, label: string) => {
    const btn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes(label),
    ) as HTMLButtonElement | undefined;
    expect(btn).toBeTruthy();
    fireEvent.click(btn!);
  };

  it('Add Person adds a contributor row rendered from the form local state', () => {
    const source: StoredSource = { uuid: 'u1', csl: { id: 'u1', type: 'webpage', title: 'T' } };
    const { container } = render(<EditCitationForm source={source} setSources={() => {}} />);
    expect(container.querySelectorAll('details').length).toBe(0);
    clickButton(container, 'Add Person');
    expect(container.querySelectorAll('details').length).toBe(1);
  });

  it('Add Organization adds a contributor row', () => {
    const source: StoredSource = { uuid: 'u1', csl: { id: 'u1', type: 'webpage' } };
    const { container } = render(<EditCitationForm source={source} setSources={() => {}} />);
    clickButton(container, 'Add Organization');
    expect(container.querySelectorAll('details').length).toBe(1);
  });

  it('deleting a contributor removes its row and keeps the rest (stable keys)', () => {
    const source: StoredSource = {
      uuid: 'u1',
      csl: { id: 'u1', type: 'webpage', author: [{ family: 'Alpha', given: '' }, { family: 'Beta', given: '' }] },
    };
    const { container } = render(<EditCitationForm source={source} setSources={() => {}} />);
    expect(container.querySelectorAll('details').length).toBe(2);
    // Trash button lives in the first row's <summary>.
    const firstRow = container.querySelector('details')!;
    const trash = firstRow.querySelector('summary button') as HTMLButtonElement;
    fireEvent.click(trash);
    const rows = container.querySelectorAll('details');
    expect(rows.length).toBe(1);
    // The surviving row is Beta, not Alpha (correct identity mapping after delete).
    expect(rows[0].textContent).toContain('Beta');
    expect(rows[0].textContent).not.toContain('Alpha');
  });
});

describe('EditCitationForm article-journal fields', () => {
  it('renders and updates journal-specific metadata fields', () => {
    const currentRef = React.createRef<CSLItem | null>() as React.MutableRefObject<CSLItem | null>;
    currentRef.current = null;
    const source: StoredSource = {
      uuid: 'j1',
      csl: {
        id: 'j1',
        type: 'article-journal',
        title: 'Article',
        'container-title': 'Nature',
        volume: '634',
        issue: '8035',
        page: '818-823',
        DOI: '10.1038/s41586-024-08025-4',
      },
    };
    const { getByPlaceholderText } = render(
      <EditCitationForm source={source} setSources={() => {}} currentRef={currentRef} />,
    );

    expect(getByPlaceholderText('Journal name')).toHaveProperty('value', 'Nature');
    expect(getByPlaceholderText('Volume number')).toHaveProperty('value', '634');
    expect(getByPlaceholderText('Issue number')).toHaveProperty('value', '8035');
    expect(getByPlaceholderText('Page range')).toHaveProperty('value', '818-823');
    expect(getByPlaceholderText('DOI')).toHaveProperty('value', '10.1038/s41586-024-08025-4');

    fireEvent.change(getByPlaceholderText('Issue number'), { target: { value: '8036' } });
    fireEvent.change(getByPlaceholderText('Page range'), { target: { value: '900-912' } });

    expect(currentRef.current?.issue).toBe('8036');
    expect(currentRef.current?.page).toBe('900-912');
  });
});
