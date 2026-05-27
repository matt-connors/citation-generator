import { handleCiteWebsite } from './handler';
import { defaultCacheStore } from '../../lib/cache';
import type { AnalyticsBinding } from '../../lib/analytics';

interface Env { ANALYTICS?: AnalyticsBinding }

export const onRequest: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url);
  return handleCiteWebsite(url, defaultCacheStore(), context.env.ANALYTICS);
};
