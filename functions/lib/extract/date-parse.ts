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
  // Accept both `-` and `/` as separators — arxiv (and others) emit dates like
  // `2021/04/21` in citation_date meta tags.
  const m = s.match(/^(\d{4})(?:[-\/](\d{1,2})(?:[-\/](\d{1,2}))?)?/);
  if (!m) return null;
  const y = parseInt(m[1], 10);
  if (!Number.isFinite(y) || y < 1000 || y > 9999) return null;
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
