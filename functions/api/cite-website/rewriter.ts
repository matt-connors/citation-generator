import { getDateMatches } from "./date-utils";
import { getAuthorMatches } from "./author-utils";
import { MATCH_MAX } from "./consts";

interface operations {
    [key: string]: Promise<any>;
}

/**
 * A class used to interact with cloudflare's HTMLRewriter runtime API
 * https://developers.cloudflare.com/workers/runtime-apis/html-rewriter
 */
export default class Rewriter {

    private _response: Response;
    private _rewriter: HTMLRewriter;

    constructor(response: Response) {
        this._response = response;
        this._rewriter = new HTMLRewriter();
    }

    /**
     * Query for an element and get its text content
     */
    querySelectorText(selector: string) {
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
            // ensure we eventually resolve the promise
            const timeout = setTimeout(() => {
                resolve(matches);
            }, 1000);
            // handle resolving the promise
            const resolveRewriter = () => {
                clearTimeout(timeout);
                resolve(
                    matches
                        // priotize dates with a non-empty context.prefix
                        .sort((a, b) => a.context.prefix ? -1 : 1)
                        // filter out repeated dates
                        .filter((date, index, self) =>
                            index === self.findIndex((d) =>
                                d.date.day === date.date.day &&
                                d.date.month === date.date.month &&
                                d.date.year === date.date.year
                            )
                        )
                );
            }
            // handle the body and text events
            this._rewriter.on("body", {
                element(element) {
                    // resolve when we react the end of the body tag
                    element.onEndTag(resolveRewriter);
                },
                text(text) {
                    let match = getDateMatches(prefixes, text.text);
                    if (match) {
                        if (matches.length > MATCH_MAX) {
                            resolveRewriter();
                        }
                        matches.push(...match);
                    }
                }
            });
        })
            .catch(e => {
                console.error(e);
            });
    }

    /**
     * Extract the author from the response body
     */
    async extractAuthor() {
        return new Promise(resolve => {
            const matches = [];
            // ensure we eventually resolve the promise
            const timeout = setTimeout(() => {
                resolve(matches);
            }, 1000);
            // handle resolving the promise
            const resolveRewriter = () => {
                clearTimeout(timeout);
                resolve(
                    matches
                        // filter out repeated auhtors, if there are any
                        .filter((author, index, self) =>
                            matches.indexOf(author) === index
                        )
                );
            }
            // If the author is properly marked up, we can use meta tags
            this._rewriter.on("meta[name='author']", {
                element(element) {
                    let match = getAuthorMatches(
                        element.getAttribute("content")
                    );
                    if (matches.length > MATCH_MAX) {
                        resolveRewriter();
                    }
                    matches.push(...match);
                }
            });
            // handle the body and text
            // this._rewriter.on("body", {
            //     text(element) {
            //         let match = getAuthorMatches(element.text);
            //         if (matches.length > MATCH_MAX) {
            //             resolveRewriter();
            //         }
            //         matches.push(...match);
            //     },
            // });
        })
            .catch(e => {
                console.error(e);
            });
    }

    /**
     * Use the HTMLRewriter to perform all operations
     */
    async transform(operations: operations) {
        console.log('transforming ...')
        // transform the response
        this._rewriter.transform(this._response);
        // wait for all operations to complete and then return the results
        const keys = Object.keys(operations);
        const values = await Promise.all(Object.values(operations));
        const results = Object.fromEntries(
            keys.map((key, index) => [key, values[index]])
        );
        return results;
    }

}