export function createResponse(body: any) {
  return new Response(JSON.stringify(body), {
    headers: { 'content-type': 'application/json' },
  });
}
