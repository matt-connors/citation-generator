import type { CSLItem, CSLType, FieldEvidence, FieldProvenance } from '../csl-types';
import type { PipelineResult } from '../extract/pipeline';
import { EXTRACT_MERGEABLE_FIELDS, sameEvidenceValue } from '../extract/merge';

const FIELD_ORDER = EXTRACT_MERGEABLE_FIELDS;

export interface MergedCitationEvidence {
  csl: CSLItem;
  signals: Record<string, string>;
  provenance: Partial<Record<keyof CSLItem, FieldProvenance>>;
}

export function mergePipelineResults(results: PipelineResult[], fallbackUrl: string): MergedCitationEvidence {
  const provenance: Partial<Record<keyof CSLItem, FieldProvenance>> = {};
  const signals: Record<string, string> = {};

  for (const field of FIELD_ORDER) {
    const candidates = results.flatMap((result) => result.provenance[field]?.candidates ?? []);
    if (!candidates.length) continue;
    const winner = chooseWinner(candidates);
    provenance[field] = {
      winner,
      candidates,
      conflicts: candidates.filter((candidate) => !sameEvidenceValue(candidate.normalizedValue, winner.normalizedValue)),
    };
    signals[field] = winner.source;
  }

  const merged: CSLItem = {
    id: fallbackUrl,
    type: chooseType(results),
    URL: fallbackUrl,
  };
  for (const field of FIELD_ORDER) {
    const winner = provenance[field]?.winner;
    if (winner) (merged as any)[field] = winner.normalizedValue;
  }
  merged.URL = typeof merged.URL === 'string' && merged.URL ? merged.URL : fallbackUrl;
  dedupePublisherContainer(merged, provenance);

  return { csl: merged, signals, provenance };
}

export function addEvidenceToResult(
  base: MergedCitationEvidence,
  evidence: FieldEvidence[],
): MergedCitationEvidence {
  const result: PipelineResult = {
    csl: base.csl,
    signals: base.signals,
    provenance: base.provenance,
  };
  const synthetic: PipelineResult = {
    csl: base.csl,
    signals: {},
    provenance: {},
  };
  for (const item of evidence) {
    synthetic.provenance[item.field] = {
      winner: item,
      candidates: [item],
      conflicts: [],
    };
  }
  return mergePipelineResults([result, synthetic], base.csl.URL || base.csl.id);
}

function chooseWinner(candidates: FieldEvidence[]): FieldEvidence {
  return candidates.reduce((best, next) => {
    if (next.confidence > best.confidence) return next;
    if (next.confidence < best.confidence) return best;
    return sourceRank(next) > sourceRank(best) ? next : best;
  });
}

function sourceRank(evidence: FieldEvidence): number {
  switch (evidence.source) {
    case 'user-edit': return 100;
    case 'crossref':
    case 'openalex':
    case 'openlibrary':
    case 'google-books': return 90;
    case 'browser-extension': return 80;
    case 'jsonld':
    case 'microdata':
    case 'meta': return 70;
    case 'opengraph': return 60;
    case 'heuristic': return 50;
    case 'type-inference': return 55;
    case 'ai-extract': return 40;
    case 'twitter': return 30;
    case 'input': return 20;
    default: return 10;
  }
}

function chooseType(results: PipelineResult[]): CSLType {
  if (results.some((result) => result.csl.type === 'article-journal')) return 'article-journal';
  if (results.some((result) => result.csl.type === 'article-newspaper')) return 'article-newspaper';
  if (results.some((result) => result.csl.type === 'article-magazine')) return 'article-magazine';
  if (results.some((result) => result.csl.type === 'book')) return 'book';
  return 'webpage';
}

function dedupePublisherContainer(
  item: CSLItem,
  provenance: Partial<Record<keyof CSLItem, FieldProvenance>>,
): void {
  if (item.publisher && item['container-title']
    && normalizeComparable(item.publisher) === normalizeComparable(item['container-title'])) {
    delete item.publisher;
    delete provenance.publisher;
  }
}

function normalizeComparable(value: string): string {
  return value
    .toLowerCase()
    .replace(/^the\s+/, '')
    .replace(/[^\p{L}\p{N}]+/gu, '');
}
