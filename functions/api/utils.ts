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

/**
 * Clean the URL
 */
export function cleanUrl(url) {
    return url.replace(/(^\w+:|^)\/\//, '');
}

/**
 * Capitalize the first letter of a string
 */
export function capitalizeFirstLetter(string: string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}