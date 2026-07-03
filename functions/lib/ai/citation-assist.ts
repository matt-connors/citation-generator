import type { CSLDate, CSLItem, FieldEvidence } from '../csl-types';
import { parseAuthorList } from '../extract/author-parse';
import { parseDate } from '../extract/date-parse';

const DEFAULT_MODEL = '@cf/meta/llama-3.1-8b-instruct-fast';
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
  const sourceText = combinedSourceText(input);
  if (sourceText.length < 50) return [];

  const response = await input.ai.run(input.model || DEFAULT_MODEL, {
    messages: [
      {
        role: 'system',
        content: [
          'You extract citation fields only from provided source text.',
          'Do not invent missing fields.',
          'For every proposal, evidenceSnippet MUST be copied verbatim from the provided text, and value MUST appear verbatim inside that evidenceSnippet.',
          'Copy each value exactly as written in the text — do not reformat, translate, abbreviate, or normalize it (e.g. keep a date as "January 15, 2026" exactly as printed; do not convert it to another format).',
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

  return parseAiProposals(response)
    .map((proposal) => evidenceFromProposal(proposal, input, sourceText))
    .filter((item): item is FieldEvidence => !!item);
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
  sourceText: string,
): FieldEvidence | null {
  if (!Number.isFinite(proposal.confidence) || proposal.confidence < MIN_CONFIDENCE || proposal.confidence > 1) return null;
  const snippet = normalizeText(proposal.evidenceSnippet);
  // The cited snippet must appear verbatim in the page text.
  if (!snippet || !normalizeText(sourceText).includes(snippet)) return null;
  // ...and the proposed value must itself appear verbatim inside that snippet.
  // Snippet-in-page alone is NOT sufficient: without this gate a model can quote
  // any real page sentence as evidence and pair it with a fabricated value
  // (hallucinated author/date/DOI). Requiring value ⊆ snippet ⊆ page is the core
  // guardrail invariant — the AI may only surface a value already present on the
  // page, never one it invented.
  if (!valueSupportedBySnippet(proposal.value, snippet)) return null;
  const normalizedValue = normalizeFieldValue(proposal.field, proposal.value);
  if (normalizedValue === undefined) return null;
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
  if (typeof value === 'string') return [value];
  if (typeof value === 'number' && Number.isFinite(value)) return [String(value)];
  if (Array.isArray(value)) {
    const out: string[] = [];
    for (const item of value) {
      if (typeof item === 'string') out.push(item);
      else if (typeof item === 'number' && Number.isFinite(item)) out.push(String(item));
      else return []; // an unverifiable element invalidates the whole list
    }
    return out;
  }
  return []; // objects (including { 'date-parts': ... }) are unverifiable here
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

function combinedSourceText(input: AiAssistInput): string {
  return `${input.fetchedText || ''}\n${input.renderedText || ''}`.trim();
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim().toLowerCase();
}
