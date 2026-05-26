const UA = 'Mozilla/5.0 (compatible; mlagenerator/1.0; +https://mlagenerator.com)';
const TIMEOUT_MS = 10_000;

export class FetchError extends Error {
  constructor(
    message: string,
    public readonly code: 'fetch_failed' | 'not_html' | 'timeout' | 'invalid_url',
    public readonly retryable: boolean,
  ) {
    super(message);
    this.name = 'FetchError';
  }
}

export async function fetchHtml(url: string): Promise<{ html: string; finalUrl: string }> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new FetchError('Invalid URL', 'invalid_url', false);
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new FetchError('Unsupported scheme', 'invalid_url', false);
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: ctrl.signal,
      headers: {
        'User-Agent': UA,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });
    if (!res.ok) {
      throw new FetchError(`HTTP ${res.status}`, 'fetch_failed', res.status >= 500);
    }
    const ct = (res.headers.get('content-type') || '').toLowerCase();
    if (!ct.includes('text/html') && !ct.includes('application/xhtml')) {
      throw new FetchError(`Non-HTML content: ${ct || 'unknown'}`, 'not_html', false);
    }
    const html = await res.text();
    return { html, finalUrl: res.url || parsed.href };
  } catch (err) {
    if (err instanceof FetchError) throw err;
    if ((err as any)?.name === 'AbortError') {
      throw new FetchError('Timeout', 'timeout', true);
    }
    throw new FetchError(`Fetch error: ${(err as Error).message}`, 'fetch_failed', true);
  } finally {
    clearTimeout(timer);
  }
}
