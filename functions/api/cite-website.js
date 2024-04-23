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
    // Add the protocol if it's missing
    if (!url.startsWith('http')) {
      url = `https://${url}`;
    }
  
    // Convert the URL to an object
    const parsedUrl = new URL(url);
  
    // Fetch the response
    try {
      const response = await fetch(parsedUrl.toString(), {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.36 Edge/16.16299',
          'Accept': 'text/html',
        },
      });
      const text = await response.text();
      return new Response(text, { status: response.status });
    } catch (e) {
      console.error(e);
      return new Response('Failed to fetch the page', { status: 500 });
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

    // Extract specific metadata
    const metadata = {};

    // Example: Extracting title and description
    metadata.title = $('title').text();
    metadata.description = $('meta[name="description"]').attr('content');

    // Example: Extracting author
    metadata.author = $('meta[name="author"]').attr('content');

    // Example: Extracting keywords
    metadata.keywords = $('meta[name="keywords"]').attr('content');

    // Example: Extracting published date
    metadata.publishedDate = $('meta[property="article:published_time"]').attr('content');

    // Parse date strings using Moment.js if applicable
    if (metadata.publishedDate) {
        metadata.publishedDate = moment(metadata.publishedDate).toISOString();
    }

    return createResponse({
        success: true,
        metadata: metadata
    });
}
