/* cite-website
Receives a URL, fetches website data, extracts important information (cheerio), return a JSON object

*/
import cheerio from 'cheerio';
import moment from 'moment';

/**
 * Check if the URL is invalid
 */
export function isUrlInvalid(url) {
    const match = url.match(/^(http|https):\/\/([^.]+)\.([^\.]+)(.*)$/);
    return match === null;
}

/**
 * Stringifies the body and creates a JSON response
 */
export function createResponse(body) {
    return new Response(JSON.stringify(body), {
        headers: {
            "content-type": "application/json"
        }
    });
}

/**
 * Fetch a response from a URL
 */
async function fetchResponse(url) {
    // add the protocol if it's missing
    if (!url.startsWith('http')) {
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
        return new Response(text, {
            status: response.status
        });
    } catch (e) {
        console.error(e);
        return new Response('Failed to fetch the page', {
            status: 500
        });
    }
}

/**
 * This function will be invoked on all requests no matter the request method.
 * https://developers.cloudflare.com/pages/functions/api-reference
 */
export async function onRequest(context) {
    const url = new URL(context.request.url);
    const params = Object.fromEntries(url.searchParams);

    // Ensure the request has a `url` query parameter
    if (!params.url) {
        return createResponse({
            error: "No URL provided"
        });
    }

    // Fetch the response from the URL
    const response = await fetchResponse(decodeURIComponent(params.url));

    // Ensure the response is OK
    if (!response.ok) {
        return createResponse({
            error: "Failed to fetch the page"
        });
    }

    // Extract HTML content from the response
    const html = await response.text();

    // Load HTML content into Cheerio
    const $ = cheerio.load(html);

    // Extract all meta tags
    const metadata = {};
    $('meta').each((index, element) => {
        const name = $(element).attr('name');
        const content = $(element).attr('content');
        if (name && content) {
            metadata[name] = content;
        }
    });

    // Check for specific keywords in metadata FOR TESTING PURPOSES
    const specificKeywords = ['date', 'published by'];
    const keywordMatches = {};
    for (const keyword of specificKeywords) {
        keywordMatches[keyword] = Object.keys(metadata).filter(key => key.toLowerCase().includes(keyword));
    }

    // Parse date strings using Moment.js
    for (const key in metadata) {
        if (moment(metadata[key], moment.ISO_8601, true).isValid()) {
            metadata[key] = moment(metadata[key]).toISOString();
        }
    }

    return createResponse({
        success: true,
        metadata: metadata,
        keywordMatches: keywordMatches //FOR TESTING PURPOSES
    });
}

