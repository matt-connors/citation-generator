const UA = 'Mozilla/5.0 (compatible; mlagenerator/1.0; +https://mlagenerator.com)';

interface Env {
  BROWSER: {
    quickAction(action: string, body: Record<string, unknown>): Promise<Response | string | Record<string, unknown>>;
  };
  RENDERER_SHARED_SECRET?: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (env.RENDERER_SHARED_SECRET) {
      const provided = request.headers.get('x-browser-renderer-token');
      if (provided !== env.RENDERER_SHARED_SECRET) {
        return json({ error: 'Unauthorized', code: 'unauthorized' }, 401);
      }
    }

    if (request.method !== 'POST') {
      return json({ error: 'Method not allowed', code: 'method_not_allowed' }, 405);
    }

    let body: Record<string, unknown>;
    try {
      body = await request.json() as Record<string, unknown>;
    } catch {
      return json({ error: 'Invalid JSON', code: 'bad_request' }, 400);
    }

    const action = body.action;
    const url = body.url;
    if (action !== 'content' || typeof url !== 'string') {
      return json({ error: 'Unsupported Browser Run request', code: 'bad_request' }, 400);
    }

    const rendered = await env.BROWSER.quickAction('content', {
      url,
      userAgent: UA,
      gotoOptions: { waitUntil: 'networkidle2' },
      rejectResourceTypes: ['image', 'font', 'media'],
    });

    if (rendered instanceof Response) return rendered;
    if (typeof rendered === 'string') {
      return new Response(rendered, {
        headers: { 'content-type': 'text/html; charset=utf-8' },
      });
    }
    return json(rendered);
  },
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}
