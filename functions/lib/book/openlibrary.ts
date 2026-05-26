export interface OpenLibraryBook {
  title?: string;
  subtitle?: string;
  authors?: Array<{ name: string }>;
  publishers?: Array<{ name: string }>;
  publish_date?: string;
  publish_places?: Array<{ name: string }>;
  number_of_pages?: number;
  url?: string;
}

const TIMEOUT_MS = 5_000;

export async function fetchOpenLibrary(isbn: string): Promise<OpenLibraryBook | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&jscmd=data&format=json`, {
      signal: ctrl.signal,
      headers: { 'User-Agent': 'mlagenerator/1.0' },
    });
    if (!res.ok) return null;
    const blob = await res.json() as Record<string, OpenLibraryBook>;
    const entry = blob[`ISBN:${isbn}`];
    return entry || null;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}
