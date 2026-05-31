import { handleCiteBook } from './handler';
import { defaultCacheStore } from '../../lib/cache';
import type { AnalyticsBinding } from '../../lib/analytics';
import { isTestRequest } from '../../lib/test-context';

interface Env { API_KEY?: string; ANALYTICS?: AnalyticsBinding }

export const onRequest: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url);
  const analytics = isTestRequest(context.request) ? undefined : context.env.ANALYTICS;
  return handleCiteBook(url, defaultCacheStore(), context.env.API_KEY, analytics);
};
