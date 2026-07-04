import { useState, useEffect, useCallback, useRef } from 'react';
import { loadSources, saveSources, STORAGE_KEY, type StoredSource } from './storage';
import { decodeInlineCslParam, INLINE_CSL_PARAM } from './inline-csl';
import type { CSLItem, ExtractQuality, FieldProvenance, SupportedStyle } from '../citations/csl-types';

// A citation request that is in flight. Kept in component-only state and NEVER
// persisted, so a loading placeholder can never leak into localStorage.
export interface PendingSource {
  id: string;
  kind: 'website' | 'book' | 'journal';
  url?: string;
}

export interface UseReferencesReturn {
  sources: StoredSource[];
  pending: PendingSource[];
  sourceCount: number;
  selected: ReadonlySet<string>;
  selectedCount: number;
  citationFormat: SupportedStyle;
  setSources: (sources: StoredSource[] | ((prev: StoredSource[]) => StoredSource[])) => void;
  toggleSelected: (uuid: string, checked: boolean) => void;
  selectAll: (checked: boolean) => void;
  setCitationFormat: (format: SupportedStyle) => void;
  handleDelete: () => void;
}

const STYLES: SupportedStyle[] = ['mla-9', 'apa-7', 'chicago-18', 'ama-11', 'harvard', 'ieee', 'vancouver'];

function isSupportedStyle(s: string | null): s is SupportedStyle {
  return !!s && (STYLES as string[]).includes(s);
}

interface ApiEnvelope {
  uuid: string;
  type: CSLItem['type'];
  csl: CSLItem;
  _quality?: ExtractQuality;
  _provenance?: Partial<Record<keyof CSLItem, FieldProvenance>>;
}

export function useReferences(): UseReferencesReturn {
  const [sources, setSourcesState] = useState<StoredSource[]>([]);
  const [pending, setPending] = useState<PendingSource[]>([]);
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set());
  const [citationFormat, setCitationFormatState] = useState<SupportedStyle>('mla-9');

  // Mirror sources into a ref so callbacks with stable identities (e.g.
  // selectAll, captured before an in-flight fetch resolves) still read the
  // latest list, not the snapshot from the render that created the closure.
  const sourcesRef = useRef(sources);
  useEffect(() => { sourcesRef.current = sources; }, [sources]);

  const setSources = useCallback((next: StoredSource[] | ((prev: StoredSource[]) => StoredSource[])) => {
    setSourcesState((prev) => {
      const computed = typeof next === 'function' ? (next as any)(prev) : next;
      // Keep provenance in memory for this session, but never persist it: it is
      // large (per-field candidate evidence), the client only reads `quality`
      // for warnings, and saveSources silently drops the whole write on quota
      // overflow — so a bulky provenance blob could cost the user saved sources.
      saveSources(computed.map(stripProvenanceForStorage));
      return computed;
    });
  }, []);

  const setCitationFormat = useCallback((s: SupportedStyle) => {
    setCitationFormatState(s);
  }, []);

  const toggleSelected = useCallback((uuid: string, checked: boolean) => {
    setSelected((prev) => {
      if (checked === prev.has(uuid)) return prev;
      const next = new Set(prev);
      if (checked) next.add(uuid); else next.delete(uuid);
      return next;
    });
  }, []);

  const selectAll = useCallback((checked: boolean) => {
    setSelected(checked ? new Set(sourcesRef.current.map((s) => s.uuid)) : new Set());
  }, []);

  const handleDelete = useCallback(() => {
    setSources((prev) => prev.filter((s) => !selected.has(s.uuid)));
    setSelected(new Set());
  }, [selected, setSources]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const styleParam = params.get('citationStyle');
    if (isSupportedStyle(styleParam)) setCitationFormatState(styleParam);

    const existing = loadSources();
    const inlineSource = decodeInlineCslParam(params.get(INLINE_CSL_PARAM));
    if (inlineSource) {
      const next = existing.some((source) => source.uuid === inlineSource.uuid || source.csl.id === inlineSource.csl.id)
        ? existing
        : [...existing, inlineSource];
      setSourcesState(next);
      if (next !== existing) saveSources(next);
      params.delete(INLINE_CSL_PARAM);
      try {
        const search = params.toString();
        window.history.replaceState({}, '', `${window.location.pathname}${search ? `?${search}` : ''}${window.location.hash}`);
      } catch {
        // URL cleanup is best-effort; the import itself has already succeeded.
      }
      return;
    }

    setSourcesState(existing);

    const website = params.get('website');
    const book = params.get('book');
    const journal = params.get('journal') || params.get('doi');
    let requestUrl: string | null = null;
    if (website) requestUrl = `/api/cite-website?url=${encodeURIComponent(website)}`;
    else if (book) requestUrl = `/api/cite-book?isbn=${encodeURIComponent(book)}`;
    else if (journal) requestUrl = `/api/cite-journal?doi=${encodeURIComponent(journal)}`;
    if (!requestUrl) return;

    // Show a loading skeleton for this request immediately (component-only
    // state, never persisted) so the user sees what they're waiting for.
    const kind: PendingSource['kind'] = website ? 'website' : book ? 'book' : 'journal';
    const pendingValue = website || book || journal || '';
    const pendingId = `pending:${kind}:${pendingValue}`;
    setPending((p) => (p.some((x) => x.id === pendingId) ? p : [...p, { id: pendingId, kind, url: pendingValue }]));
    const clearPending = () => setPending((p) => p.filter((x) => x.id !== pendingId));

    // Functional updater (not a closed-over `existing`) so manual citations the
    // user added between mount and fetch resolution aren't clobbered.
    const addEnvelope = (env: ApiEnvelope) => {
      setSources((prev) => prev.some((s) => s.uuid === env.uuid)
        ? prev
        : [...prev, {
          uuid: env.uuid,
          csl: env.csl,
          quality: env._quality,
          provenance: env._provenance,
        }]);
    };

    let cancelled = false;
    // Bound the request so a slow/hung backend can't leave the page spinning
    // forever; abort on unmount so a late response can't update stale state.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    fetch(requestUrl, { signal: controller.signal })
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          if (website) return errorEnvelopeFromWebsite(website, body);
          throw new Error(`HTTP ${res.status}`);
        }
        return body as ApiEnvelope;
      })
      .then((env) => {
        if (cancelled || !env?.csl) return;
        addEnvelope(env);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('Citation fetch failed', err);
        // A timeout / network abort still resolves the skeleton to an actionable
        // card for websites, instead of letting the placeholder vanish silently.
        if (website) addEnvelope(errorEnvelopeFromWebsite(website, {}));
      })
      .finally(() => { clearTimeout(timeout); clearPending(); });
    return () => { cancelled = true; controller.abort(); clearTimeout(timeout); clearPending(); };
  }, [setSources]);

  // Reload when another tab writes our localStorage key so two open tabs don't
  // clobber each other's references on the next save. The `storage` event fires
  // only in OTHER tabs, so this never loops with the writing tab.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setSourcesState(loadSources());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // Prune stale uuids when sources change (e.g. deletions outside handleDelete).
  useEffect(() => {
    setSelected((prev) => {
      if (prev.size === 0) return prev;
      const valid = new Set(sources.map((s) => s.uuid));
      let changed = false;
      const next = new Set<string>();
      for (const id of prev) {
        if (valid.has(id)) next.add(id); else changed = true;
      }
      return changed ? next : prev;
    });
  }, [sources]);

  // No useMemo on the returned object: `selectAll` and `handleDelete` depend on
  // state that changes on every meaningful update, so a memo never hits — it
  // would only pay the shallow-compare cost without benefit.
  return {
    sources,
    pending,
    sourceCount: sources.length,
    selected,
    selectedCount: selected.size,
    citationFormat,
    setSources,
    toggleSelected,
    selectAll,
    setCitationFormat,
    handleDelete,
  };
}

function stripProvenanceForStorage(source: StoredSource): StoredSource {
  if (source.provenance === undefined) return source;
  const copy = { ...source };
  delete copy.provenance;
  return copy;
}

function errorEnvelopeFromWebsite(website: string, body: any): ApiEnvelope {
  const code = typeof body?.code === 'string' ? body.code : 'fetch_failed';
  const blocked = code === 'blocked' || /blocked|captcha|access/i.test(String(body?.error || ''));
  const message = blocked
    ? 'This site blocked automated access. Use the browser extension, paste page text, or enter the citation details manually.'
    : 'We could not fetch this source automatically. Use the browser extension, paste page text, or enter the citation details manually.';
  return {
    uuid: website,
    type: 'webpage',
    csl: {
      id: website,
      type: 'webpage',
      URL: website,
    },
    _quality: {
      score: 40,
      warnings: [{
        code: blocked ? 'fetch_blocked' : 'fetch_failed',
        severity: blocked ? 'warning' : 'review',
        message,
        action: blocked ? 'use-extension' : 'enter-manually',
      }],
      acquisition: {
        fetch: {
          source: 'fetch',
          status: blocked ? 'blocked' : 'error',
          reason: String(body?.error || code),
          url: website,
        },
      },
    },
  };
}
