// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import React from 'react';
import CitationSearch from '../../src/components/react/CitationSearch';

function getFormData(container: HTMLElement) {
  const form = container.querySelector('form') as HTMLFormElement;
  return new FormData(form);
}

describe('CitationSearch', () => {
  it('shows the journal DOI tab and submits only the active source field', () => {
    const { container, getByRole, getByPlaceholderText } = render(
      <CitationSearch includeDropdown={false} includeManualCite={false} />
    );

    fireEvent.change(getByPlaceholderText('Paste the website URL'), {
      target: { value: 'https://example.com/article' },
    });

    fireEvent.click(getByRole('tab', { name: 'Book' }));
    fireEvent.change(getByPlaceholderText('Enter an ISBN'), {
      target: { value: '9780062315007' },
    });

    let data = getFormData(container);
    expect(data.get('book')).toBe('9780062315007');
    expect(data.has('website')).toBe(false);
    expect(data.has('journal')).toBe(false);

    fireEvent.click(getByRole('tab', { name: 'Journal' }));
    fireEvent.change(getByPlaceholderText('Enter a DOI'), {
      target: { value: '10.1038/s41586-021-03828-1' },
    });

    data = getFormData(container);
    expect(data.get('journal')).toBe('10.1038/s41586-021-03828-1');
    expect(data.has('website')).toBe(false);
    expect(data.has('book')).toBe(false);
  });
});
