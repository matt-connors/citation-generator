const UA = 'Mozilla/5.0 (compatible; mlagenerator/1.0; +https://mlagenerator.com)';
const TIMEOUT_MS = 10_000;
// Generous ceiling for an HTML document; guards the Worker's ~128 MB memory
// budget against a malicious or misconfigured server streaming an enormous body.
const MAX_BODY_BYTES = 5_000_000;

export class FetchError extends Error {
  constructor(
    message: string,
    public readonly code: 'fetch_failed' | 'not_html' | 'timeout' | 'invalid_url' | 'too_large' | 'blocked',
    public readonly retryable: boolean,
  ) {
    super(message);
    this.name = 'FetchError';
  }
}

/**
 * Reject hostnames that resolve (or are literal IPs) inside private, loopback,
 * link-local, or cloud-metadata ranges so a user-supplied URL — or a redirect
 * to one — can't turn this Worker into an SSRF proxy for internal services.
 * Hostname-based (Workers can't resolve DNS pre-flight), so this blocks literal
 * IPs and obvious names; it is defense-in-depth, not a complete SSRF shield.
 */
export function isBlockedHost(hostname: string): boolean {
  // Normalize: lowercase, strip IPv6 brackets, and strip a single trailing dot
  // (the FQDN root) so "localhost." / "127.0.0.1." can't slip past the checks.
  const h = hostname.toLowerCase().replace(/^\[/, '').replace(/\]$/, '').replace(/\.$/, '');
  if (!h) return true;
  if (h === 'localhost' || h.endsWith('.localhost')) return true;
  // IPv6 loopback / unspecified / unique-local (fc00::/7) / link-local (fe80::/10)
  if (h === '::1' || h === '::') return true;
  if (/^f[cd][0-9a-f]{2}:/.test(h)) return true;
  if (/^fe[89ab][0-9a-f]:/.test(h)) return true;
  // IPv4-mapped IPv6 (::ffff:127.0.0.1, or the compressed-hex ::ffff:7f00:1 that
  // WHATWG URL produces): unwrap the embedded IPv4 and re-check, so loopback /
  // metadata addresses can't hide behind the mapping.
  const mapped = h.match(/^::ffff:(.+)$/);
  if (mapped) {
    const tail = mapped[1];
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(tail)) return isBlockedHost(tail);
    const hex = tail.match(/^([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
    if (hex) {
      const hi = parseInt(hex[1], 16), lo = parseInt(hex[2], 16);
      return isBlockedHost(`${(hi >> 8) & 255}.${hi & 255}.${(lo >> 8) & 255}.${lo & 255}`);
    }
  }
  // IPv4 literal
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const a = +m[1], b = +m[2];
    if (a === 0 || a === 10 || a === 127) return true;           // this-network, private, loopback
    if (a === 169 && b === 254) return true;                     // link-local + cloud metadata (169.254.169.254)
    if (a === 172 && b >= 16 && b <= 31) return true;            // private
    if (a === 192 && b === 168) return true;                     // private
    if (a === 100 && b >= 64 && b <= 127) return true;           // CGNAT (100.64.0.0/10)
  }
  return false;
}

async function readCapped(res: Response, max: number): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) {
    const text = await res.text();
    if (text.length > max) throw new FetchError('Response too large', 'too_large', false);
    return text;
  }
  const decoder = new TextDecoder('utf-8');
  let html = '';
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      total += value.length;
      if (total > max) {
        await reader.cancel();
        throw new FetchError('Response too large', 'too_large', false);
      }
      html += decoder.decode(value, { stream: true });
    }
  }
  html += decoder.decode();
  return html;
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
  if (isBlockedHost(parsed.hostname)) {
    throw new FetchError('Refusing to fetch a private or reserved host', 'blocked', false);
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
    const finalUrl = res.url || parsed.href;
    // A redirect may have landed on an internal host even though the input was public.
    let finalHost = '';
    try { finalHost = new URL(finalUrl).hostname; } catch { /* leave blank */ }
    if (finalHost && isBlockedHost(finalHost)) {
      throw new FetchError('Refusing to follow a redirect to a private or reserved host', 'blocked', false);
    }
    if (!res.ok) {
      throw new FetchError(`HTTP ${res.status}`, 'fetch_failed', res.status >= 500);
    }
    const ct = (res.headers.get('content-type') || '').toLowerCase();
    if (!ct.includes('text/html') && !ct.includes('application/xhtml')) {
      throw new FetchError(`Non-HTML content: ${ct || 'unknown'}`, 'not_html', false);
    }
    const declared = parseInt(res.headers.get('content-length') || '', 10);
    if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
      throw new FetchError('Response too large', 'too_large', false);
    }
    const html = await readCapped(res, MAX_BODY_BYTES);
    return { html, finalUrl };
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
