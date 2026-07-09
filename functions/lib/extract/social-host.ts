// Shared social/video platform detection. Used by the oEmbed rescue (which
// endpoint to hit), the citation-quality validator (to flag a social URL that
// resisted extraction), and the handler (to suppress a platform-chrome title
// that would otherwise masquerade as a real citation).

export type SocialPlatform = 'tiktok' | 'x' | 'youtube' | 'instagram';

export function socialPlatformOf(url: string): SocialPlatform | null {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase().replace(/^www\.|^mobile\.|^m\./, '');
  } catch {
    return null;
  }
  if (host === 'tiktok.com' || host.endsWith('.tiktok.com')) return 'tiktok';
  if (host === 'x.com' || host === 'twitter.com') return 'x';
  if (host === 'youtube.com' || host.endsWith('.youtube.com') || host === 'youtu.be') return 'youtube';
  if (host === 'instagram.com' || host.endsWith('.instagram.com')) return 'instagram';
  return null;
}

// When a recognized social page is readable enough to yield real content (a
// caption/tweet that survived the chrome check) but no platform hydration blob
// or keyless data API was reachable — X's syndication CDN blocks Cloudflare's
// datacenter egress, and a page can render without its __UNIVERSAL_DATA__ blob —
// the post's account handle is still sitting in the URL path. Recovering it lets
// the citation render in the correct per-style social format (handle bracket,
// [Post]/[Video] descriptor, platform container) instead of the generic-web
// fallback, with no dependence on a bot-walled API.
//
// Only platforms whose handle lives in the URL qualify: X (`/<handle>/status/`)
// and TikTok (`/@<handle>/video/`). YouTube (`/watch?v=`) and Instagram (`/p/`)
// carry a video id / shortcode rather than the channel or account, so they
// return null and keep relying on oEmbed or failing honestly. The caller only
// invokes this once a real title has survived the chrome check, so a walled page
// (whose chrome title was dropped) never reaches here and still fails honestly.
export function socialHandleFromUrl(
  url: string,
): { platform: SocialPlatform; handle: string; kind: 'post' | 'video' } | null {
  const platform = socialPlatformOf(url);
  if (!platform) return null;
  let path: string;
  try {
    path = new URL(url).pathname;
  } catch {
    return null;
  }
  if (platform === 'x') {
    const handle = path.match(/^\/([^/]+)\/status(?:es)?\/\d+/i)?.[1];
    // `/i/status/…`, `/i/web/status/…` are X's intent/redirect paths, not a
    // real account — reject them rather than cite "i" as the author.
    if (handle && !/^i$/i.test(handle)) return { platform, handle, kind: 'post' };
    return null;
  }
  if (platform === 'tiktok') {
    const handle = path.match(/^\/@([^/]+)\/video\/\d+/i)?.[1];
    if (handle) return { platform, handle, kind: 'video' };
    return null;
  }
  return null;
}

export function platformLabel(platform: SocialPlatform): string {
  switch (platform) {
    case 'tiktok': return 'TikTok';
    case 'x': return 'X';
    case 'youtube': return 'YouTube';
    case 'instagram': return 'Instagram';
  }
}

// The generic signals fall back to a page's chrome title when the real content
// can't be read: TikTok/Instagram serve "<Creator> on TikTok", YouTube serves
// "<Title> - YouTube" (and a bare "- YouTube" when even that is walled), X
// serves "<Name> on X". None of these is the post's caption, so when social
// extraction has failed they are worse than nothing — they read like a finished
// citation while being wrong. This flags a title that is only platform chrome.
export function looksLikePlatformChrome(title: string | undefined, platform: SocialPlatform): boolean {
  if (!title) return false;
  const t = title.trim();
  if (!t) return false;
  switch (platform) {
    case 'tiktok':
      return / on TikTok$/i.test(t);
    case 'instagram':
      return / on Instagram$/i.test(t) || /^Instagram$/i.test(t);
    case 'youtube':
      // "- YouTube", "Title - YouTube", or the walled "- YouTube" with empty title.
      return /-\s*YouTube$/i.test(t) || /^-?\s*YouTube$/i.test(t);
    case 'x':
      return / on X$/i.test(t) || / \/ X$/i.test(t) || / on Twitter$/i.test(t) || /^X$/i.test(t);
  }
}
