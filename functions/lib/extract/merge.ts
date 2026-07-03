import type { AcquisitionSource, CSLItem, EvidenceSource, FieldEvidence, FieldProvenance } from '../csl-types';
import { parseAuthorName } from './author-parse';

export interface NamedSignal {
  name: string;
  fields: Partial<CSLItem>;
  confidence: Partial<Record<keyof CSLItem, number>>;
}

const MERGEABLE_FIELDS: Array<keyof CSLItem> = [
  'title', 'author', 'issued', 'publisher', 'container-title', 'URL', 'DOI',
  'volume', 'issue', 'page', 'edition', 'abstract',
];

export const EXTRACT_MERGEABLE_FIELDS = MERGEABLE_FIELDS;

interface MergeOptions {
  acquisition?: AcquisitionSource;
  acquiredAt?: string;
}

export function mergeSignals(signals: NamedSignal[]): {
  csl: Partial<CSLItem>;
  signals: Record<string, string>;
  provenance: Partial<Record<keyof CSLItem, FieldProvenance>>;
};
export function mergeSignals(signals: NamedSignal[], options: MergeOptions = {}): {
  csl: Partial<CSLItem>;
  signals: Record<string, string>;
  provenance: Partial<Record<keyof CSLItem, FieldProvenance>>;
} {
  const csl: Partial<CSLItem> = {};
  const winners: Record<string, string> = {};
  const provenance: Partial<Record<keyof CSLItem, FieldProvenance>> = {};
  for (const field of MERGEABLE_FIELDS) {
    const candidates: FieldEvidence[] = [];
    for (const s of signals) {
      const conf = s.confidence[field];
      // Guard the confidence contract: ignore NaN/Infinity/out-of-range scores so
      // a misbehaving signal can't hijack a field with a pathological value.
      if (typeof conf === 'number' && Number.isFinite(conf) && conf > 0 && conf <= 1
        && s.fields[field] !== undefined) {
        candidates.push(evidenceFromSignal(field, s.name, s.fields[field], conf, options));
      }
    }
    if (candidates.length) {
      const winner = candidates.reduce((best, next) => (
        next.confidence > best.confidence ? next : best
      ));
      (csl as any)[field] = winner.normalizedValue;
      winners[field] = winner.source;
      provenance[field] = {
        winner,
        candidates,
        conflicts: candidates.filter((candidate) => conflictsForField(field, candidate.normalizedValue, winner.normalizedValue)),
      };
    }
  }
  return { csl, signals: winners, provenance };
}

function evidenceFromSignal(
  field: keyof CSLItem,
  source: string,
  value: unknown,
  confidence: number,
  options: MergeOptions,
): FieldEvidence {
  return {
    field,
    normalizedValue: value,
    rawValue: evidenceRawValue(value),
    source: source as EvidenceSource,
    acquisition: options.acquisition,
    confidence,
    acquiredAt: options.acquiredAt,
  };
}

function evidenceRawValue(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (value === undefined) return undefined;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function sameEvidenceValue(a: unknown, b: unknown): boolean {
  return stableEvidenceValue(a) === stableEvidenceValue(b);
}

function stableEvidenceValue(value: unknown): string {
  if (value === undefined) return 'undefined';
  if (value === null) return 'null';
  if (typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableEvidenceValue).join(',')}]`;
  const obj = value as Record<string, unknown>;
  return `{${Object.keys(obj).sort().map((key) => `${JSON.stringify(key)}:${stableEvidenceValue(obj[key])}`).join(',')}}`;
}

// -----------------------------------------------------------------------------
// Field-aware conflict detection.
//
// This decides ONLY whether a candidate should be flagged as *conflicting* with
// the winner (i.e. surfaced as a `${field}_conflict` review warning). It is used
// exclusively at the conflict-filter site above and never influences winner
// selection or the value written to `csl`. The strict `sameEvidenceValue` /
// `stableEvidenceValue` pair is left untouched for its other callers.
//
// The goal is to stop cosmetic differences from masquerading as real conflicts:
//   - URLs that differ only by protocol / `www.` / trailing slash / tracking params
//   - dates that differ only in precision (`[2024]` vs `[2024,3,15]`)
//   - author/editor names in different shapes (`{literal}` vs `{family,given}`)
// while still flagging genuinely different values. Any value we cannot confidently
// normalize falls back to the original strict structural comparison.
function conflictsForField(field: keyof CSLItem, candidate: unknown, winner: unknown): boolean {
  try {
    if (field === 'URL') {
      const a = normalizeUrlForCompare(candidate);
      const b = normalizeUrlForCompare(winner);
      if (a !== undefined && b !== undefined) return a !== b;
    } else if (field === 'issued') {
      const verdict = datesConflict(candidate, winner);
      if (verdict !== undefined) return verdict;
    } else if (field === 'author' || field === 'editor') {
      const verdict = namesConflict(candidate, winner);
      if (verdict !== undefined) return verdict;
    }
  } catch {
    // Any unexpected shape falls through to the strict comparison below.
  }
  return !sameEvidenceValue(candidate, winner);
}

const TRACKING_PARAM_RE = /^(?:utm_.*|fbclid|gclid|ref|mc_.*)$/i;

// Canonicalizes a URL for equality comparison: strips protocol, lowercases the
// host, drops a leading `www.`, removes a single trailing slash, and filters out
// known tracking query params. Returns undefined for non-strings / empty values
// so the caller can fall back to a strict compare.
function normalizeUrlForCompare(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  // Drop the fragment, then split off the query string.
  let rest = trimmed.replace(/#.*$/, '');
  let query = '';
  const qIndex = rest.indexOf('?');
  if (qIndex !== -1) {
    query = rest.slice(qIndex + 1);
    rest = rest.slice(0, qIndex);
  }

  // Strip protocol / protocol-relative prefix.
  rest = rest.replace(/^https?:\/\//i, '').replace(/^\/\//, '');

  // Lowercase and de-`www.` the host (everything up to the first `/`); keep the
  // path's case since paths can be case-sensitive.
  const slash = rest.indexOf('/');
  const host = (slash === -1 ? rest : rest.slice(0, slash)).toLowerCase().replace(/^www\./, '');
  let path = slash === -1 ? '' : rest.slice(slash);
  path = path.replace(/\/+$/, '');

  const kept = query
    .split('&')
    .filter((pair) => pair && !TRACKING_PARAM_RE.test(pair.split('=')[0]));

  const base = host + path;
  return kept.length ? `${base}?${kept.join('&')}` : base;
}

// Compares two CSL dates at the coarsest granularity they share. Returns:
//   true  -> they disagree on a part they both provide (real conflict)
//   false -> they agree on every shared part (only a precision difference)
//   undefined -> not comparable as dates; caller should fall back to strict
function datesConflict(a: unknown, b: unknown): boolean | undefined {
  const pa = firstDateParts(a);
  const pb = firstDateParts(b);
  if (!pa || !pb || pa.length === 0 || pb.length === 0) return undefined;
  const shared = Math.min(pa.length, pb.length);
  for (let i = 0; i < shared; i += 1) {
    if (pa[i] !== pb[i]) return true;
  }
  return false;
}

// Extracts the first date-parts tuple as an array of finite numbers. Accepts
// `{ 'date-parts': [[y,m,d]] }`, `[[y,m,d]]`, or a bare `[y,m,d]`.
function firstDateParts(value: unknown): number[] | undefined {
  let dp: unknown = value;
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    dp = (value as Record<string, unknown>)['date-parts'];
  }
  if (!Array.isArray(dp)) return undefined;
  const first: unknown = Array.isArray(dp[0]) ? dp[0] : dp;
  if (!Array.isArray(first)) return undefined;
  const nums = first.map((n) => (typeof n === 'number' ? n : Number(n)));
  if (nums.some((n) => !Number.isFinite(n))) return undefined;
  return nums as number[];
}

// Compares two name lists (author/editor) as sets of canonical keys, so the same
// people in different shapes/orders/duplication don't count as a conflict.
// Returns true/false, or undefined when either side isn't a well-formed name list.
function namesConflict(a: unknown, b: unknown): boolean | undefined {
  const ka = nameKeySet(a);
  const kb = nameKeySet(b);
  if (!ka || !kb) return undefined;
  if (ka.size !== kb.size) return true;
  for (const key of ka) {
    if (!kb.has(key)) return true;
  }
  return false;
}

function nameKeySet(value: unknown): Set<string> | undefined {
  if (!Array.isArray(value) || value.length === 0) return undefined;
  const set = new Set<string>();
  for (const item of value) {
    const key = nameKey(item);
    if (key === undefined) return undefined; // odd entry -> bail to strict compare
    set.add(key);
  }
  return set;
}

// Produces a canonical, case-insensitive key for a single CSL name. A `literal`
// is parsed through the shared author parser so `{literal:"Jane Roe"}` and
// `{family:"Roe",given:"Jane"}` collapse to the same key. Organizations
// (literals the parser leaves intact) key on the literal text.
function nameKey(name: unknown): string | undefined {
  if (!name || typeof name !== 'object') return undefined;
  const raw = name as Record<string, unknown>;

  let canonical: Record<string, unknown> = raw;
  if (typeof raw.literal === 'string' && raw.literal.trim()) {
    const parsed = parseAuthorName(raw.literal);
    if (parsed) canonical = parsed as unknown as Record<string, unknown>;
  }

  if (typeof canonical.literal === 'string' && canonical.literal.trim()) {
    return `lit:${normalizeNamePart(canonical.literal)}`;
  }

  const family = typeof canonical.family === 'string' ? canonical.family : '';
  const given = typeof canonical.given === 'string' ? canonical.given : '';
  const particle = typeof canonical['non-dropping-particle'] === 'string'
    ? String(canonical['non-dropping-particle'])
    : '';
  if (!family.trim() && !given.trim()) return undefined;
  return `per:${normalizeNamePart(`${particle} ${family}`)}|${normalizeNamePart(given)}`;
}

function normalizeNamePart(value: string): string {
  return value
    .toLowerCase()
    .replace(/\./g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
