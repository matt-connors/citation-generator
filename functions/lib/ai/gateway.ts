import type { AiBinding } from './citation-assist';

export interface AiGatewayEnv {
  AI_GATEWAY_CHAT_URL?: string;
  AI_GATEWAY_TOKEN?: string;
  AI_GATEWAY_ID?: string;
}

export function createAiGatewayBinding(env: AiGatewayEnv): AiBinding | undefined {
  if (!env.AI_GATEWAY_CHAT_URL) return undefined;
  return {
    async run(model: string, input: Record<string, unknown>): Promise<unknown> {
      const headers: Record<string, string> = {
        'content-type': 'application/json',
      };
      if (env.AI_GATEWAY_TOKEN) headers.authorization = `Bearer ${env.AI_GATEWAY_TOKEN}`;
      if (env.AI_GATEWAY_ID) headers['cf-aig-gateway-id'] = env.AI_GATEWAY_ID;
      const res = await fetch(env.AI_GATEWAY_CHAT_URL!, {
        method: 'POST',
        headers,
        body: JSON.stringify({ ...input, model }),
      });
      if (!res.ok) throw new Error(`AI Gateway HTTP ${res.status}`);
      return res.json();
    },
  };
}
