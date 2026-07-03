/**
 * Detect whether an incoming API request is opting out of analytics
 * emission.
 *
 *   - Header `X-Mla-Test: 1` — works for any method (incl. POST /api/format)
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
  return false;
}
