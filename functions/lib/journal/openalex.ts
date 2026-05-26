export interface OpenAlexWork {
  title?: string;
  authorships?: Array<{ author?: { display_name?: string } }>;
  host_venue?: { display_name?: string };
  publication_date?: string;
  doi?: string;
  volume?: string;
  issue?: string;
  first_page?: string;
  last_page?: string;
}

const TIMEOUT_MS = 5_000;

export async function fetchOpenAlex(doi: string): Promise<OpenAlexWork | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`https://api.openalex.org/works/doi:${encodeURIComponent(doi)}`, {
      signal: ctrl.signal,
      headers: { 'User-Agent': 'mlagenerator/1.0 (mailto:matt@thunderboltnetworks.com)' },
    });
    if (!res.ok) return null;
    return await res.json() as OpenAlexWork;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}
