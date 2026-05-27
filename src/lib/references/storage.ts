import type { CSLItem } from '../citations/csl-types';

export const STORAGE_KEY = 'sources_v2';

export interface StoredSource {
  uuid: string;
  csl: CSLItem;
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

function isStoredSource(x: unknown): x is StoredSource {
  if (!x || typeof x !== 'object') return false;
  const o = x as any;
  return typeof o.uuid === 'string' && o.csl && typeof o.csl === 'object' && typeof o.csl.id === 'string';
}
