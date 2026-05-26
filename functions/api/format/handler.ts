import type { CSLItem, FormatRequest, FormatResponse, SupportedStyle } from '../../lib/csl-types';
import { formatCitation } from '../../lib/format/citeproc';

const SUPPORTED: SupportedStyle[] = ['mla-9', 'apa-7', 'chicago-18', 'ama-11', 'harvard', 'ieee', 'vancouver'];

export async function handleFormat(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return error(405, 'method_not_allowed', 'POST required');
  }
  let parsed: FormatRequest;
  try {
    parsed = await req.json() as FormatRequest;
  } catch {
    return error(400, 'bad_request', 'Body must be JSON');
  }
  if (!parsed || !parsed.csl || typeof parsed.csl !== 'object') {
    return error(400, 'bad_request', 'Missing csl');
  }
  if (!parsed.style || !SUPPORTED.includes(parsed.style)) {
    return error(400, 'bad_request', `Unsupported style. Allowed: ${SUPPORTED.join(', ')}`);
  }
  try {
    const formatted = formatCitation(parsed.csl as CSLItem, parsed.style);
    const body: FormatResponse = { formatted };
    return new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } });
  } catch (e) {
    return error(500, 'internal', `Format failed: ${(e as Error).message}`);
  }
}

function error(status: number, code: string, message: string): Response {
  return new Response(JSON.stringify({ error: message, code, retryable: false }), {
    status, headers: { 'content-type': 'application/json' },
  });
}
