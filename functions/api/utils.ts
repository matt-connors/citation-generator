/**
 * Stringifies the body and creates a JSON response
 */
export function createResponse(body: any) {
    return new Response(JSON.stringify(body), {
        headers: {
            "content-type": "application/json"
        }
    });
}

/**
 * Check if the URL is invalid
 */
export function isUrlInvalid(url: string) {
    const match = url.match(/^(http|https):\/\/([^.]+)\.([^\.]+)(.*)$/);
    if (match === null) {
        return true;
    }
    return false;
}