import { handleCiteJournal } from './handler';
import { defaultCacheStore } from '../../lib/cache';
import type { AnalyticsBinding } from '../../lib/analytics';
import { isTestRequest } from '../../lib/test-context';

interface Env { ANALYTICS?: AnalyticsBinding }

export const onRequest: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url);
  const analytics = isTestRequest(context.request) ? undefined : context.env.ANALYTICS;
  return handleCiteJournal(url, defaultCacheStore(), analytics);
};
