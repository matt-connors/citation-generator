import type { CSLItem } from '../csl-types';

export interface NamedSignal {
  name: string;
  fields: Partial<CSLItem>;
  confidence: Partial<Record<keyof CSLItem, number>>;
}

const MERGEABLE_FIELDS: Array<keyof CSLItem> = [
  'title', 'author', 'issued', 'publisher', 'container-title', 'URL', 'DOI',
  'volume', 'issue', 'page', 'edition',
];

export function mergeSignals(signals: NamedSignal[]): {
  csl: Partial<CSLItem>;
  signals: Record<string, string>;
} {
  const csl: Partial<CSLItem> = {};
  const winners: Record<string, string> = {};
  for (const field of MERGEABLE_FIELDS) {
    let bestConf = 0;
    let bestVal: any;
    let bestName: string | undefined;
    for (const s of signals) {
      const conf = s.confidence[field];
      if (typeof conf === 'number' && s.fields[field] !== undefined && conf > bestConf) {
        bestConf = conf;
        bestVal = s.fields[field];
        bestName = s.name;
      }
    }
    if (bestName) {
      (csl as any)[field] = bestVal;
      winners[field] = bestName;
    }
  }
  return { csl, signals: winners };
}
