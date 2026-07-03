import * as cheerio from 'cheerio';
import type { AcquisitionSource, CSLItem, FieldEvidence, FieldProvenance } from '../csl-types';
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
  provenance: Partial<Record<keyof CSLItem, FieldProvenance>>;
}

export interface PipelineOptions {
  acquisition?: AcquisitionSource;
  acquiredAt?: string;
}

export function runExtractionPipeline(html: string, url: string, options: PipelineOptions = {}): PipelineResult {
  const $ = cheerio.load(html);
  const named = SIGNALS.map((s) => ({ name: s.name, ...s.fn($) }));
  const { csl: merged, signals, provenance } = mergeSignals(named, options);
  const final: CSLItem = {
    id: url,
    type: inferType(merged),
    URL: url,
    ...merged,
  };
  final.URL = resolveUrl(final.URL, url);
  ensureInputUrlProvenance(provenance, final.URL, options);
  dedupePublisherContainer(final);
  if (!final.publisher) delete provenance.publisher;

  // Wikipedia quirk: JSON-LD `headline` is the article description, not the title
  // (e.g. <https://en.wikipedia.org/wiki/Citation> → "reference to a source").
  // The <title> tag has the correct value, and the heuristic signal already
  // strips the " - Wikipedia" suffix via TITLE_SEP.
  if (isWikipediaHost(url)) {
    const heuristic = named.find((s) => s.name === 'heuristic');
    if (heuristic?.fields.title) {
      final.title = heuristic.fields.title;
      signals.title = 'heuristic';
      const candidate = provenance.title?.candidates.find((item) => item.source === 'heuristic');
      if (candidate) {
        provenance.title = {
          winner: candidate,
          candidates: provenance.title?.candidates ?? [candidate],
          conflicts: (provenance.title?.candidates ?? []).filter((item) => item !== candidate),
        };
      }
    }
  }

  return { csl: final, signals, provenance };
}

function inferType(item: Partial<CSLItem>): CSLItem['type'] {
  // A pasted URL can point at a journal article landing page. When the page
  // exposes journal-style container metadata plus a scholarly locator, format
  // it as an article-journal so CSL can render those details. DOI-only landing
  // pages are common for early-online articles and should not fall back to a
  // generic webpage.
  if (item['container-title'] && (item.volume || item.issue || item.page || item.DOI)) {
    return 'article-journal';
  }
  return 'webpage';
}

function resolveUrl(value: string | undefined, base: string): string {
  if (!value) return base;
  try {
    const resolved = new URL(value, base);
    return resolved.protocol === 'http:' || resolved.protocol === 'https:' ? resolved.href : base;
  } catch {
    return base;
  }
}

function dedupePublisherContainer(item: CSLItem): void {
  if (item.publisher && item['container-title']
    && normalizeComparable(item.publisher) === normalizeComparable(item['container-title'])) {
    delete item.publisher;
  }
}

function normalizeComparable(value: string): string {
  return value
    .toLowerCase()
    .replace(/^the\s+/, '')
    .replace(/[^\p{L}\p{N}]+/gu, '');
}

function isWikipediaHost(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === 'wikipedia.org' || host.endsWith('.wikipedia.org');
  } catch {
    return false;
  }
}

function ensureInputUrlProvenance(
  provenance: Partial<Record<keyof CSLItem, FieldProvenance>>,
  url: string,
  options: PipelineOptions,
): void {
  if (provenance.URL?.winner) {
    provenance.URL.winner.normalizedValue = url;
    return;
  }
  const evidence: FieldEvidence = {
    field: 'URL',
    normalizedValue: url,
    rawValue: url,
    source: 'input',
    acquisition: options.acquisition ?? 'input',
    confidence: 1,
    acquiredAt: options.acquiredAt,
  };
  provenance.URL = {
    winner: evidence,
    candidates: [evidence],
    conflicts: [],
  };
}
