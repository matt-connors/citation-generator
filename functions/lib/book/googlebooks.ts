export interface GoogleBooksVolume {
  title?: string;
  subtitle?: string;
  authors?: string[];
  publisher?: string;
  publishedDate?: string;
  pageCount?: number;
  industryIdentifiers?: Array<{ type: string; identifier: string }>;
  infoLink?: string;
}

const TIMEOUT_MS = 5_000;

export async function fetchGoogleBooks(isbn: string, apiKey?: string): Promise<GoogleBooksVolume | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const url = new URL('https://www.googleapis.com/books/v1/volumes');
    url.searchParams.set('q', `isbn:${isbn}`);
    if (apiKey) url.searchParams.set('key', apiKey);
    const res = await fetch(url.toString(), {
      signal: ctrl.signal,
      headers: { 'User-Agent': 'mlagenerator/1.0' },
    });
    if (!res.ok) return null;
    const blob = await res.json() as { items?: Array<{ volumeInfo: GoogleBooksVolume }> };
    return blob.items?.[0]?.volumeInfo ?? null;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}
