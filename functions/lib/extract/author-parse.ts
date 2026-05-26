import type { CSLName } from '../csl-types';

const ORG_SUFFIXES = /\b(Inc\.?|LLC|Ltd\.?|Corp\.?|Corporation|Foundation|Press|University|Institute|Society|Group|Company|Co\.?|Department|Office|Agency|Bureau|Commission)\b/i;
const PARTICLES = new Set([
  'von', 'de', 'del', 'della', 'van', 'la', 'le', 'der', 'den', 'di', 'da', 'du', 'dos', 'des',
]);
const SUFFIX = /^(Jr\.?|Sr\.?|II|III|IV|V|PhD|Ph\.D\.?|MD|M\.D\.?|MA|MSc|BSc|Esq\.?)$/i;

export function parseAuthorName(input: string | CSLName | null | undefined): CSLName | null {
  if (input == null) return null;
  if (typeof input === 'object') return input;
  const trimmed = input.trim();
  if (!trimmed) return null;
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
  let particle: string | undefined;
  if (parts.length >= 1 && PARTICLES.has(parts[parts.length - 1].toLowerCase())) {
    particle = parts.pop();
  }
  const given = parts.join(' ');

  const out: CSLName = { family };
  if (given) (out as any).given = given;
  if (particle) (out as any)['non-dropping-particle'] = particle;
  if (suffix) (out as any).suffix = suffix;
  return out;
}
