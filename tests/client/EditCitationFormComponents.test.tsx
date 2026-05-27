// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import React from 'react';
import { PublicationDate, AccessDate } from '../../src/components/react/EditCitationFormComponents';

// DateInput renders Year input, Month dropdown (a button, not <input>), Day input.
// `container.querySelectorAll('input[type="text"]')` is [year, day] in that order.
function findDateInputs(container: HTMLElement): { year: HTMLInputElement; day: HTMLInputElement } {
  const inputs = container.querySelectorAll('input[type="text"]') as NodeListOf<HTMLInputElement>;
  expect(inputs.length).toBe(2);
  return { year: inputs[0], day: inputs[1] };
}

describe('DateInput partial-entry behavior', () => {
  // Regression: an earlier refactor derived year/month/day from `value` via
  // useMemo. Since buildCslDate returns undefined unless year > 0, picking
  // a month or typing a day with year still empty produced value=undefined
  // → derived back to '' → input snapped back to empty, silently dropping
  // user input. Local state inside DateInput is the source of truth for
  // typed-but-incomplete entry; `value` reflects only complete-enough state.

  it('preserves a typed day value when year is still empty', () => {
    const onChange = vi.fn();
    const { container } = render(<PublicationDate value={undefined} onChange={onChange} />);
    const { day } = findDateInputs(container);
    fireEvent.change(day, { target: { value: '15' } });
    expect(day.value).toBe('15');
    expect(onChange).toHaveBeenCalledWith(undefined);
  });

  it('preserves day when the user clears the year', () => {
    const initial = { 'date-parts': [[2020, 5, 15]] as [number, number, number][] };
    const onChange = vi.fn();
    const { container } = render(<PublicationDate value={initial as any} onChange={onChange} />);
    const { year, day } = findDateInputs(container);
    expect(day.value).toBe('15');

    fireEvent.change(year, { target: { value: '' } });

    expect(year.value).toBe('');
    expect(day.value).toBe('15');
    expect(onChange).toHaveBeenLastCalledWith(undefined);
  });

  it('AccessDate Set to Today fills all three fields and emits a CSL date', () => {
    const onChange = vi.fn();
    const { container } = render(<AccessDate value={undefined} onChange={onChange} />);
    const button = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('Set to Today'),
    ) as HTMLButtonElement | undefined;
    expect(button).toBeTruthy();
    fireEvent.click(button!);

    const today = new Date();
    const { year, day } = findDateInputs(container);
    expect(year.value).toBe(String(today.getFullYear()));
    expect(day.value).toBe(String(today.getDate()));
    expect(onChange).toHaveBeenCalledWith({
      'date-parts': [[today.getFullYear(), today.getMonth() + 1, today.getDate()]],
    });
  });
});
