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
