import type { CSLItem, CSLName, SocialMeta, SupportedStyle } from '../csl-types';

// Style-specific shaping for social-media posts (custom.social present).
//
// The official styles disagree about handles and descriptors in ways a single
// CSL item can't express:
//   MLA 9  — "Fogarty, Mignon [@GrammarGirl]." caption reproduced AS WRITTEN
//            (MLA Style Center social-media guidance), URL without https://
//            (MLA Handbook §5.95 truncates protocols; DOI links keep theirs).
//   APA 7  — "Fogarty, M. [@GrammarGirl]." title = first 20 words of the
//            caption (hashtags/URLs/emojis each count as one word), then a
//            bracketed descriptor: [Post] for X, [Video] for TikTok/YouTube/
//            Reels, [Photograph] for Instagram photos (APA Style social
//            media reference pages).
//   Harvard — Cite Them Right's social-media template: "Author and username
//            if available", the post text in single quotes, the platform as
//            a bracketed medium, then the day-month date: Fogarty, M.
//            [@GrammarGirl] (2019) 'Every once in a while…' [X] 13 February.
//            Rendered by switching the item to post-weblog with the platform
//            as medium. YouTube stays a webpage (CTR treats videos, not
//            posts).
//   Others — no platform-specific official rule; their standard web-source
//            formats apply unchanged.
//
// The transform runs at render time inside formatCitation, so the stored CSL
// stays honest (real name shapes, full caption, full URL) and user edits to
// the author or title flow through: the adapter reads the CURRENT author and
// title, adding only the platform conventions.

export function adaptForStyle(item: CSLItem, style: SupportedStyle): CSLItem {
  let adapted = item;

  // MLA URL truncation applies to every source type, not just social posts —
  // the handbook's rule is general. DOI links are the stated exception.
  if (style === 'mla-9' && item.URL && !/^https?:\/\/(dx\.)?doi\.org\//i.test(item.URL)) {
    adapted = { ...adapted, URL: item.URL.replace(/^https?:\/\//i, '') };
  }

  const social = item.custom?.social;
  if (!social) return adapted;

  if (style === 'mla-9') {
    adapted = { ...adapted };
    const author = socialAuthorLiteral(item.author, social, 'full');
    if (author) adapted.author = [author];
    // Captions are quotations of the creator's text: defeat the style's
    // title-casing so "Fighting fire with fire" isn't rewritten. YouTube
    // titles are titles of works and keep MLA's standard capitalization.
    if (adapted.title && social.platform !== 'youtube') {
      adapted.title = `<span class="nocase">${adapted.title}</span>`;
    }
    return adapted;
  }

  if (style === 'apa-7') {
    adapted = { ...adapted };
    const author = socialAuthorLiteral(item.author, social, 'initials');
    if (author) adapted.author = [author];
    if (adapted.title && social.platform !== 'youtube') {
      adapted.title = firstWords(adapted.title, 20);
    }
    const descriptor = apaDescriptor(social);
    if (descriptor) adapted.genre = descriptor;
    return adapted;
  }

  if (style === 'harvard' && social.platform !== 'youtube') {
    adapted = { ...adapted, type: 'post-weblog' as CSLItem['type'] };
    const author = socialAuthorLiteral(item.author, social, 'initials');
    if (author) adapted.author = [author];
    // CTR's bracketed medium names the platform; the container would repeat
    // it ('…' [TikTok], TikTok), so it comes off for this rendering.
    (adapted as CSLItem & { medium?: string }).medium = harvardMedium(social);
    delete adapted['container-title'];
    return adapted;
  }

  return adapted;
}

function harvardMedium(social: SocialMeta): string {
  if (social.platform === 'x') return 'X';
  if (social.platform === 'tiktok') return 'TikTok';
  if (social.platform === 'instagram') return 'Instagram';
  return 'Post';
}

// Builds "Name [@handle]" from the item's CURRENT author (so user edits
// survive) plus the recorded handle. Brackets appear only when the name and
// handle actually differ (MLA's rule; APA group-author examples like
// "CDC [@CDCgov]" differ by definition). Handle-only items pass through as
// the extractor stored them (a literal "@handle").
function socialAuthorLiteral(
  authors: CSLName[] | undefined,
  social: SocialMeta,
  nameForm: 'full' | 'initials',
): CSLName | null {
  if (!authors || authors.length !== 1) return null;
  const name = authors[0];
  const handle = social.handle;

  let base: string;
  if ('literal' in name) {
    base = name.literal;
  } else if (nameForm === 'initials') {
    base = `${name.family}, ${initialsOf(name.given)}`.replace(/, $/, '');
  } else {
    base = name.given ? `${name.family}, ${name.given}` : name.family;
  }
  if (!base) return null;

  if (!handle || squash(base) === squash(handle) || base === `@${handle}`) {
    // Same name and handle (or handle-only): no brackets, keep the original
    // shape so person names still sort/initialize natively.
    return null;
  }
  return { literal: `${base} [@${handle}]` };
}

function initialsOf(given: string | undefined): string {
  if (!given) return '';
  return given
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((part) => `${part[0].toUpperCase()}.`)
    .join(' ');
}

// APA's 20-word title cap: hashtags, URLs, and emojis each count as one word.
// The cut is hard — APA's own example ends mid-sentence with no ellipsis.
function firstWords(text: string, count: number): string {
  const words = text.trim().split(/\s+/);
  if (words.length <= count) return text.trim();
  return words.slice(0, count).join(' ');
}

function apaDescriptor(social: SocialMeta): string | null {
  if (social.platform === 'x') return 'Post';
  if (social.kind === 'video') return 'Video';
  if (social.kind === 'photo') return 'Photograph';
  return 'Post';
}

function squash(value: string): string {
  return value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
}
