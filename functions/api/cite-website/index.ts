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
    // AI field-assist is enabled whenever an AI binding is present (the binding
    // is the enablement signal — no separate flag). It still only runs on pages
    // still missing core fields after fetch+render (shouldRunAiAssist), every
    // proposal must be verbatim-verified against the page (see citation-assist),
    // and AI-filled fields are surfaced as "AI-suggested — verify" in the UI.
    aiAssistEnabled: !!ai,
    // Browser Run is enabled whenever a browser binding is present — the binding
    // IS the enablement signal (no separate flag). Rendering still only fires for
    // thin/blocked/JS-heavy pages (see shouldRender) and degrades gracefully to
    // the fetch result on failure, so a bound-but-broken renderer never breaks a
    // request.
    renderingEnabled: !!browser,
  });
};

function isInternalDebugRequest(request: Request, token: string | undefined): boolean {
  if (!token) return false;
  const provided = request.headers.get('x-mla-internal-token');
  return typeof provided === 'string' && provided.length > 0 && provided === token;
}
