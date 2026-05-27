import { handleCiteBook } from './handler';
import { defaultCacheStore } from '../../lib/cache';
import type { AnalyticsBinding } from '../../lib/analytics';

interface Env { API_KEY?: string; ANALYTICS?: AnalyticsBinding }

export const onRequest: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url);
  return handleCiteBook(url, defaultCacheStore(), context.env.API_KEY, context.env.ANALYTICS);
};
