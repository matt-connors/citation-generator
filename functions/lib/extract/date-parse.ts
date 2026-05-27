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
  if (m[3]) return [y, parseInt(m[2], 10), parseInt(m[3], 10)];
  if (m[2]) return [y, parseInt(m[2], 10)];
  return [y];
}

export function parseFreeformDate(s: string | null | undefined): CSLDateParts | null {
  if (!s) return null;
  const text = s.trim();
  let m = text.match(/^([A-Za-z]+)\.?\s+(\d{1,2}),?\s+(\d{4})$/);
  if (m) {
    const month = MONTHS[m[1].toLowerCase()];
    if (month) return [parseInt(m[3], 10), month, parseInt(m[2], 10)];
  }
  m = text.match(/^(\d{1,2})\s+([A-Za-z]+)\.?\s+(\d{4})$/);
  if (m) {
    const month = MONTHS[m[2].toLowerCase()];
    if (month) return [parseInt(m[3], 10), month, parseInt(m[1], 10)];
  }
  return null;
}
