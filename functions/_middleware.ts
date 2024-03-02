/**
 * Middleware for error handling
 */

interface Env {
    // Add any environment variables here
}

/**
 * Catch errors and return a 500 response
 */
const errorHandling: PagesFunction<Env> = async (context) => {
    try {
        return await context.next();
    }
    catch (err) {
        return new Response(`${err.message}\n${err.stack}`, { status: 500 });
    }
}

/**
 * Set CORS headers
 */
const cors: PagesFunction<Env> = async (context) => {
    const response = await context.next();
    response.headers.set('Access-Control-Allow-Origin', '*');
    return response;
}

export const onRequest = [errorHandling, cors];