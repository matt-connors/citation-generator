import type { CSLDate, CSLItem, FieldEvidence } from '../csl-types';
import { parseAuthorList } from '../extract/author-parse';
import { parseDate } from '../extract/date-parse';

// Stronger default model: the 8B was too weak to produce verbatim-verifiable
// proposals in practice (added nothing in prod smoke tests). Overridable via
// AI_CITATION_MODEL / AI_GATEWAY_MODEL.
const DEFAULT_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
const MIN_CONFIDENCE = 0.7;

export interface AiBinding {
  run(model: string, input: Record<string, unknown>): Promise<unknown>;
}

export interface AiAssistInput {
  ai: AiBinding;
  model?: string;
  csl: CSLItem;
  fetchedText?: string;
  renderedText?: string;
  url: string;
  acquiredAt?: string;
}

interface AiProposal {
  field: keyof CSLItem;
  value: unknown;
  evidenceSnippet: string;
  evidenceSource: 'fetched' | 'rendered' | 'pasted' | 'extension';
  rationale?: string;
  confidence: number;
}

const FIELD_SCHEMA = {
  type: 'object',
  properties: {
    proposals: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          field: {
            type: 'string',
            enum: ['title', 'author', 'issued', 'publisher', 'container-title', 'URL', 'DOI', 'volume', 'issue', 'page', 'abstract'],
          },
          value: {},
          evidenceSnippet: { type: 'string' },
          evidenceSource: { type: 'string', enum: ['fetched', 'rendered', 'pasted', 'extension'] },
          rationale: { type: 'string' },
          confidence: { type: 'number' },
        },
        required: ['field', 'value', 'evidenceSnippet', 'evidenceSource', 'confidence'],
      },
    },
  },
  required: ['proposals'],
};

export async function runAiFieldAssist(input: AiAssistInput): Promise<FieldEvidence[]> {
  // Keep each source document separate. A snippet must live verbatim inside ONE
  // document — never spanning a fetched/rendered boundary — or a value could be
  // synthesized across the join of two unrelated texts.
  const normalizedSources = [input.fetchedText, input.renderedText]
    .filter((text): text is string => typeof text === 'string' && text.trim().length > 0)
    .map(normalizeText);
  const totalLength = normalizedSources.reduce((sum, text) => sum + text.length, 0);
  if (totalLength < 50) return [];

  const response = await input.ai.run(input.model || DEFAULT_MODEL, {
    messages: [
      {
        role: 'system',
        content: [
          'You extract citation fields only from provided source text.',
          'Do not invent missing fields.',
          'For every proposal, evidenceSnippet MUST be copied verbatim from the provided text, and value MUST appear verbatim inside that evidenceSnippet.',
          'Return every value as a string, copied exactly as written in the text — do not reformat, translate, abbreviate, or normalize it (e.g. keep a date as "January 15, 2026" exactly as printed; do not convert it to another format).',
          'A snippet must be copied from a single source field; never stitch text across fetchedText and renderedText.',
          'If a field is not stated verbatim in the text, omit it rather than guessing.',
          'Do not format citations.',
        ].join(' '),
      },
      {
        role: 'user',
        content: JSON.stringify({
          url: input.url,
          existingCsl: input.csl,
          missingFields: missingFields(input.csl),
          fetchedText: input.fetchedText || '',
          renderedText: input.renderedText || '',
        }),
      },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: FIELD_SCHEMA,
    },
  });

  const accepted = parseAiProposals(response)
    .map((proposal) => evidenceFromProposal(proposal, input, normalizedSources))
    .filter((item): item is FieldEvidence => !!item);

  // Deterministic one-evidence-per-field: if the model proposes a field twice,
  // keep the highest-confidence acceptance (first wins on a tie) so a later
  // proposal can't silently overwrite an earlier one downstream.
  const byField = new Map<keyof CSLItem, FieldEvidence>();
  for (const item of accepted) {
    const prev = byField.get(item.field);
    if (!prev || item.confidence > prev.confidence) byField.set(item.field, item);
  }
  return [...byField.values()];
}

function parseAiProposals(response: unknown): AiProposal[] {
  const parsed = parseModelJson(response);
  const proposals = parsed?.proposals;
  if (!Array.isArray(proposals)) return [];
  return proposals.filter((item): item is AiProposal => {
    if (!item || typeof item !== 'object') return false;
    const proposal = item as AiProposal;
    return typeof proposal.field === 'string'
      && proposal.value !== undefined
      && typeof proposal.evidenceSnippet === 'string'
      && typeof proposal.evidenceSource === 'string'
      && typeof proposal.confidence === 'number';
  });
}

function parseModelJson(response: unknown): any {
  if (!response) return null;
  if (typeof response === 'string') return parseJson(response);
  if (typeof response !== 'object') return null;
  const obj = response as Record<string, any>;
  for (const key of ['response', 'result', 'content', 'text']) {
    if (typeof obj[key] === 'string') {
      const parsed = parseJson(obj[key]);
      if (parsed) return parsed;
    }
    if (obj[key] && typeof obj[key] === 'object') {
      const parsed = parseModelJson(obj[key]);
      if (parsed) return parsed;
    }
  }
  if (Array.isArray(obj.choices)) {
    for (const choice of obj.choices) {
      const parsed = parseModelJson(choice?.message?.content ?? choice?.text);
      if (parsed) return parsed;
    }
  }
  if (Array.isArray(obj.proposals)) return obj;
  return null;
}

function parseJson(value: string): any {
  try {
    return JSON.parse(value);
  } catch {
    const match = value.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

function evidenceFromProposal(
  proposal: AiProposal,
  input: AiAssistInput,
  normalizedSources: string[],
): FieldEvidence | null {
  if (!Number.isFinite(proposal.confidence) || proposal.confidence < MIN_CONFIDENCE || proposal.confidence > 1) return null;
  const snippet = normalizeText(proposal.evidenceSnippet);
  // The cited snippet must appear verbatim within a SINGLE source document (not
  // across the fetched/rendered join — that would let a value be stitched from
  // two unrelated texts).
  if (!snippet || !normalizedSources.some((source) => source.includes(snippet))) return null;
  // ...and the proposed value must itself appear verbatim inside that snippet.
  // Snippet-in-page alone is NOT sufficient: without this gate a model can quote
  // any real page sentence as evidence and pair it with a fabricated value
  // (hallucinated author/date/DOI). Requiring value ⊆ snippet ⊆ page is the core
  // guardrail invariant — the AI may only surface a value already present on the
  // page, never one it invented.
  if (!valueSupportedBySnippet(proposal.value, snippet)) return null;
  const normalizedValue = normalizeFieldValue(proposal.field, proposal.value);
  if (normalizedValue === undefined) return null;
  // Cheap field-shape sanity: reject values whose surface form can't be that
  // field (e.g. body prose misattributed to DOI). This does not — and cannot by
  // substring alone — catch semantic misattribution of plausibly-shaped text
  // (a person named in the body proposed as author); ai-extract stays low-trust.
  if (!fieldShapeValid(proposal.field, normalizedValue)) return null;
  if ((input.csl as any)[proposal.field] !== undefined) return null;
  return {
    field: proposal.field,
    normalizedValue,
    rawValue: typeof proposal.value === 'string' ? proposal.value : JSON.stringify(proposal.value),
    source: 'ai-extract',
    acquisition: 'ai',
    snippet: proposal.evidenceSnippet,
    confidence: Math.min(0.82, proposal.confidence),
    acquiredAt: input.acquiredAt,
  };
}

// A proposed value is only trustworthy if it literally appears inside the cited
// evidence snippet (which itself must be verbatim page text — see caller). This
// enforces the guardrail invariant that the AI may only surface a value already
// present on the page, never one it invented. Values we cannot reduce to plain
// strings for this check — structured objects, notably `{ 'date-parts': ... }` —
// are treated as unverifiable and rejected, so a model must quote dates/values as
// text (per the system prompt) to have them accepted.
function valueSupportedBySnippet(value: unknown, normalizedSnippet: string): boolean {
  const parts = supportStrings(value);
  if (!parts.length) return false;
  return parts.every((part) => {
    const norm = normalizeText(part);
    return norm.length > 0 && normalizedSnippet.includes(norm);
  });
}

function supportStrings(value: unknown): string[] {
  // Only strings (or arrays of strings) are verifiable against the text. Numbers
  // are rejected so a bare digit-run on the page (e.g. a year "2026") can't be
  // coerced into volume/issue/page, nor a number slipped into an author list.
  if (typeof value === 'string') return value.trim() ? [value] : [];
  if (Array.isArray(value)) {
    if (value.length === 0) return [];
    const out: string[] = [];
    for (const item of value) {
      if (typeof item === 'string' && item.trim()) out.push(item);
      else return []; // an unverifiable/empty element invalidates the whole list
    }
    return out;
  }
  return []; // numbers, objects (incl. { 'date-parts': ... }), booleans, null
}

// Cheap, surface-form-only validation that a normalized value could plausibly be
// the given field. Intentionally minimal — it guards the egregious cases (random
// text into DOI) without pretending to verify semantic correctness.
function fieldShapeValid(field: keyof CSLItem, normalizedValue: unknown): boolean {
  if (field === 'DOI') {
    const doi = String(normalizedValue).replace(/^doi:\s*/i, '').replace(/^https?:\/\/(dx\.)?doi\.org\//i, '');
    return /^10\.\d{4,9}\/\S+$/.test(doi);
  }
  return true;
}

function normalizeFieldValue(field: keyof CSLItem, value: unknown): unknown {
  if (field === 'author') {
    if (Array.isArray(value)) {
      const parsed = value.flatMap((item) => parseAuthorList(String(item)));
      return parsed.length ? parsed : undefined;
    }
    if (typeof value === 'string') {
      const parsed = parseAuthorList(value);
      return parsed.length ? parsed : undefined;
    }
    return undefined;
  }
  if (field === 'issued') {
    if (typeof value === 'string') return dateFromString(value);
    if (value && typeof value === 'object' && Array.isArray((value as CSLDate)['date-parts'])) return value;
    return undefined;
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const text = String(value).replace(/\s+/g, ' ').trim();
    return text || undefined;
  }
  return undefined;
}

function dateFromString(value: string): CSLDate | undefined {
  const parsed = parseDate(value);
  return parsed ? { 'date-parts': [parsed], raw: value } : undefined;
}

function missingFields(csl: CSLItem): string[] {
  const out: string[] = [];
  if (!csl.title) out.push('title');
  if (!csl.author?.length) out.push('author');
  if (!csl.issued?.['date-parts']?.[0]?.[0]) out.push('issued');
  if (!csl.publisher) out.push('publisher');
  if (!csl['container-title']) out.push('container-title');
  return out;
}

// Canonicalize text for verbatim comparison. Folds only *cosmetic* differences
// (unicode form, curly quotes/apostrophes, en/em dashes) that would otherwise
// drop legitimate values whose surface form differs trivially from the page.
// Applied symmetrically to both value and page text, so it never admits a
// semantically different value — same principle as the conflict-normalization.
function normalizeText(value: string): string {
  return value
    .normalize('NFC')
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}
