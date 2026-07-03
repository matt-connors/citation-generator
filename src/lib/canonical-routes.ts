const CANONICAL_TRAILING_SLASH_PATHS = new Set([
  '/guides',
  '/about',
  '/privacy',
  '/terms',
  '/my-references',
  '/ama-citation-generator',
  '/apa-citation-generator',
  '/chicago-citation-generator',
  '/harvard-referencing-generator',
  '/ieee-citation-generator',
  '/mla-citation-generator',
  '/vancouver-citation-generator',
  '/admin/analytics',
]);

function canRedirectMethod(method: string): boolean {
  return method === 'GET' || method === 'HEAD';
}

function isCanonicalTrailingSlashPath(pathname: string): boolean {
  if (CANONICAL_TRAILING_SLASH_PATHS.has(pathname)) return true;
  if (/^\/guides\/category\/[^/]+$/.test(pathname)) return true;
  return /^\/guides\/[^/]+$/.test(pathname);
}

export function getCanonicalTrailingSlashRedirectUrl(request: Request): string | null {
  if (!canRedirectMethod(request.method)) return null;

  const url = new URL(request.url);
  if (!isCanonicalTrailingSlashPath(url.pathname)) return null;

  url.pathname = `${url.pathname}/`;
  return url.toString();
}
