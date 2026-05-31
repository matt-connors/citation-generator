/**
 * Global middleware: error handling + CORS (including preflight).
 */

interface Env {
    // Add any environment variables here
}

const CORS_HEADERS: Record<string, string> = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
};

/**
 * Catch uncaught errors. Log the full detail server-side (visible in
 * `wrangler tail` / Cloudflare logs) but return only a generic message to the
 * client — never the stack trace, which would leak internal paths and structure.
 */
const errorHandling: PagesFunction<Env> = async (context) => {
    try {
        return await context.next();
    } catch (err) {
        console.error('Unhandled error in Pages Function:', (err as Error)?.stack || err);
        return new Response(
            JSON.stringify({ error: 'Internal server error', code: 'internal', retryable: false }),
            { status: 500, headers: { 'content-type': 'application/json', ...CORS_HEADERS } },
        );
    }
};

/**
 * Answer CORS preflight (OPTIONS) directly, and add CORS headers to every other
 * response. Without the preflight branch, browsers' OPTIONS probe hits the route
 * handlers and gets a 405, which then blocks the real cross-origin POST.
 */
const cors: PagesFunction<Env> = async (context) => {
    if (context.request.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: { ...CORS_HEADERS } });
    }
    const response = await context.next();
    for (const [k, v] of Object.entries(CORS_HEADERS)) response.headers.set(k, v);
    return response;
};

export const onRequest = [errorHandling, cors];
