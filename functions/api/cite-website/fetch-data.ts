import { isUrlInvalid } from '../utils';

/**
 * Fetch a response from a URL
 */
export async function fetchResponse(url: string): Promise<Response> {
    // add the protocol if it's missing
    if (url.startsWith('http') === false) {
        url = `https://${url}`;
    }
    // Ensure the URL is valid
    if (isUrlInvalid(url)) {
        return new Response('Invalid URL', {
            status: 400
        });
    }
    // Fetch the response
    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.36 Edge/16.16299',
                'Accept': 'text/html',
            }
        });
        const text = await response.text();
        return new Response(text);
    }
    catch (e) {
        console.error(e);
        return new Response('Failed to fetch the page', {
            status: 500
        });
    }
}