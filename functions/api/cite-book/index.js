import moment from "moment";


/**
 * Stringifies the body and creates a JSON response
 */
export function createResponse(citationInfo) {
    return new Response(JSON.stringify(citationInfo), {
        headers: {
            "content-type": "application/json"
        }
    });
}

/**
 * Fetch book information from the Google Books API
 */
async function fetchBookInfo(apiKey, isbn) {
    const apiUrl = `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`//&key=${apiKey}`;
    const response = await fetch(apiUrl);
    if (!response.ok) {
        throw new Error(`Failed to fetch book information: ${response.statusText}`);
    }
    return await response.json();
}

/**
 * Get formatted date
 */
function getFormattedDate(date) {
    try {
        const momentDate = moment(date);
        return {
            year: momentDate.year(),
            month: momentDate.month() + 1,
            day: momentDate.date()
        }
    }
    catch (error) {
        return {
            year: date
        };
    }
}

/**
 * Generate citation for the book
 */
function generateCitation(bookInfo) {
    const today = new Date();
    return {
        authors: bookInfo.volumeInfo.authors,
        sourceTitle: bookInfo.volumeInfo.title,
        publisher: bookInfo.volumeInfo.publisher,
        publicationDate: [{
            context: {},
            date: getFormattedDate(bookInfo.volumeInfo.publishedDate)
        }],
        accessDate: {
            year: today.getFullYear(),
            month: today.getMonth() + 1,
            day: today.getDate()
        }
    }
}

/**
 * This function will be invoked on all requests no matter the request method.
 * https://developers.cloudflare.com/pages/functions/api-reference
 */
export async function onRequest(context) {
    const url = new URL(context.request.url);
    const isbn = url.searchParams.get('isbn');
    const apiKey = context.env.API_KEY;

    // Ensure the request has an `isbn` query parameter
    if (!isbn) {
        return createResponse({
            error: "No ISBN provided"
        });
    }

    // Validate ISBN format (basic check for numeric characters and length)
    const isValidISBN = /(?=(?:[0-9]+[-●]){3})[-●0-9X]{13}$/.test(isbn);
    if (!isValidISBN) {
        return createResponse({
            error: "Invalid ISBN format"
        });
    }

    try {
        // Fetch book information from Google Books API
        const bookInfo = await fetchBookInfo(apiKey, isbn);

        // Check if bookInfo contains any items
        if (!bookInfo.items || bookInfo.items.length === 0) {
            return createResponse({
                error: "Book not found"
            });
        }

        // Generate citation for the book
        const citationInfo = generateCitation(bookInfo.items[0]);

        return createResponse({
            uuid: isbn,
            citationType: "book",
            citationInfo
        });

    }
    catch (error) {
        return createResponse({
            error: error.message || "Failed to fetch book information or generate citation"
        });
    }
}