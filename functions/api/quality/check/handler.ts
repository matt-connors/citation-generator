import type { CSLItem, ExtractQuality, FieldProvenance, SupportedStyle } from '../../../lib/csl-types';
import { validateCitationQuality } from '../../../lib/validation/citation-quality';
import { runAiCitationCheck } from '../../../lib/ai/citation-check';
import type { AiBinding } from '../../../lib/ai/citation-assist';

const SUPPORTED_STYLES: SupportedStyle[] = ['mla-9', 'apa-7', 'chicago-18', 'ama-11', 'harvard', 'ieee', 'vancouver'];

export interface QualityCheckDeps {
  ai?: AiBinding;
  aiModel?: string;
  aiCheckEnabled?: boolean;
}

interface QualityCheckRequest {
  csl?: CSLItem;
  style?: SupportedStyle;
  provenance?: Partial<Record<keyof CSLItem, FieldProvenance>>;
}

export async function handleQualityCheck(request: Request, deps: QualityCheckDeps = {}): Promise<Response> {
  let body: QualityCheckRequest;
  try {
    body = await request.json() as QualityCheckRequest;
  } catch {
    return json({ error: 'Invalid JSON', code: 'bad_request' }, 400);
  }

  if (!body.csl || typeof body.csl !== 'object') {
    return json({ error: 'Missing csl', code: 'bad_request' }, 400);
  }
  const style = SUPPORTED_STYLES.includes(body.style as SupportedStyle) ? body.style as SupportedStyle : 'mla-9';
  const base = validateCitationQuality(body.csl, {
    style,
    provenance: body.provenance,
  });

  let quality: ExtractQuality = base;
  if (deps.aiCheckEnabled && deps.ai) {
    try {
      const aiWarnings = await runAiCitationCheck({
        ai: deps.ai,
        model: deps.aiModel,
        csl: body.csl,
        style,
        existingWarnings: base.warnings,
      });
      quality = {
        ...base,
        warnings: [...base.warnings, ...aiWarnings],
        score: Math.max(0, base.score - aiWarnings.length * 5),
      };
    } catch {
      quality = base;
    }
  }

  return json({ quality });
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}
