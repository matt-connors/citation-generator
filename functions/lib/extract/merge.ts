import type { AcquisitionSource, CSLItem, EvidenceSource, FieldEvidence, FieldProvenance } from '../csl-types';

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
        conflicts: candidates.filter((candidate) => !sameEvidenceValue(candidate.normalizedValue, winner.normalizedValue)),
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
