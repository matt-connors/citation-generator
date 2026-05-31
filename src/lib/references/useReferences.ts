import { useState, useEffect, useCallback } from 'react';
import { loadSources, saveSources, type StoredSource } from './storage';
import type { CSLItem, SupportedStyle } from '../citations/csl-types';

export interface UseReferencesReturn {
  sources: StoredSource[];
  sourceCount: number;
  checkedCount: number;
  citationFormat: SupportedStyle;
  setSources: (sources: StoredSource[] | ((prev: StoredSource[]) => StoredSource[])) => void;
  setCheckedCount: (count: number) => void;
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
  const [checkedCount, setCheckedCount] = useState(0);
  const [citationFormat, setCitationFormatState] = useState<SupportedStyle>('mla-9');

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

  const handleDelete = useCallback(() => {
    const remaining: StoredSource[] = [];
    sources.forEach((s, i) => {
      const cb = document.querySelector(`#source-${i}`) as HTMLInputElement | null;
      if (!cb?.checked) remaining.push(s);
    });
    setSources(remaining);
    setCheckedCount(0);
  }, [sources, setSources]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const styleParam = params.get('citationStyle');
    if (isSupportedStyle(styleParam)) setCitationFormatState(styleParam);

    const existing = loadSources();
    setSourcesState(existing);

    const website = params.get('website');
    const book = params.get('book');
    const journal = params.get('journal') || params.get('doi');
    let requestUrl: string | null = null;
    if (website) requestUrl = `/api/cite-website?url=${encodeURIComponent(website)}`;
    else if (book) requestUrl = `/api/cite-book?isbn=${encodeURIComponent(book)}`;
    else if (journal) requestUrl = `/api/cite-journal?doi=${encodeURIComponent(journal)}`;
    if (!requestUrl) return;

    let cancelled = false;
    // Bound the request so a slow/hung backend can't leave the page spinning
    // forever; abort on unmount so a late response can't update stale state.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    fetch(requestUrl, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<ApiEnvelope>;
      })
      .then((env) => {
        if (cancelled || !env?.csl) return;
        if (existing.some((s) => s.uuid === env.uuid)) return;
        const merged = [...existing, { uuid: env.uuid, csl: env.csl }];
        setSources(merged);
      })
      .catch((err) => { if (!cancelled) console.error('Citation fetch failed', err); })
      .finally(() => clearTimeout(timeout));
    return () => { cancelled = true; controller.abort(); clearTimeout(timeout); };
  }, [setSources]);

  return {
    sources,
    sourceCount: sources.length,
    checkedCount,
    citationFormat,
    setSources,
    setCheckedCount,
    setCitationFormat,
    handleDelete,
  };
}
