import { describe, it, expect, vi, afterEach } from 'vitest';
import { createAiGatewayBinding } from '../../functions/lib/ai/gateway';

describe('createAiGatewayBinding', () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => { globalThis.fetch = originalFetch; });

  it('posts chat-compatible payloads to a configured Gateway URL', async () => {
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({ response: '{"ok":true}' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })) as any;
    const ai = createAiGatewayBinding({
      AI_GATEWAY_CHAT_URL: 'https://api.cloudflare.com/client/v4/accounts/acct/ai/v1/chat/completions',
      AI_GATEWAY_TOKEN: 'token',
      AI_GATEWAY_ID: 'default',
    });

    const result = await ai!.run('openai/gpt-5.4-nano', { messages: [{ role: 'user', content: 'hi' }] });

    expect(result).toEqual({ response: '{"ok":true}' });
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://api.cloudflare.com/client/v4/accounts/acct/ai/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          authorization: 'Bearer token',
          'cf-aig-gateway-id': 'default',
        }),
        body: expect.stringContaining('"model":"openai/gpt-5.4-nano"'),
      }),
    );
  });
});
