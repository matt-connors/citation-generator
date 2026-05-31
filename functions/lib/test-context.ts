/**
 * Detect whether an incoming API request is opting out of analytics
 * emission. Two signals, either is sufficient:
 *
 *   - Header `X-Mla-Test: 1` — works for any method (incl. POST /api/format)
 *   - Query `?nocache=1`     — reuses the existing cache-bypass convention
 *
 * Handlers consult this once at the request boundary and pass `undefined`
 * for the analytics binding when it returns true. The writeEvent function
 * then no-ops as it does for any other absent binding — there's no
 * separate "test event" stored in the dataset; the row simply doesn't
 * exist.
 *
 * This is a filter on emission, not a flag on the row. We want test
 * traffic to be truly absent from dashboards, not just hidden behind a
 * WHERE clause.
 */
export function isTestRequest(req: Request): boolean {
  if (req.headers.get('x-mla-test') === '1') return true;
  try {
    if (new URL(req.url).searchParams.get('nocache') === '1') return true;
  } catch {
    /* malformed URL — treat as non-test */
  }
  return false;
}
