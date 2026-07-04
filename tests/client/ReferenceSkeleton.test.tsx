// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import React from 'react';
import ReferenceSkeleton from '../../src/components/react/ReferenceSkeleton';

// This project runs vitest without globals, so @testing-library's automatic
// afterEach cleanup isn't registered — unmount renders between tests ourselves.
afterEach(cleanup);

describe('ReferenceSkeleton', () => {
  it('renders an accessible loading placeholder with two shimmer bars', () => {
    const { getByRole, container } = render(<ReferenceSkeleton url="https://example.com/post" />);
    const status = getByRole('status');
    expect(status.getAttribute('aria-busy')).toBe('true');
    expect(status.getAttribute('aria-label')).toContain('Fetching citation for https://example.com/post');
    // Two shimmer bars (aria-hidden spans); no interactive controls.
    expect(container.querySelectorAll('span[aria-hidden="true"]')).toHaveLength(2);
    expect(container.querySelector('input')).toBeNull();
    expect(container.querySelector('button')).toBeNull();
  });

  it('falls back to a generic label when no url is given', () => {
    const { getByRole } = render(<ReferenceSkeleton />);
    expect(getByRole('status').getAttribute('aria-label')).toBe('Fetching citation…');
  });
});
