import { handleCiteBook } from './handler';
import { defaultCacheStore } from '../../lib/cache';

interface Env { API_KEY?: string }

export const onRequest: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url);
  return handleCiteBook(url, defaultCacheStore(), context.env.API_KEY);
};
