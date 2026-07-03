import type { CSLItem, ExtractQuality, FieldProvenance } from '../citations/csl-types';

export const STORAGE_KEY = 'sources_v2';

export interface StoredSource {
  uuid: string;
  csl: CSLItem;
  quality?: ExtractQuality;
  provenance?: Partial<Record<keyof CSLItem, FieldProvenance>>;
  dismissedWarningKeys?: string[];
}

export function loadSources(): StoredSource[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isStoredSource);
  } catch {
    return [];
  }
}

export function saveSources(sources: StoredSource[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sources));
  } catch {
    // quota or disabled storage — silently no-op
  }
}

const VALID_CSL_TYPES = new Set([
  'webpage', 'book', 'article-journal', 'article-magazine', 'article-newspaper',
]);

export function isStoredSource(x: unknown): x is StoredSource {
  if (!x || typeof x !== 'object') return false;
  const o = x as any;
  if (typeof o.uuid !== 'string') return false;
  const csl = o.csl;
  if (!csl || typeof csl !== 'object') return false;
  if (typeof csl.id !== 'string') return false;
  if (typeof csl.type !== 'string' || !VALID_CSL_TYPES.has(csl.type)) return false;
  // Name fields, when present, must be arrays — otherwise components that map
  // over csl.author / csl.editor crash on corrupted localStorage data.
  if (csl.author !== undefined && !Array.isArray(csl.author)) return false;
  if (csl.editor !== undefined && !Array.isArray(csl.editor)) return false;
  if (o.dismissedWarningKeys !== undefined
    && (!Array.isArray(o.dismissedWarningKeys) || o.dismissedWarningKeys.some((key: unknown) => typeof key !== 'string'))) {
    return false;
  }
  return true;
}
