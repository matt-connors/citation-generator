import type { CSLItem, CSLName, SocialMeta, SupportedStyle } from '../csl-types';

// Style-specific shaping for social-media posts (custom.social present).
//
// Each citation style disagrees about how to present a social post, in ways a
// single CSL item can't express, so extraction stores the raw facts (real name
// shapes, full caption, full URL, platform/handle/kind) and this transform —
// run at render time inside formatCitation — shapes them per style. User edits
// to author/title flow through: the adapter reads the CURRENT author and title
// and only adds the platform conventions.
//
// Confidence map (verified against each style's official source, 2026-07):
//   MLA 9   — style.mla.org social/TikTok/X/Instagram posts. "Name [@handle]."
//             caption reproduced verbatim; URL without protocol (Handbook §5.95).
//   APA 7   — apastyle.apa.org platform reference pages. "Family, I. [@handle]."
//             caption italic, first 20 words, then [Video]/[Photograph]/[Post].
//   Chicago 18 (author-date) — CMOS 18 §14.105-106. "Name (@handle). Year.
//             \"caption verbatim.\" Platform, Month Day. URL." Pre-July-2023 X
//             posts render "Twitter (now X)".
//   Harvard  — Cite Them Right 13. Posts: "Family, I. [@handle] (Year) 'text'
//             [Platform] Day Month. Available at: URL (Accessed: date)." — with
//             the bracket only for PERSON names (organisations use the plain
//             account name). Videos (YouTube): italic title + day-month, no
//             platform container.
// Styles with NO official social-media format — Vancouver (NLM Citing Medicine),
// IEEE (posts), AMA 11 (posts) — get a clean, documented generic-web fallback,
// not an invented format. See docs/citation-matrix.md. YouTube video does have
// an official IEEE model, so it is routed to IEEE's online-video template.

interface SocialAware extends CSLItem {
  genre?: string;
  medium?: string;
}

export function adaptForStyle(item: CSLItem, style: SupportedStyle): CSLItem {
  let adapted: SocialAware = item;

  // MLA URL truncation applies to every source type, not just social posts —
  // the handbook's rule is general. DOI links are the stated exception.
  if (style === 'mla-9' && item.URL && !/^https?:\/\/(dx\.)?doi\.org\//i.test(item.URL)) {
    adapted = { ...adapted, URL: item.URL.replace(/^https?:\/\//i, '') };
  }

  const social = item.custom?.social;
  if (!social) return adapted;

  if (style === 'mla-9') {
    adapted = { ...adapted };
    const author = handleLiteral(item.author, social, 'full', '[@%]');
    if (author) adapted.author = [author];
    // Captions are quotations of the creator's text: defeat the style's
    // title-casing so "Fighting fire with fire" isn't rewritten. YouTube
    // titles are titles of works and keep MLA's standard capitalization.
    if (adapted.title && social.platform !== 'youtube') {
      adapted.title = nocase(adapted.title);
    }
    return adapted;
  }

  if (style === 'apa-7') {
    adapted = { ...adapted };
    const author = handleLiteral(item.author, social, 'initials', '[@%]');
    if (author) adapted.author = [author];
    if (adapted.title && social.platform !== 'youtube') {
      adapted.title = firstWords(adapted.title, 20);
    }
    const descriptor = apaDescriptor(social);
    if (descriptor) adapted.genre = descriptor;
    return adapted;
  }

  if (style === 'chicago-18' && social.platform !== 'youtube') {
    // CMOS 18: screen name in PARENTHESES after the author, caption reproduced
    // verbatim (not title-cased). YouTube is a video, not a post — it keeps the
    // generic author-date video form, so it is excluded here.
    adapted = { ...adapted };
    const author = handleLiteral(item.author, social, 'full', '(@%)', true);
    if (author) adapted.author = [author];
    if (adapted.title) adapted.title = nocase(adapted.title);
    if (social.platform === 'x' && isBeforeXRename(item.issued)) {
      // nocase so the CSL title macro can't capitalize "now" to "Now".
      adapted['container-title'] = nocase('Twitter (now X)');
    }
    return adapted;
  }

  if (style === 'harvard') {
    adapted = { ...adapted };
    if (social.platform === 'youtube') {
      // CTR video: italic title, day-month upload date, no platform container.
      adapted.type = 'motion_picture' as CSLItem['type'];
      delete adapted['container-title'];
      return adapted;
    }
    // CTR post: author with username, text in single quotes, [Platform] medium,
    // day-month date. The bracketed handle is for PERSON names only —
    // organisations (literal author) use the plain account name.
    adapted.type = 'post-weblog' as CSLItem['type'];
    const person = item.author?.length === 1 && !('literal' in item.author[0]);
    const author = person ? handleLiteral(item.author, social, 'initials', '[@%]') : null;
    if (author) adapted.author = [author];
    adapted.medium = harvardMedium(social);
    delete adapted['container-title'];
    return adapted;
  }

  if (style === 'ieee') {
    if (social.platform === 'youtube') {
      // IEEE has no social-post format, but it does have an official
      // online-video template — route YouTube there (title in initial caps,
      // (date), [Online Video], Available:). motion_picture is the CSL type
      // ieee.csl renders that way.
      return { ...adapted, type: 'motion_picture' as CSLItem['type'], 'container-title': undefined };
    }
    // Posts: IEEE has no social format, so the generic online-source template
    // (quoted title, comma, container) applies as a documented fallback. Strip
    // a trailing sentence period from the caption so it doesn't stack with
    // IEEE's title comma into ".," .
    if (adapted.title) {
      adapted = { ...adapted, title: adapted.title.replace(/\.\s*$/, '') };
    }
    return adapted;
  }

  if (style === 'vancouver') {
    // No NLM social format: render the cleanest generic Web-Sites fallback so
    // the caption (not the platform) is the title and the platform is the
    // publisher, instead of the default which puts the platform in the title
    // slot and orphans the caption.
    adapted = { ...adapted };
    if (item['container-title'] && item.title) {
      adapted.publisher = item['container-title'];
      adapted['publisher-place'] = '[place unknown]';
      delete adapted['container-title'];
    }
    return adapted;
  }

  return adapted;
}

// Wrap text so the CSL title macro's text-case="title" can't re-case it —
// social captions are quotations and must appear as written.
function nocase(text: string): string {
  return `<span class="nocase">${text}</span>`;
}

function harvardMedium(social: SocialMeta): string {
  if (social.platform === 'x') return 'X';
  if (social.platform === 'tiktok') return 'TikTok';
  if (social.platform === 'instagram') return 'Instagram';
  return 'Post';
}

// CMOS 18 designates posts published before X's July 2023 rename as
// "Twitter (now X)". Later posts are "X".
function isBeforeXRename(issued: CSLItem['issued']): boolean {
  const parts = issued?.['date-parts']?.[0];
  if (!parts || !parts.length) return true;
  const [y, m = 1] = parts as number[];
  return y < 2023 || (y === 2023 && m < 7);
}

// Builds an author literal that carries the account handle in the style's
// bracket convention (pattern uses "%" for the handle). MLA/APA append the
// handle only when name and handle differ; Chicago (always=true) appends it
// unconditionally, including for organisations. Handle-only items pass through
// as the extractor stored them.
function handleLiteral(
  authors: CSLName[] | undefined,
  social: SocialMeta,
  nameForm: 'full' | 'initials',
  pattern: string,
  always = false,
): CSLName | null {
  if (!authors || authors.length !== 1) return null;
  const name = authors[0];
  const handle = social.handle;
  if (!handle) return null;

  let base: string;
  if ('literal' in name) {
    base = name.literal;
  } else if (nameForm === 'initials') {
    base = `${name.family}, ${initialsOf(name.given)}`.replace(/, $/, '');
  } else {
    base = name.given ? `${name.family}, ${name.given}` : name.family;
  }
  if (!base) return null;

  // Same name and handle, or a bare "@handle" author: no bracket, keep the
  // original shape so person names still sort/initialize natively.
  if (!always && (squash(base) === squash(handle) || base === `@${handle}`)) return null;
  if (base === `@${handle}`) return null;

  const bracket = pattern.replace('%', handle);
  return { literal: `${base} ${bracket}` };
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
