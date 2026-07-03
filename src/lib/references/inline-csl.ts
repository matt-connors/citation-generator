import type { StoredSource } from './storage';
import { isStoredSource } from './storage';

export const INLINE_CSL_PARAM = 'csl';

export function decodeInlineCslParam(value: string | null): StoredSource | null {
  if (!value) return null;
  try {
    const json = decodeBase64Url(value);
    const parsed = JSON.parse(json);
    return isStoredSource(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function decodeBase64Url(value: string): string {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(normalized.length + ((4 - normalized.length % 4) % 4), '=');
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}
