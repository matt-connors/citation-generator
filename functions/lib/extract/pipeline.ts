import * as cheerio from 'cheerio';
import type {
  AcquisitionSource,
  CitationQualityWarning,
  CSLItem,
  FieldEvidence,
  FieldProvenance,
} from '../csl-types';
import { jsonldSignal } from './signals/jsonld';
import { microdataSignal } from './signals/microdata';
import { openGraphSignal } from './signals/opengraph';
import { twitterSignal } from './signals/twitter';
import { metaSignal } from './signals/meta';
import { heuristicSignal } from './signals/heuristic';
import { platformSignal } from './signals/platform';
import { mergeSignals } from './merge';
import { collectPageTypeHints, inferSourceType } from './infer-type';

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
  /** Type-inference review warnings (e.g. ambiguous government pages). */
  typeWarnings?: CitationQualityWarning[];
}

export interface PipelineOptions {
  acquisition?: AcquisitionSource;
  acquiredAt?: string;
}

export function runExtractionPipeline(html: string, url: string, options: PipelineOptions = {}): PipelineResult {
  const $ = cheerio.load(html);
  // The platform signal runs first (its confidence outranks the generic
  // signals) and is the only one that needs the URL — host detection decides
  // whether a platform-specific parser applies at all.
  const platform = platformSignal($, url);
  const named = [
    { name: 'platform', fields: platform.fields, confidence: platform.confidence },
    ...SIGNALS.map((s) => ({ name: s.name, ...s.fn($) })),
  ];
  const { csl: merged, signals, provenance } = mergeSignals(named, options);
  const hints = collectPageTypeHints($);
  const inference = inferSourceType(merged, url, hints);
  const final: CSLItem = {
    id: url,
    URL: url,
    ...merged,
    ...inference.fieldPatches,
    type: inference.type,
  };
  final.URL = resolveUrl(final.URL, url);
  ensureInputUrlProvenance(provenance, final.URL, options);
  // Record inference patches in provenance so multi-pass merge (cite-website)
  // keeps genre/container-title that no HTML signal extracted (e.g. YouTube Video).
  applyFieldPatchesToProvenance(provenance, inference.fieldPatches, options);
  // YouTube container patches are intentional style fields; keep them even when
  // publisher matched the pre-patch container.
  dedupePublisherContainer(final);
  if (!final.publisher) delete provenance.publisher;

  // Social metadata rides outside the merge: it isn't a bibliographic field,
  // it's render-time context (handle/descriptor conventions differ per style).
  if (platform.social) {
    final.custom = { ...final.custom, social: platform.social };
  }

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

  return {
    csl: final,
    signals,
    provenance,
    // Always pass an array (possibly empty) so quality validation does not
    // re-run host heuristics that the pipeline already resolved.
    typeWarnings: inference.warnings,
  };
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

function applyFieldPatchesToProvenance(
  provenance: Partial<Record<keyof CSLItem, FieldProvenance>>,
  patches: Partial<CSLItem>,
  options: PipelineOptions,
): void {
  for (const [key, value] of Object.entries(patches) as Array<[keyof CSLItem, unknown]>) {
    if (value === undefined || value === null) continue;
    if (key === 'id' || key === 'type' || key === 'custom') continue;
    const evidence: FieldEvidence = {
      field: key,
      normalizedValue: value,
      rawValue: typeof value === 'string' ? value : undefined,
      source: 'type-inference',
      acquisition: options.acquisition ?? 'input',
      confidence: 0.98,
      acquiredAt: options.acquiredAt,
      locator: 'source-type-inference',
    };
    const existing = provenance[key];
    if (!existing) {
      provenance[key] = { winner: evidence, candidates: [evidence], conflicts: [] };
      continue;
    }
    const candidates = [...existing.candidates, evidence];
    const winner = evidence.confidence >= (existing.winner?.confidence ?? 0)
      ? evidence
      : existing.winner ?? evidence;
    provenance[key] = {
      winner,
      candidates,
      conflicts: candidates.filter((c) => {
        try {
          return JSON.stringify(c.normalizedValue) !== JSON.stringify(winner.normalizedValue);
        } catch {
          return c.normalizedValue !== winner.normalizedValue;
        }
      }),
    };
  }
}
