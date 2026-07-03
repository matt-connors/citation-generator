import { handleQualityCheck } from './handler';
import type { AiBinding } from '../../../lib/ai/citation-assist';
import { createAiGatewayBinding, type AiGatewayEnv } from '../../../lib/ai/gateway';

interface Env extends AiGatewayEnv {
  AI?: AiBinding;
  AI_CITATION_MODEL?: string;
  AI_GATEWAY_MODEL?: string;
  CITATION_AI_CHECK_ENABLED?: string;
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const ai = context.env.AI ?? createAiGatewayBinding(context.env);
  return handleQualityCheck(context.request, {
    ai,
    aiModel: context.env.AI_CITATION_MODEL || context.env.AI_GATEWAY_MODEL,
    aiCheckEnabled: context.env.CITATION_AI_CHECK_ENABLED === '1',
  });
};
