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
    expect(parseIsoDate('2021-02-29')).toBeNull();
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
  it('parses weekday prefixes and ordinal days', () => {
    expect(parseFreeformDate('Tuesday, 26th May 2026')).toEqual([2026, 5, 26]);
    expect(parseFreeformDate('Tuesday, May 26th, 2026')).toEqual([2026, 5, 26]);
  });
  it('parses month and year without a day', () => {
    expect(parseFreeformDate('May 2026')).toEqual([2026, 5]);
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
    expect(parseFreeformDate('February 29, 2021')).toBeNull();
  });
});

describe('parseDate', () => {
  it('accepts common non-ISO dates through the shared parser', () => {
    expect(parseDate('5/26/2026')).toEqual([2026, 5, 26]);
    expect(parseDate('26/5/2026')).toEqual([2026, 5, 26]);
  });

  it('does not guess ambiguous numeric dates', () => {
    expect(parseDate('04/05/2026')).toBeNull();
  });
});

describe('parseDate — timestamp guard + compact/named forms (regression suite)', () => {
  it('rejects Unix epoch timestamps instead of emitting a bogus year', () => {
    // Reported bug: an og:updated_time carrying an epoch produced issued year 1704.
    expect(parseDate('1704149963')).toBeNull();    // 2024-01-01, seconds
    expect(parseDate('1704067200')).toBeNull();
    expect(parseDate('1703980800')).toBeNull();
    expect(parseDate('1703980800000')).toBeNull(); // milliseconds
    expect(parseDate('2000000000')).toBeNull();
    expect(parseDate('9999999999')).toBeNull();
    expect(parseDate('12345')).toBeNull();
  });

  it('rejects a 4-digit year immediately followed by more digits (truncated number)', () => {
    expect(parseDate('10000-01-01')).toBeNull(); // 5-digit leading year
    expect(parseDate('12345-06-07')).toBeNull();
  });

  it('parses compact YYYYMMDD / YYYYMM (previously year-only)', () => {
    expect(parseDate('20231231')).toEqual([2023, 12, 31]);
    expect(parseDate('20231231T100000Z')).toEqual([2023, 12, 31]);
    expect(parseDate('202312')).toEqual([2023, 12]);
  });

  it('parses year-first spelled months, e.g. 2023/Dec/31 (previously year-only)', () => {
    expect(parseDate('2023/Dec/31')).toEqual([2023, 12, 31]);
    expect(parseDate('2023/December/31')).toEqual([2023, 12, 31]);
    expect(parseDate('2023/Dec')).toEqual([2023, 12]);
  });

  it('trims surrounding whitespace', () => {
    expect(parseDate(' 2023-12-31 ')).toEqual([2023, 12, 31]);
  });

  it('leaves valid ISO / datetime / freeform forms unchanged (no regression)', () => {
    expect(parseDate('2021/04/21')).toEqual([2021, 4, 21]);
    expect(parseDate('2024-03')).toEqual([2024, 3]);
    expect(parseDate('2024')).toEqual([2024]);
    expect(parseDate('2024-03-15T10:30:00+05:00')).toEqual([2024, 3, 15]);
    expect(parseDate('December 31, 2023')).toEqual([2023, 12, 31]);
    expect(parseDate('31 December 2023')).toEqual([2023, 12, 31]);
  });
});
