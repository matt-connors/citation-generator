import { handleCiteWebsite } from './handler';
import { defaultCacheStore } from '../../lib/cache';

export const onRequest: PagesFunction = async (context) => {
  const url = new URL(context.request.url);
  return handleCiteWebsite(url, defaultCacheStore());
};
