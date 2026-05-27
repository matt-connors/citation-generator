import { handleCiteWebsite } from './handler';
import { defaultCacheStore } from '../../lib/cache';
import type { AnalyticsBinding } from '../../lib/analytics';
import { isTestRequest } from '../../lib/test-context';

interface Env { ANALYTICS?: AnalyticsBinding }

export const onRequest: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url);
  // Test traffic (X-Mla-Test:1 or ?nocache=1) gets undefined binding so no
  // data point lands in the dataset. Production dashboard stays clean.
  const analytics = isTestRequest(context.request) ? undefined : context.env.ANALYTICS;
  return handleCiteWebsite(url, defaultCacheStore(), analytics);
};
