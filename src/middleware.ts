import { defineMiddleware } from 'astro:middleware';
import { getCanonicalTrailingSlashRedirectUrl } from './lib/canonical-routes';

export const onRequest = defineMiddleware((context, next) => {
  const redirectUrl = getCanonicalTrailingSlashRedirectUrl(context.request);
  if (redirectUrl) return Response.redirect(redirectUrl, 301);
  return next();
});
