import type { CSLDateParts } from '../csl-types';

const MONTHS: Record<string, number> = {
  january: 1, jan: 1,
  february: 2, feb: 2,
  march: 3, mar: 3,
  april: 4, apr: 4,
  may: 5,
  june: 6, jun: 6,
  july: 7, jul: 7,
  august: 8, aug: 8,
  september: 9, sept: 9, sep: 9,
  october: 10, oct: 10,
  november: 11, nov: 11,
  december: 12, dec: 12,
};

export function parseIsoDate(s: string | null | undefined): CSLDateParts | null {
  if (!s) return null;
  s = s.trim();
  if (!s) return null;

  // Compact all-numeric date `YYYYMMDD` (optionally trailed by a time, e.g.
  // `20231231T120000`). The lookahead requires EXACTLY 8 date digits, so a
  // 10-digit (seconds) or 13-digit (millis) Unix epoch can never match here.
  const compact = s.match(/^(\d{4})(\d{2})(\d{2})(?!\d)/);
  if (compact) {
    const y = parseInt(compact[1], 10);
    const month = parseInt(compact[2], 10);
    const day = parseInt(compact[3], 10);
    return isValidYmd(y, month, day) ? [y, month, day] : null;
  }

  // Compact `YYYYMM` (exactly 6 date digits; the lookahead again excludes a
  // longer epoch). Preserves the month a bare-year fallback would otherwise drop.
  const compactYm = s.match(/^(\d{4})(\d{2})(?!\d)/);
  if (compactYm) {
    const y = parseInt(compactYm[1], 10);
    const month = parseInt(compactYm[2], 10);
    return isValidYear(y) && month >= 1 && month <= 12 ? [y, month] : null;
  }

  // Year-first date with a spelled-out month, e.g. `2023/Dec/31`,
  // `2023-December-31`, or `2023/Dec` (some CMSs and URL-shaped dates emit this).
  const named = s.match(/^(\d{4})[-\/]([A-Za-z]+)\.?(?:[-\/](\d{1,2}))?/);
  if (named) {
    const y = parseInt(named[1], 10);
    const month = MONTHS[named[2].toLowerCase()];
    if (isValidYear(y) && month) {
      if (named[3]) {
        const day = parseInt(named[3], 10);
        return isValidYmd(y, month, day) ? [y, month, day] : null;
      }
      return [y, month];
    }
  }

  // Numeric ISO date with `-` or `/` separators (arxiv emits `2021/04/21`),
  // optionally trailed by a time component.
  const m = s.match(/^(\d{4})(?:[-\/](\d{1,2})(?:[-\/](\d{1,2}))?)?/);
  if (!m) return null;
  // Timestamp guard: a matched date immediately followed by another digit means
  // the `^`-only anchor truncated a longer number — a Unix epoch like
  // `1704149963` (which yielded a bogus year 1704), or a malformed value. Reject
  // rather than emit a wrong year.
  if (/^\d/.test(s.slice(m[0].length))) return null;
  const y = parseInt(m[1], 10);
  if (!isValidYear(y)) return null;
  if (m[3]) {
    const month = parseInt(m[2], 10);
    const day = parseInt(m[3], 10);
    // Reject impossible dates (including month-specific limits and leap years)
    // so we never emit malformed CSL that citeproc would render nonsensically.
    if (!isValidYmd(y, month, day)) return null;
    return [y, month, day];
  }
  if (m[2]) {
    const month = parseInt(m[2], 10);
    if (month < 1 || month > 12) return null;
    return [y, month];
  }
  return [y];
}

export function parseFreeformDate(s: string | null | undefined): CSLDateParts | null {
  if (!s) return null;
  const text = s.trim().replace(/\b(\d{1,2})(st|nd|rd|th)\b/gi, '$1');
  let m = text.match(/^(?:[A-Za-z]+,\s*)?([A-Za-z]+)\.?\s+(\d{1,2}),?\s+(\d{4})$/);
  if (m) {
    const month = MONTHS[m[1].toLowerCase()];
    const day = parseInt(m[2], 10);
    const year = parseInt(m[3], 10);
    if (month && isValidYmd(year, month, day)) return [year, month, day];
  }
  m = text.match(/^(?:[A-Za-z]+,\s*)?(\d{1,2})\s+([A-Za-z]+)\.?\s+(\d{4})/);
  if (m) {
    const month = MONTHS[m[2].toLowerCase()];
    const day = parseInt(m[1], 10);
    const year = parseInt(m[3], 10);
    if (month && isValidYmd(year, month, day)) return [year, month, day];
  }
  m = text.match(/^([A-Za-z]+)\.?\s+(\d{4})$/);
  if (m) {
    const month = MONTHS[m[1].toLowerCase()];
    const year = parseInt(m[2], 10);
    if (month && isValidYear(year)) return [year, month];
  }
  return null;
}

export function parseDate(s: string | null | undefined): CSLDateParts | null {
  return parseIsoDate(s) || parseFreeformDate(s) || parseNumericDate(s);
}

function parseNumericDate(s: string | null | undefined): CSLDateParts | null {
  if (!s) return null;
  const text = s.trim();
  const m = text.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (!m) return null;

  const first = parseInt(m[1], 10);
  const second = parseInt(m[2], 10);
  const year = parseInt(m[3], 10);
  if (!isValidYear(year)) return null;

  // Numeric dates are locale-ambiguous. Parse only when one side disambiguates
  // the order, e.g. 5/26/2026 (US) or 26/5/2026 (day-first).
  if (first > 12 && second <= 12 && isValidYmd(year, second, first)) return [year, second, first];
  if (second > 12 && first <= 12 && isValidYmd(year, first, second)) return [year, first, second];
  return null;
}

function isValidYear(year: number): boolean {
  return Number.isFinite(year) && year >= 1000 && year <= 9999;
}

function isValidYmd(year: number, month: number, day: number): boolean {
  if (!isValidYear(year) || month < 1 || month > 12 || day < 1 || day > 31) return false;
  const d = new Date(Date.UTC(year, month - 1, day));
  return d.getUTCFullYear() === year
    && d.getUTCMonth() === month - 1
    && d.getUTCDate() === day;
}
