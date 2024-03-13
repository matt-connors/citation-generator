import moment from 'moment';

/**
 * Test sites
 * https%3A%2F%2Fwww.epa.gov%2Ffacts-and-figures-about-materials-waste-and-recycling%2Fplastics-material-specific-data
 * https://www.theguardian.com/society/2018/aug/29/teens-desert-social-media
 * 
 * Contains no quality dates
 * https://interestingengineering.com/european-union-wants-all-smartphones-to-have-the-same-charging-port
 */

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
 * Extracts dates from a string
 */
function extractDates(text) {
    const regexPatterns = [
        // YYYY-MM-DD (e.g., 2024-03-10)
        /\d{4}-\d{2}-\d{2}/,
        // MM/DD/YYYY (e.g., 03/10/2024)
        /\d{2}\/\d{2}\/\d{4}/,
        // DD/MM/YYYY (e.g., 10/03/2024) - for countries with DD/MM format
        /\d{2}\/\d{2}\/\d{4}/,
        // Month name DD, YYYY (e.g., March 10, 2024)
        /\w+\s\d{1,2},\s\d{4}/,
        // Month abbreviation (3 letters) DD, YYYY (e.g., Mar 10, 2024)
        /\b[A-Z]{3}\s\d{1,2},\s\d{4}/,
        // Ordinal dates (e.g., 1st of March 2024, 2nd April, 2023)
        /\d{1,2}(?:st|nd|rd|th)\s+(of)?\s+\w+\s+\d{4}/,
        // Two-digit year format (e.g., 10/03/23) - Use with caution due to ambiguity
        /\d{2}\/\d{2}\/\d{2}/,
        // Day, Month, Year (e.g., 10 March 2024)
        /\d{1,2}\s\w+\s\d{4}/,
    ];

    const extractedDates = [];
    for (const pattern of regexPatterns) {
        let match;
        while ((match = pattern.exec(text)) !== null) {
            extractedDates.push(match[0]);
            text = text.slice(match.index + match[0].length); // Update remaining text
        }
    }

    return extractedDates;
}

/**
 * Extracts dates from a string based on prefixes
 */
function extractMatchingDates(text, prefix, prefixEnd) {
    const foundDates = [];
    const prefixLower = prefix.toLowerCase() + prefixEnd;
    const startIndex = text.indexOf(prefixLower);

    if (startIndex !== -1) {
        // Extract date string after prefix, removing leading/trailing white spaces
        const dateStringText = text.substring(startIndex + prefixLower.length).trim();
        const dates = extractDates(dateStringText);

        for (const dateString of dates) {
            // Use moment.js to parse the date string and handle various formats
            const parsedDate = moment(dateString);
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
 * Extracts dates from a string based on prefixes
 */
function getDateMatches(prefixes, text) {
    const foundDates = [];
    const textLower = text.toLowerCase(); // Convert to lowercase for case-insensitive matching
    const prefixEnds = [" on", " at", ": ", " "];

    // Extract dates based on prefixes
    for (const prefix of prefixes) {
        for (const prefixEnd of prefixEnds) {
            foundDates.push(
                ...extractMatchingDates(textLower, prefix, prefixEnd)
            );
        }
    }

    // Extract all other dates without a prefix
    foundDates.push(
        ...extractMatchingDates(textLower, "", "")
    );

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
            // look for datetime attribute
            this._rewriter.on("body", {
                element(element) {
                    element.onEndTag(() => {
                        clearTimeout(timeout);
                        resolve(
                            matches
                                // filter out repeated dates
                                .filter((date, index, self) =>
                                    index === self.findIndex((d) =>
                                        d.date.day === date.date.day &&
                                        d.date.month === date.date.month &&
                                        d.date.year === date.date.year
                                    )
                                )
                        );
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
            });
            // ensure we eventually resolve the promise
            const timeout = setTimeout(() => {
                resolve(matches);
            }, 1000);
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
        dates: dom.extractDates(['edited', 'last modified', 'created', 'updated', 'published', 'date written', 'online'])
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

    // Note that the extracted dates array will start with dates its most confident about, then include the rest
    // Starting with dates preceeded by a keyword, then the first date found on the page, then the rest

}