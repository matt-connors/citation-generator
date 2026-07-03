import { acquisitionMode, handleCiteWebsite } from './handler';
import { defaultCacheStore } from '../../lib/cache';
import type { AnalyticsBinding } from '../../lib/analytics';
import { isTestRequest } from '../../lib/test-context';
import { createBrowserRunBindingFromService, type BrowserRendererServiceBinding, type BrowserRunBinding } from '../../lib/acquisition/browser-run';
import type { AiBinding } from '../../lib/ai/citation-assist';
import { createAiGatewayBinding, type AiGatewayEnv } from '../../lib/ai/gateway';

interface Env extends AiGatewayEnv {
  ANALYTICS?: AnalyticsBinding;
  BROWSER?: BrowserRunBinding;
  BROWSER_RENDERER?: BrowserRendererServiceBinding;
  AI?: AiBinding;
  AI_CITATION_MODEL?: string;
  AI_GATEWAY_MODEL?: string;
  CITATION_INTERNAL_DEBUG_TOKEN?: string;
  CITATION_RENDERING_ENABLED?: string;
  CITATION_AI_ASSIST_ENABLED?: string;
  BROWSER_RENDERER_TOKEN?: string;
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url);
  // Test traffic gets undefined binding so no data point lands in the dataset.
  // Production dashboard stays clean.
  const analytics = isTestRequest(context.request) ? undefined : context.env.ANALYTICS;
  const ai = context.env.AI ?? createAiGatewayBinding(context.env);
  const internalDebug = isInternalDebugRequest(context.request, context.env.CITATION_INTERNAL_DEBUG_TOKEN);
  const browser = context.env.BROWSER ?? createBrowserRunBindingFromService(
    context.env.BROWSER_RENDERER,
    context.env.BROWSER_RENDERER_TOKEN,
  );

  return handleCiteWebsite(url, defaultCacheStore(), analytics, new Date(), {
    browser,
    ai,
    aiModel: context.env.AI_CITATION_MODEL || context.env.AI_GATEWAY_MODEL,
    acquisitionMode: internalDebug ? acquisitionMode(url.searchParams.get('acquisition')) : 'auto',
    bypassCache: internalDebug && url.searchParams.get('nocache') === '1',
    aiAssistEnabled: context.env.CITATION_AI_ASSIST_ENABLED !== '0',
    renderingEnabled: context.env.CITATION_RENDERING_ENABLED !== '0',
  });
};

function isInternalDebugRequest(request: Request, token: string | undefined): boolean {
  if (!token) return false;
  const provided = request.headers.get('x-mla-internal-token');
  return typeof provided === 'string' && provided.length > 0 && provided === token;
}
