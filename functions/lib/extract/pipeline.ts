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

  // Wikipedia quirk: JSON-LD `headline` is the article description, not the title
  // (e.g. <https://en.wikipedia.org/wiki/Citation> → "reference to a source").
  // The <title> tag has the correct value, and the heuristic signal already
  // strips the " - Wikipedia" suffix via TITLE_SEP.
  if (isWikipediaHost(url)) {
    const heuristic = named.find((s) => s.name === 'heuristic');
    if (heuristic?.fields.title) {
      final.title = heuristic.fields.title;
      signals.title = 'heuristic';
    }
  }

  return { csl: final, signals };
}

function isWikipediaHost(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === 'wikipedia.org' || host.endsWith('.wikipedia.org');
  } catch {
    return false;
  }
}
