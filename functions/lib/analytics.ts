/**
 * Cloudflare Analytics Engine dataset binding. Matches the runtime shape
 * Workers/Pages expose; we re-declare instead of importing
 * @cloudflare/workers-types because the rest of the project keeps that
 * dependency out and inlines the few types it needs (see
 * `PagesFunction` usage in functions/api/**\/index.ts).
 */
export interface AnalyticsBinding {
  writeDataPoint(point: { blobs?: string[]; doubles?: number[]; indexes?: string[] }): void;
}

/**
 * Emit one event to the Analytics Engine dataset, if the binding exists.
 *
 * Storage layout (Analytics Engine is positional, not keyed):
 *   blobs[0]   = event name
 *   blobs[1..] = dimension values in iteration order
 *   doubles[0..] = metric values in iteration order
 *   indexes[0] = event name (for fast WHERE filtering in SQL)
 *
 * Missing binding = no-op. Analytics is never load-bearing for citation
 * correctness; the dataset can be deployed after the code if the
 * Cloudflare dashboard hasn't been touched yet.
 *
 * IMPORTANT: dimension / metric ORDER is the storage column order. The
 * dashboard SQL refers to columns positionally as blob2, blob3,
 * double1, double2... Renaming the keys at the call site is harmless;
 * reordering them is silently breaking. See docs/analytics.md for the
 * column→meaning mapping that downstream queries depend on.
 */
/**
 * Extract the guide-attribution slug from a cite request URL. The embedded
 * generator on /guides/* pages appends `from=<guide-slug>` to the search it
 * submits, and /my-references forwards it to the cite API. Returns '' when
 * absent or not slug-shaped, so callers can unconditionally append it as a
 * trailing analytics dimension (positional storage: appending a dimension at
 * the END of an event's dimension list is the only safe schema change).
 */
export function fromAttribution(requestUrl: URL): string {
  const raw = requestUrl.searchParams.get('from') ?? '';
  return /^[a-z0-9-]{1,64}$/.test(raw) ? raw : '';
}

export function writeEvent(
  analytics: AnalyticsBinding | undefined,
  event: string,
  dimensions: Record<string, string>,
  metrics: Record<string, number>,
): void {
  analytics?.writeDataPoint({
    blobs: [event, ...Object.values(dimensions)],
    doubles: Object.values(metrics),
    indexes: [event],
  });
}
