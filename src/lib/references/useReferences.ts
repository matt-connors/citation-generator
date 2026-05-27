import { useState, useEffect, useCallback, useRef } from 'react';
import { loadSources, saveSources, type StoredSource } from './storage';
import type { CSLItem, SupportedStyle } from '../citations/csl-types';

export interface UseReferencesReturn {
  sources: StoredSource[];
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
}

export function useReferences(): UseReferencesReturn {
  const [sources, setSourcesState] = useState<StoredSource[]>([]);
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
      saveSources(computed);
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

    setSourcesState(loadSources());

    const website = params.get('website');
    const book = params.get('book');
    const journal = params.get('journal') || params.get('doi');
    let requestUrl: string | null = null;
    if (website) requestUrl = `/api/cite-website?url=${encodeURIComponent(website)}`;
    else if (book) requestUrl = `/api/cite-book?isbn=${encodeURIComponent(book)}`;
    else if (journal) requestUrl = `/api/cite-journal?doi=${encodeURIComponent(journal)}`;
    if (!requestUrl) return;

    let cancelled = false;
    fetch(requestUrl)
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<ApiEnvelope>;
      })
      .then((env) => {
        if (cancelled || !env?.csl) return;
        // Functional updater (not a closed-over `existing`) so manual citations
        // the user added between mount and fetch resolution aren't clobbered.
        setSources((prev) => prev.some((s) => s.uuid === env.uuid)
          ? prev
          : [...prev, { uuid: env.uuid, csl: env.csl }]);
      })
      .catch((err) => console.error('Citation fetch failed', err));
    return () => { cancelled = true; };
  }, [setSources]);

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
