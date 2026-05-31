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
