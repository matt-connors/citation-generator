import { handleCiteJournal } from './handler';
import { defaultCacheStore } from '../../lib/cache';

export const onRequest: PagesFunction = async (context) => {
  const url = new URL(context.request.url);
  return handleCiteJournal(url, defaultCacheStore());
};
