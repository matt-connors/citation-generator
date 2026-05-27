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

// Open Library's /api/books endpoint has been observed timing out at 10s+
// during normal operation (verified 2026-05-27 against five test ISBNs:
// one out of five required >20s to resolve). 5s caused premature cascade to
// the Google Books fallback, which has its own quota constraints. 10s gives
// OL the time it usually needs without blocking long enough to feel broken.
const TIMEOUT_MS = 10_000;

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
