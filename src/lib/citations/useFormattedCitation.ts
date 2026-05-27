import { useEffect, useMemo, useState } from 'react';
import type { CSLItem, RichText, SupportedStyle } from './csl-types';

interface Args {
  uuid: string;
  csl: CSLItem;
}

interface State {
  formatted: RichText[];
  loading: boolean;
  error: string | null;
}

const cache: Map<string, RichText[]> = new Map();
const inflight: Map<string, Promise<RichText[]>> = new Map();

export function _resetCacheForTests() {
  cache.clear();
  inflight.clear();
}

function cslFingerprint(csl: CSLItem): string {
  // Stable JSON serialization. CSL-JSON's authors/dates are arrays — JSON.stringify
  // preserves order, so the same logical citation produces the same fingerprint.
  // This is needed so edits to a source's csl invalidate the cached render
  // (otherwise the hook would return stale pre-edit output for an unchanged uuid).
  return JSON.stringify(csl);
}

export function useFormattedCitation(source: Args, style: SupportedStyle): State {
  // Fingerprint the CSL once per content change so render-loop callers don't
  // re-stringify on every render. `key` already encodes uuid+style+content,
  // so it's the only effect dependency we need.
  const key = useMemo(
    () => `${source.uuid}::${style}::${cslFingerprint(source.csl)}`,
    [source.uuid, source.csl, style],
  );
  const [state, setState] = useState<State>(() => {
    const hit = cache.get(key);
    return hit
      ? { formatted: hit, loading: false, error: null }
      : { formatted: [], loading: true, error: null };
  });

  useEffect(() => {
    let cancelled = false;
    const cached = cache.get(key);
    if (cached) {
      setState({ formatted: cached, loading: false, error: null });
      return;
    }
    setState((s) => ({ ...s, loading: true, error: null }));
    const promise = inflight.get(key) ?? fetchFormatted(source.csl, style, key);
    inflight.set(key, promise);
    promise
      .then((rt) => { if (!cancelled) setState({ formatted: rt, loading: false, error: null }); })
      .catch((e: Error) => { if (!cancelled) setState({ formatted: [], loading: false, error: e.message }); })
      .finally(() => inflight.delete(key));
    return () => { cancelled = true; };
  }, [key]);

  return state;
}

// Cache-aware fetch used by the hook and exported for callers (e.g. Copy
// Selected) that need the same memoization but outside the React tree.
async function fetchFormatted(csl: CSLItem, style: SupportedStyle, key: string): Promise<RichText[]> {
  const res = await fetch('/api/format', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ csl, style }),
  });
  if (!res.ok) throw new Error(`Format failed: HTTP ${res.status}`);
  const body = await res.json() as { formatted: RichText[] };
  cache.set(key, body.formatted);
  return body.formatted;
}

export function formatCitation(source: Args, style: SupportedStyle): Promise<RichText[]> {
  const key = `${source.uuid}::${style}::${cslFingerprint(source.csl)}`;
  const cached = cache.get(key);
  if (cached) return Promise.resolve(cached);
  const promise = inflight.get(key) ?? fetchFormatted(source.csl, style, key);
  inflight.set(key, promise);
  // The hook-side .then/.catch absorbs the rejection on its own chain; this
  // bookkeeping chain needs its own catch or rejections surface as uncaught
  // when fetchFormatted fails (5xx, network) and no one else is awaiting `key`.
  promise.finally(() => inflight.delete(key)).catch(() => { /* swallowed; caller's await sees it */ });
  return promise;
}
