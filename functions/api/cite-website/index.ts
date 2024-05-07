import Rewriter from "./rewriter";
import { createResponse, cleanUrl } from "../utils";
import { fetchResponse } from "./fetch-data";
import { getPublisher } from "./publisher-utils";

/**
 * Test sites
 * https%3A%2F%2Fwww.epa.gov%2Ffacts-and-figures-about-materials-waste-and-recycling%2Fplastics-material-specific-data
 * https://www.theguardian.com/society/2018/aug/29/teens-desert-social-media
 * 
 * Contains no quality dates
 * https://interestingengineering.com/european-union-wants-all-smartphones-to-have-the-same-charging-port
 */

/**
 * Extract the data from the response
 */
export async function extractData(response: Response) {
    // Create a new JSDOM instance and pass the response to it
    const dom = new Rewriter(response);

    // Define the operations to be performed
    const operations = {
        titleText: dom.querySelectorText('title'),
        dates: dom.extractDates(['edited', 'last modified', 'created', 'updated', 'published', 'date written', 'online']),
        authors: dom.extractAuthor()
    };

    // Perform the operations and get the transformed data
    return await dom.transform(operations);
}

/**
 * This function will be invoked on all requests no matter the request method.
 * https://developers.cloudflare.com/pages/functions/api-reference
 */
/**
 * This function will be invoked on all requests no matter the request method.
 * https://developers.cloudflare.com/pages/functions/api-reference
 */
export async function onRequest(context) {
    const url = new URL(context.request.url);
    const params = Object.fromEntries(url.searchParams);
    const date = new Date();

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
        uuid: params.url,
        citationType: 'website',
        citationInfo: {
            authors: extractedData.authors,
            sourceTitle: extractedData.titleText,
            publisher: getPublisher(params.url),
            publicationDate: extractedData.dates,
            url: cleanUrl(params.url),
            accessDate: {
                year: date.getFullYear(),
                month: date.getMonth(),
                day: date.getDate()
            }
        }
    });

    // Note that the extracted dates array will start with dates its most confident about, then include the rest
    // Starting with dates preceeded by a keyword, then the first date found on the page, then the rest

}


