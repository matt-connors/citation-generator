const TRACKING_PARAMS = new Set([
  'fbclid', 'gclid', 'ref', 'mc_cid', 'mc_eid', 'igshid', 'msclkid', 'yclid',
]);

export function normalizeUrl(input: string): string {
  const u = new URL(input);
  u.protocol = u.protocol.toLowerCase();
  u.hostname = u.hostname.toLowerCase();
  u.hash = '';
  const cleaned = new URLSearchParams();
  const keys = [...new Set([...u.searchParams.keys()])].sort();
  for (const key of keys) {
    if (key.startsWith('utm_') || TRACKING_PARAMS.has(key)) continue;
    for (const v of u.searchParams.getAll(key)) cleaned.append(key, v);
  }
  const qs = cleaned.toString();
  u.search = qs ? `?${qs}` : '';
  return u.toString();
}
