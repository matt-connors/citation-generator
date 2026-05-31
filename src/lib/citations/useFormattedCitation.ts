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

// Stably sort object keys at every nesting level so two CSL items with
// identical content but different insertion order produce the same string.
// JSON.stringify's array-replacer would have been tempting here but is an
// allow-list applied at every depth — it drops nested keys not in the
// top-level list (author[].family, etc.), producing identical fingerprints
// for distinct citations. Hence the recursive copy.
function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(value as Record<string, unknown>).sort()) {
      out[k] = sortKeysDeep((value as Record<string, unknown>)[k]);
    }
    return out;
  }
  return value;
}

function cslFingerprint(csl: CSLItem): string {
  return JSON.stringify(sortKeysDeep(csl));
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
  // Bound the request so a slow/hung /api/format can't leave rows stuck on
  // "Loading…" forever. The timeout is owned here (on the shared request) and
  // flows into the hook's existing .catch → error state; we deliberately do NOT
  // abort from a per-row effect cleanup, which would reject the shared promise
  // for sibling rows and Copy-Selected.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const res = await fetch('/api/format', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ csl, style }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`Format failed: HTTP ${res.status}`);
    const body = await res.json() as { formatted: RichText[] };
    cache.set(key, body.formatted);
    return body.formatted;
  } finally {
    clearTimeout(timeout);
  }
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
