/**
 * Pages-level middleware chain.
 * Runs sequentially: errorHandling → adminAuth → cors → route handler.
 * errorHandling is outermost so any throw inside auth or admin handlers is
 * caught and returned as a generic 500 (no stack-trace leakage to clients).
 */

interface Env {
    DASHBOARD_PASSWORD?: string;
}

// Path predicate: TRUE for /admin and /admin/<anything>, FALSE for
// /administrator and unrelated paths. Lowercased so /Admin can't bypass
// the gate via a case-sensitive compare — auth must never depend on
// case-preserving URL primitives. Exported for unit tests.
export function isAdminPath(pathname: string): boolean {
    const p = pathname.toLowerCase();
    return p === '/admin' || p.startsWith('/admin/');
}

// Security headers we want on every admin response (success, 401, 503).
// Factored out so 401 and 503 don't go bare with just cache-control.
function applySecurityHeaders(headers: Headers): void {
    headers.set('cache-control', 'no-store');
    headers.set('x-frame-options', 'DENY');
    headers.set('x-content-type-options', 'nosniff');
    headers.set('referrer-policy', 'no-referrer');
}

// CORS headers shared by the preflight short-circuit and the normal response path.
const CORS_HEADERS: Record<string, string> = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
};

/**
 * HTTP basic auth gate on /admin/* paths.
 *
 * Single shared password lives in the DASHBOARD_PASSWORD Pages secret.
 * If the secret isn't set the route returns 503 — failure-closed so a
 * misconfigured deploy can't accidentally expose the dashboard. The
 * username is ignored; only the password is checked, in constant time,
 * to avoid revealing the password content via timing.
 *
 * The 401 response carries `cache-control: no-store` and a WWW-Authenticate
 * header so browsers prompt for credentials. The 200 response also carries
 * `no-store` to keep admin pages out of shared/back-forward caches.
 *
 * Password length is technically leaked via the early length-mismatch return
 * in constantTimeEquals — acceptable for a personal admin tool over HTTPS
 * with Cloudflare edge jitter masking microsecond-level server timing.
 */
const adminAuth: PagesFunction<Env> = async (context) => {
    const url = new URL(context.request.url);
    if (!isAdminPath(url.pathname)) {
        return context.next();
    }

    const password = context.env.DASHBOARD_PASSWORD;
    if (!password) {
        // Fail-closed: better to 503 than silently let through an
        // unprotected admin endpoint when the secret hasn't been wired up.
        const res = new Response('Admin dashboard not configured', { status: 503 });
        applySecurityHeaders(res.headers);
        return res;
    }

    const authHeader = context.request.headers.get('authorization') ?? '';
    if (!checkBasicAuth(authHeader, password)) {
        const res = new Response('Authentication required', { status: 401 });
        applySecurityHeaders(res.headers);
        res.headers.set('www-authenticate', 'Basic realm="Citation Generator Admin", charset="UTF-8"');
        return res;
    }

    const downstream = await context.next();
    // Wrap so the headers we add stick even if downstream set its own.
    const wrapped = new Response(downstream.body, downstream);
    applySecurityHeaders(wrapped.headers);
    return wrapped;
};

// Exported for unit tests; internal callers should use them via the
// middleware chain. The exports don't change the runtime behavior.
export function checkBasicAuth(authHeader: string, expectedPassword: string): boolean {
    if (!authHeader.startsWith('Basic ')) return false;
    let decoded: string;
    try {
        decoded = atob(authHeader.slice(6));
    } catch {
        return false;
    }
    const colonIdx = decoded.indexOf(':');
    if (colonIdx < 0) return false;
    const password = decoded.slice(colonIdx + 1);
    return constantTimeEquals(password, expectedPassword);
}

/**
 * Length-aware constant-time string comparison. Returns false immediately
 * on a length mismatch (the length itself isn't the secret here; only the
 * password content is). The XOR-accumulator loop keeps the per-character
 * compare constant-time regardless of where the first mismatch sits.
 */
export function constantTimeEquals(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) {
        diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return diff === 0;
}

/**
 * Catch errors and return a generic 500 response. Never reflect the
 * exception's message or stack to the client — those can carry secrets
 * (e.g. CF_API_TOKEN concatenated into an upstream fetch error). Logs to
 * the Worker tail log for operator visibility via `wrangler pages
 * deployment tail`.
 */
const errorHandling: PagesFunction<Env> = async (context) => {
    try {
        return await context.next();
    }
    catch (err) {
        console.error('[middleware] uncaught error:', err);
        return new Response('Internal server error', {
            status: 500,
            headers: { 'cache-control': 'no-store' },
        });
    }
}

/**
 * Answer CORS preflight (OPTIONS) directly for non-admin paths, and add CORS
 * headers to every other non-admin response. Without the preflight branch, the
 * browser's OPTIONS probe falls through to a route handler (e.g. /api/format,
 * which is POST-only) and gets a 405, which then blocks the real cross-origin
 * POST. Admin paths get no CORS header so their attack surface stays narrow.
 */
const cors: PagesFunction<Env> = async (context) => {
    const url = new URL(context.request.url);
    if (context.request.method === 'OPTIONS' && !isAdminPath(url.pathname)) {
        return new Response(null, { status: 204, headers: { ...CORS_HEADERS } });
    }
    const response = await context.next();
    if (!isAdminPath(url.pathname)) {
        for (const [k, v] of Object.entries(CORS_HEADERS)) response.headers.set(k, v);
    }
    return response;
}

/**
 * Trailing-slash canonicalization for SSR routes. The site is
 * trailingSlash:'always', and Cloudflare Pages already 308s no-slash requests
 * for prerendered (static) assets. But SSR routes served by this worker
 * (/about, /guides, /my-references, /admin/analytics) get a 404 from Astro for
 * their no-slash form instead of a redirect, so add the slash here. Runs after
 * adminAuth (so /admin stays gated), and skips the API, Astro's internal
 * endpoints (/_image, /_astro), file paths, and paths that already end in '/'.
 */
const trailingSlash: PagesFunction<Env> = async (context) => {
    const url = new URL(context.request.url);
    const { pathname } = url;
    const lastSegment = pathname.slice(pathname.lastIndexOf('/') + 1);
    if (
        !pathname.endsWith('/') &&
        !pathname.startsWith('/api/') &&
        !pathname.startsWith('/_') &&
        !lastSegment.includes('.')
    ) {
        url.pathname = `${pathname}/`;
        return new Response(null, {
            status: 308,
            headers: { location: url.toString() },
        });
    }
    return context.next();
};

export const onRequest = [errorHandling, adminAuth, trailingSlash, cors];
