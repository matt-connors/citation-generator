import * as cheerio from 'cheerio';
import type { CSLItem } from '../csl-types';
import { jsonldSignal } from './signals/jsonld';
import { microdataSignal } from './signals/microdata';
import { openGraphSignal } from './signals/opengraph';
import { twitterSignal } from './signals/twitter';
import { metaSignal } from './signals/meta';
import { heuristicSignal } from './signals/heuristic';
import { mergeSignals } from './merge';

const SIGNALS = [
  { name: 'jsonld', fn: jsonldSignal },
  { name: 'microdata', fn: microdataSignal },
  { name: 'opengraph', fn: openGraphSignal },
  { name: 'twitter', fn: twitterSignal },
  { name: 'meta', fn: metaSignal },
  { name: 'heuristic', fn: heuristicSignal },
] as const;

export interface PipelineResult {
  csl: CSLItem;
  signals: Record<string, string>;
}

export function runExtractionPipeline(html: string, url: string): PipelineResult {
  const $ = cheerio.load(html);
  const named = SIGNALS.map((s) => ({ name: s.name, ...s.fn($) }));
  const { csl: merged, signals } = mergeSignals(named);
  const final: CSLItem = {
    id: url,
    type: 'webpage',
    URL: url,
    ...merged,
  };
  return { csl: final, signals };
}
