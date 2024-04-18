require('dotenv').config();

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

const api_key = process.env.API_KEY;

/**
 * Fetch book information from the Google Books API
 */
async function fetchBookInfo(isbn) {
    const apiUrl = `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}&key=${api_key}`;
    const response = await fetch(apiUrl);
    if (!response.ok) {
        throw new Error(`Failed to fetch book information from Google Books API: ${response.statusText}`);
    }
    return await response.json();
}

/**
 * Generate citation for the book
 */
function generateCitation(bookInfo) {
    const volumeInfo = bookInfo.volumeInfo;
    const authors = volumeInfo.authors ? volumeInfo.authors.join(', ') : 'Unknown author';
    const title = volumeInfo.title || 'Unknown title';
    const publisher = volumeInfo.publisher || 'Unknown publisher';
    const publishedDate = volumeInfo.publishedDate || 'Unknown date';
    const citation = `${authors}. (${publishedDate}). ${title}. ${publisher}.`;
    return citation;
}

/**
 * This function will be invoked on all requests no matter the request method.
 * https://developers.cloudflare.com/pages/functions/api-reference
 */
export async function onRequest(context) {
    const url = new URL(context.request.url);
    const isbn = url.searchParams.get('isbn');

    // Ensure the request has an `isbn` query parameter
    if (!isbn) {
        return createResponse({
            error: "No ISBN provided"
        });
    }

    try {
        // Fetch book information from Google Books API
        const bookInfo = await fetchBookInfo(isbn);

        // Generate citation for the book
        const citation = generateCitation(bookInfo.items[0]);

        return createResponse({
            success: true,
            citation: citation
        });
    } catch (error) {
        return createResponse({
            error: error.message || "Failed to fetch book information or generate citation"
        });
    }
}

