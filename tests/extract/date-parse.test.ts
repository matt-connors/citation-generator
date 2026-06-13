import { describe, it, expect } from 'vitest';
import { parseIsoDate, parseFreeformDate, parseDate } from '../../functions/lib/extract/date-parse';

describe('parseIsoDate', () => {
  it('parses YYYY-MM-DD', () => {
    expect(parseIsoDate('2026-05-26')).toEqual([2026, 5, 26]);
  });
  it('parses YYYY-MM', () => {
    expect(parseIsoDate('2026-05')).toEqual([2026, 5]);
  });
  it('parses YYYY', () => {
    expect(parseIsoDate('2026')).toEqual([2026]);
  });
  it('tolerates an ISO timestamp', () => {
    expect(parseIsoDate('2026-05-26T10:30:00Z')).toEqual([2026, 5, 26]);
  });
  it('returns null on garbage', () => {
    expect(parseIsoDate('notadate')).toBeNull();
    expect(parseIsoDate('')).toBeNull();
  });
  it('parses YYYY/MM/DD (slash separator)', () => {
    expect(parseIsoDate('2021/04/21')).toEqual([2021, 4, 21]);
  });
  it('parses YYYY/MM', () => {
    expect(parseIsoDate('2021/04')).toEqual([2021, 4]);
  });
  it('rejects impossible months and days', () => {
    expect(parseIsoDate('2020-99-99')).toBeNull();
    expect(parseIsoDate('2020-13-01')).toBeNull();
    expect(parseIsoDate('2020-00-10')).toBeNull();
    expect(parseIsoDate('2020-05-40')).toBeNull();
  });
});

describe('parseFreeformDate', () => {
  it('parses "May 26, 2026"', () => {
    expect(parseFreeformDate('May 26, 2026')).toEqual([2026, 5, 26]);
  });
  it('parses "26 May 2026"', () => {
    expect(parseFreeformDate('26 May 2026')).toEqual([2026, 5, 26]);
  });
  it('parses month abbreviation', () => {
    expect(parseFreeformDate('Jan 5, 2026')).toEqual([2026, 1, 5]);
  });
  it('returns null on bare year (use parseIsoDate for that)', () => {
    expect(parseFreeformDate('2026')).toBeNull();
  });
  it('returns null on garbage', () => {
    expect(parseFreeformDate('hello world')).toBeNull();
  });
  it('rejects impossible days', () => {
    expect(parseFreeformDate('May 40, 2026')).toBeNull();
    expect(parseFreeformDate('0 May 2026')).toBeNull();
  });
  it('parses month + year without a day ("September 2011")', () => {
    expect(parseFreeformDate('September 2011')).toEqual([2011, 9]);
    expect(parseFreeformDate('Sep. 2011')).toEqual([2011, 9]);
  });
});

describe('parseDate (combined ISO + freeform)', () => {
  it('parses strict ISO forms', () => {
    expect(parseDate('2014-04-15')).toEqual([2014, 4, 15]);
    expect(parseDate('2014')).toEqual([2014]);
  });
  it('falls back to freeform when ISO fails', () => {
    // Regression: OpenLibrary returns dates like "Sep 06, 2016", which
    // parseIsoDate cannot handle. Book normalization dropped the year entirely
    // until parseDate was wired in.
    expect(parseDate('Sep 06, 2016')).toEqual([2016, 9, 6]);
    expect(parseDate('September 2011')).toEqual([2011, 9]);
    expect(parseDate('14 March 2025')).toEqual([2025, 3, 14]);
  });
  it('returns null when neither parser matches', () => {
    expect(parseDate('not a date')).toBeNull();
    expect(parseDate(null)).toBeNull();
    expect(parseDate(undefined)).toBeNull();
  });
});
