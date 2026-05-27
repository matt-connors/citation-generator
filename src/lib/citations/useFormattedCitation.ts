import { useEffect, useState } from 'react';
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
  const key = `${source.uuid}::${style}::${cslFingerprint(source.csl)}`;
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
    const promise = inflight.get(key) ?? (async () => {
      const res = await fetch('/api/format', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ csl: source.csl, style }),
      });
      if (!res.ok) throw new Error(`Format failed: HTTP ${res.status}`);
      const body = await res.json() as { formatted: RichText[] };
      cache.set(key, body.formatted);
      return body.formatted;
    })();
    inflight.set(key, promise);
    promise
      .then((rt) => { if (!cancelled) setState({ formatted: rt, loading: false, error: null }); })
      .catch((e: Error) => { if (!cancelled) setState({ formatted: [], loading: false, error: e.message }); })
      .finally(() => inflight.delete(key));
    return () => { cancelled = true; };
  }, [key, source.csl, style]);

  return state;
}
