export interface CrossrefWork {
  title?: string[];
  author?: Array<{ family?: string; given?: string; literal?: string; name?: string }>;
  'container-title'?: string[];
  issued?: { 'date-parts'?: Array<[number] | [number, number] | [number, number, number]> };
  volume?: string;
  issue?: string;
  page?: string;
  DOI?: string;
}

const TIMEOUT_MS = 5_000;

export async function fetchCrossref(doi: string): Promise<CrossrefWork | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`https://api.crossref.org/works/${encodeURIComponent(doi)}`, {
      signal: ctrl.signal,
      headers: { 'User-Agent': 'mlagenerator/1.0 (mailto:matt@thunderboltnetworks.com)' },
    });
    if (!res.ok) return null;
    const blob = await res.json() as { message?: CrossrefWork };
    return blob.message ?? null;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}
