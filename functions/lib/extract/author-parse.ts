import type { CSLName } from '../csl-types';

// Anchored to end-of-string so suffix-shaped tokens only flag a name as an
// org when they actually terminate it. A surname like "Co" in "Co, John" or a
// middle name like "Foundation" in "Foundation House Smith" no longer
// false-positives as a corporate author. The trailing `[.\s]*` lets a stray
// period close the match (e.g. "Wikimedia Foundation.") since several
// alternations (Foundation, Press, University, Institute, Society, Group,
// Company, Department, Office, Agency, Bureau, Commission) don't include an
// optional `.` of their own.
const ORG_SUFFIXES = /\b(Inc\.?|LLC|Ltd\.?|Corp\.?|Corporation|Foundation|Press|University|Institute|Society|Group|Company|Co\.?|Department|Office|Agency|Bureau|Commission|Administration|Authority|Association|Council|Center|Centre|Laboratory|Lab|Labs|Ministry|Service|Services|News|Editorial Board|Editorial Team|Staff)[.\s]*$/i;
const PARTICLES = new Set([
  'von', 'de', 'del', 'della', 'van', 'la', 'le', 'der', 'den', 'di', 'da', 'du', 'dos', 'des',
]);
const SUFFIX = /^(Jr\.?|Sr\.?|II|III|IV|V|PhD|Ph\.D\.?|MD|M\.D\.?|MA|MSc|BSc|Esq\.?)$/i;
// Lone role words that a byline can leave behind (e.g. a `<span>by</span>` label
// selected on its own). As an exact whole-token match they never bite a real
// multi-word name — "The Onion" or "By Bythewood" are unaffected.
const STOPWORDS = new Set(['by', 'written', 'posted', 'author', 'and', 'the']);

export function parseAuthorName(input: string | CSLName | null | undefined): CSLName | null {
  if (input == null) return null;
  if (typeof input === 'object') return input;
  const trimmed = input.trim();
  if (!trimmed) return null;
  // A lone role word ("by"/"By"/"BY"…) or letterless junk is never a name. This
  // sits before the all-caps acronym branch so "BY" can't slip through as a
  // literal, and guards every caller (byline heuristic, jsonld, meta, microdata).
  if (STOPWORDS.has(trimmed.toLowerCase())) return null;
  if (!/\p{L}/u.test(trimmed)) return null;
  if (/^[A-Z][A-Z0-9&.-]{1,14}$/.test(trimmed)) return { literal: trimmed };
  if (ORG_SUFFIXES.test(trimmed)) return { literal: trimmed };

  if (trimmed.includes(',')) {
    const [family, given] = trimmed.split(',', 2).map((s) => s.trim());
    if (!family) return null;
    return given ? { family, given } : { family };
  }

  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return { family: parts[0] };

  let suffix: string | undefined;
  if (SUFFIX.test(parts[parts.length - 1])) {
    suffix = parts.pop();
  }
  const family = parts.pop();
  if (!family) return null;
  const particleParts: string[] = [];
  while (parts.length >= 1 && PARTICLES.has(parts[parts.length - 1].toLowerCase())) {
    particleParts.unshift(parts.pop() as string);
  }
  const given = parts.join(' ');

  const out: CSLName = { family };
  if (given) (out as any).given = given;
  if (particleParts.length) (out as any)['non-dropping-particle'] = particleParts.join(' ');
  if (suffix) (out as any).suffix = suffix;
  return out;
}

export function parseAuthorList(input: string | null | undefined): CSLName[] {
  if (!input) return [];
  const cleaned = input
    .replace(/\s+/g, ' ')
    .trim() // trim FIRST so a leading "By" is at ^ for the strip (e.g. "  By Jane ")
    // Strip a leading byline role word, anchored on \b so it only matches a whole
    // token — "by"/"By"/"written by"/"posted/authored by"/"Author:" go, but
    // "Bythewood" is preserved. The name after it is no longer required, so a
    // bare "by" collapses to "" (→ []) instead of {family:"by"}.
    .replace(/^(?:written\s+by|posted\s+by|authored\s+by|by|author)\b\s*:?\s*/i, '')
    .replace(/\s+et\s+al\.?$/i, '')
    .trim();
  if (!cleaned) return [];

  const segments = splitAuthorSegments(cleaned);
  return segments
    .map((segment) => parseAuthorName(segment))
    .filter(Boolean) as CSLName[];
}

function splitAuthorSegments(input: string): string[] {
  const semicolonParts = input.split(/\s*;\s*/).filter(Boolean);
  if (semicolonParts.length > 1) {
    return semicolonParts.flatMap(splitAuthorSegments);
  }

  const conjunctionParts = input.split(/\s+(?:and|&)\s+/i).filter(Boolean);
  if (conjunctionParts.length > 1 && conjunctionParts.every(looksLikeAuthorUnit)) {
    return conjunctionParts.flatMap(splitAuthorSegments);
  }

  return splitCommaSegments(input);
}

function splitCommaSegments(input: string): string[] {
  const parts = input.split(/\s*,\s*/).filter(Boolean);
  if (parts.length <= 1) return [input];

  if (parts.length === 2) {
    return looksLikeInvertedSingleName(parts[0], parts[1]) ? [input] : parts;
  }

  if (parts.length % 2 === 0) {
    const pairs: string[] = [];
    for (let i = 0; i < parts.length; i += 2) {
      if (!looksLikeInvertedSingleName(parts[i], parts[i + 1])) return parts;
      pairs.push(`${parts[i]}, ${parts[i + 1]}`);
    }
    return pairs;
  }

  return parts;
}

function looksLikeInvertedSingleName(left: string, right: string): boolean {
  const leftWords = left.trim().split(/\s+/).filter(Boolean);
  const rightWords = right.trim().split(/\s+/).filter(Boolean);
  if (!leftWords.length || !rightWords.length) return false;
  if (ORG_SUFFIXES.test(left) || ORG_SUFFIXES.test(right)) return false;
  if (leftWords.length === 1 || rightWords.length === 1) return true;
  return leftWords.slice(0, -1).every((word) => PARTICLES.has(word.toLowerCase()));
}

function looksLikeAuthorUnit(segment: string): boolean {
  const parsed = parseAuthorName(segment);
  if (!parsed) return false;
  if ('literal' in parsed) return true;
  return Boolean(parsed.given);
}
