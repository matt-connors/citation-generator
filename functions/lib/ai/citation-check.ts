import type { CitationQualityWarning, CSLItem, SupportedStyle } from '../csl-types';
import type { AiBinding } from './citation-assist';

const DEFAULT_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';

export interface AiCitationCheckInput {
  ai: AiBinding;
  model?: string;
  csl: CSLItem;
  style: SupportedStyle;
  existingWarnings: CitationQualityWarning[];
}

const CHECK_SCHEMA = {
  type: 'object',
  properties: {
    warnings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          code: { type: 'string' },
          field: { type: 'string' },
          severity: { type: 'string', enum: ['info', 'review', 'warning'] },
          message: { type: 'string' },
        },
        required: ['code', 'severity', 'message'],
      },
    },
  },
  required: ['warnings'],
};

export async function runAiCitationCheck(input: AiCitationCheckInput): Promise<CitationQualityWarning[]> {
  const response = await input.ai.run(input.model || DEFAULT_MODEL, {
    messages: [
      {
        role: 'system',
        content: [
          'You review citation metadata for internal consistency only.',
          'Use only the provided CSL object and existing warnings.',
          'Do not invent facts about the source.',
          'Return additional review warnings only when a user should inspect a field.',
        ].join(' '),
      },
      {
        role: 'user',
        content: JSON.stringify({
          style: input.style,
          csl: input.csl,
          existingWarnings: input.existingWarnings,
        }),
      },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: CHECK_SCHEMA,
    },
  });
  return parseWarnings(response);
}

function parseWarnings(response: unknown): CitationQualityWarning[] {
  const parsed = parseModelJson(response);
  const warnings = parsed?.warnings;
  if (!Array.isArray(warnings)) return [];
  return warnings
    .map((warning): CitationQualityWarning | null => {
      if (!warning || typeof warning !== 'object') return null;
      const w = warning as Record<string, unknown>;
      if (typeof w.code !== 'string' || typeof w.message !== 'string') return null;
      const severity = w.severity === 'warning' || w.severity === 'review' || w.severity === 'info'
        ? w.severity
        : 'review';
      return {
        code: w.code.startsWith('ai_') ? w.code : `ai_${w.code}`,
        field: typeof w.field === 'string' ? w.field as keyof CSLItem : undefined,
        severity,
        message: w.message,
        action: 'review-field',
      };
    })
    .filter((warning): warning is CitationQualityWarning => !!warning)
    .slice(0, 3);
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
  if (Array.isArray(obj.warnings)) return obj;
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
