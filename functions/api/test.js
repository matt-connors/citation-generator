import moment from 'moment';

/**
 * Stringifies the body and creates a JSON response
 */
function createResponse(body) {
    return new Response(JSON.stringify(body), {
        headers: {
            "content-type": "application/json"
        }
    });
}

/**
 * Extracts dates from a string which are prefixed by a specific word
 */
// function getDateMatches(prefixes, text) {
//     // The regex to matches any date in the format, such as
//     //     01/01/2023, 1/1/2023, 01-01-2023, 1-1-2023, 01:01:2023, 1:1:2023, January 1, 2023, Jan 1, 2023, 1 January 2023, 1 Jan 2023, 2017 Oct 4
//     const dateRegex = /\b(\d{1,2}|[a-zA-Z]{3,9})\s*[:,\s-]\s*(\d{1,2}|[a-zA-Z]{3,9})\s*[:,\s-]\s*(\d{4})|(0?[1-9]|1[0-2])\/(0?[1-9]|[12][0-9]|3[01])\/(19|20)?\d{2}$/g;
//     // const dateRegex = /^(?:(?:(0[1-9]|1[0-2])|(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?) )?\s?(?:\d{1,2}(?:st|nd|rd|th)?)?(?:\s*,)?\s*)?\d{4}$/g;
//     const matches = [];

//     let match;
//     while ((match = dateRegex.exec(text)) !== null) {

//         console.log('increment')

//         const matchIndex = match.index;
//         const prefixBefore = text.slice(0, matchIndex).trim();

//         for (const prefix of prefixes) {
//             if (prefixBefore.toLowerCase().endsWith(prefix)) {
//                 const date = new Date(match[0]);
//                 matches.push({
//                     context: {
//                         prefix,
//                         matchedText: match[0]
//                     },
//                     date: getDateParts(date)
//                 });
//             }
//         }
//     }

//     return matches;
// }

function getDateMatches(prefixes, text) {
    const foundDates = [];
    const textLower = text.toLowerCase(); // Convert to lowercase for case-insensitive matching

    for (const prefix of prefixes) {
        const prefixLower = prefix.toLowerCase();
        const startIndex = textLower.indexOf(prefixLower);

        if (startIndex !== -1) {
            // Extract date string after prefix, removing leading/trailing white spaces
            const dateString = text.substring(startIndex + prefixLower.length).trim();

            // Use moment.js to parse the date string and handle various formats
            const parsedDate = moment(dateString); // Use strict parsing

            if (parsedDate.isValid()) {
                foundDates.push({
                    context: {
                        prefix: prefix,
                        matchedText: dateString
                    },
                    date: getDateParts(parsedDate)
                });
            }
        }
    }

    return foundDates;
}

/**
 * Get the day, month, and year from a date
 */
function getDateParts(date) {
    return {
        day: date.date(),
        month: date.month() + 1,
        year: date.year()
    };
}

/**
 * A class used to interact with cloudflare's HTMLRewriter runtime API
 * https://developers.cloudflare.com/workers/runtime-apis/html-rewriter
 */
class JSDOM {
    constructor(response) {
        this._response = response;
        this._rewriter = new HTMLRewriter();
    }

    /**
     * Query for an element and get its text content
     */
    querySelectorText(selector) {
        return new Promise(resolve => {
            this._rewriter.on(selector, {
                text(text) {
                    resolve(text.text);
                }
            })

        })
            .catch(e => {
                console.error(e);
            });
    }

    /**
     * Extract dates from the response body
     */
    async extractDates(prefixes) {
        return new Promise(resolve => {
            const matches = [];
            this._rewriter.on("body", {
                element(element) {
                    element.onEndTag(() => {
                        resolve(matches);
                    })
                },
                text(text) {
                    let match = getDateMatches(prefixes, text.text);
                    if (match) {
                        matches.push(
                            ...match
                        )
                    }
                }
            })
        })
            .catch(e => {
                console.error(e);
            });

    }

    /**
     * Use the HTMLRewriter to perform all operations
     */
    async transform(operations) {
        this._rewriter.transform(this._response);
        const keys = Object.keys(operations);
        const values = await Promise.all(Object.values(operations));
        const results = Object.fromEntries(
            keys.map((key, index) => [key, values[index]])
        );
        return results;
    }

}

/**
 * Check if the URL is invalid
 */
function isUrlInvalid(url) {
    const match = url.match(/^(http|https):\/\/([^.]+)\.([^\.]+)(.*)$/);
    if (match === null) {
        return true;
    }
    return false;
}

/**
 * Fetch a response from a URL
 */
async function fetchResponse(url) {
    // add the protocol if it's missing
    if (url.startsWith('http') === false) {
        url = `https://${url}`;
    }
    // Ensure the URL is valid
    if (isUrlInvalid(url)) {
        return {
            ok: false
        }
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
        return {
            ok: false
        }
    }
}

/**
 * Extract the data from the response
 */
async function extractData(response) {
    // Create a new JSDOM instance and pass the response to it
    const dom = new JSDOM(response);

    // Define the operations to be performed
    const operations = {
        titleText: dom.querySelectorText('title'),
        dates: dom.extractDates(['edited on', 'last modified', 'last modified on', 'created on', 'updated on', 'published:', 'date written:', 'published online', 'updated', 'published'])
    }

    // Perform the operations and get the transformed data
    return await dom.transform(operations);
}

/**
 * This function will be invoked on all requests no matter the request method.
 * https://developers.cloudflare.com/pages/functions/api-reference
 */
export async function onRequest(context) {
    const url = new URL(context.request.url);
    const params = Object.fromEntries(url.searchParams);

    // Ensure the request has a `url` query parameter
    if (params.url === undefined) {
        return createResponse({
            error: "No URL provided"
        });
    }

    // const response = new Response('<!DOCTYPE html><html><head><title>Hello world! test!</title></head><body><div><p>Test! last modified on January 16, 2023</p><p>The light bulb was created on Oct 22, 1879</p></div></body></html>');

    // Fetch the response from the URL
    const response = await fetchResponse(
        decodeURIComponent(
            params.url
        )
    );

    // Ensure the response is OK
    if (response.ok !== true) {
        return createResponse({
            error: "Failed to fetch the page"
        });
    }

    // Extract the data from the response
    const extractedData = await extractData(response);

    // Return the response
    return createResponse({
        dates: extractedData.dates,
        title: extractedData.titleText,
        url: params.url,
        etc: "...",
    });

}