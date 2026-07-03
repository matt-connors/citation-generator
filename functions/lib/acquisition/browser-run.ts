const RENDER_TIMEOUT_MS = 12_000;
const UA = 'Mozilla/5.0 (compatible; mlagenerator/1.0; +https://mlagenerator.com)';

export interface BrowserRunBinding {
  quickAction(action: string, body: Record<string, unknown>): Promise<Response | string | Record<string, unknown>>;
}

export interface BrowserRendererServiceBinding {
  fetch(input: Request | string, init?: RequestInit): Promise<Response>;
}

export interface RenderedHtmlResult {
  html: string;
  browserMs?: number;
}

export class RenderError extends Error {
  constructor(
    message: string,
    public readonly code: 'render_failed' | 'render_timeout' | 'render_empty',
    public readonly retryable: boolean,
  ) {
    super(message);
    this.name = 'RenderError';
  }
}

export async function renderHtmlWithBrowserRun(
  browser: BrowserRunBinding,
  url: string,
): Promise<RenderedHtmlResult> {
  const started = Date.now();
  try {
    const response = await withTimeout(browser.quickAction('content', {
      url,
      userAgent: UA,
      gotoOptions: { waitUntil: 'networkidle2' },
      rejectResourceTypes: ['image', 'font', 'media'],
    }), RENDER_TIMEOUT_MS);
    const { html, browserMs } = await normalizeQuickActionResponse(response);
    if (!html.trim()) throw new RenderError('Browser Run returned empty HTML', 'render_empty', true);
    return { html, browserMs: browserMs ?? Date.now() - started };
  } catch (err) {
    if (err instanceof RenderError) throw err;
    if ((err as any)?.name === 'AbortError') {
      throw new RenderError('Browser Run timed out', 'render_timeout', true);
    }
    throw new RenderError(`Browser Run failed: ${(err as Error).message}`, 'render_failed', true);
  }
}

export function createBrowserRunBindingFromService(
  service: BrowserRendererServiceBinding | undefined,
  token?: string,
): BrowserRunBinding | undefined {
  if (!service) return undefined;
  return {
    async quickAction(action, body) {
      const headers: Record<string, string> = { 'content-type': 'application/json' };
      if (token) headers['x-browser-renderer-token'] = token;
      return service.fetch('https://browser-renderer.internal/', {
        method: 'POST',
        headers,
        body: JSON.stringify({ action, ...body }),
      });
    },
  };
}

async function normalizeQuickActionResponse(response: Response | string | Record<string, unknown>): Promise<RenderedHtmlResult> {
  if (typeof response === 'string') return { html: response };
  if (response instanceof Response) {
    const browserMsRaw = response.headers.get('X-Browser-Ms-Used') || response.headers.get('x-browser-ms-used');
    const browserMs = browserMsRaw ? parseInt(browserMsRaw, 10) : undefined;
    const text = await response.text();
    return { html: htmlFromText(text), browserMs: Number.isFinite(browserMs) ? browserMs : undefined };
  }
  const html = htmlFromObject(response);
  return { html };
}

function htmlFromText(text: string): string {
  const trimmed = text.trim();
  if (!trimmed.startsWith('{')) return text;
  try {
    return htmlFromObject(JSON.parse(trimmed));
  } catch {
    return text;
  }
}

function htmlFromObject(value: Record<string, unknown>): string {
  for (const key of ['result', 'content', 'html']) {
    const candidate = value[key];
    if (typeof candidate === 'string') return candidate;
  }
  const nested = value.result;
  if (nested && typeof nested === 'object') return htmlFromObject(nested as Record<string, unknown>);
  return JSON.stringify(value);
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), timeoutMs);
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      ctrl.signal.addEventListener('abort', () => reject(new DOMException('Timed out', 'AbortError')), { once: true });
    }),
  ]).finally(() => clearTimeout(timeout));
}
