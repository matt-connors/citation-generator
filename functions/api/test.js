export function onRequest(context) {
    const data = {
        message: "Hello from Cloudflare Worker!"
    };
    const options = {
        headers: {
            "content-type": "application/json"
        }
    };
    return new Response(JSON.stringify(data), options);
}