// @ts-ignore — citeproc has no types
import CSL from 'citeproc';
import type { CSLItem, RichText, SupportedStyle } from '../csl-types';

const styles: Map<string, string> = new Map();
const locales: Map<string, string> = new Map();

export function registerStyle(name: SupportedStyle, csl: string): void {
  styles.set(name, csl);
}

export function registerLocale(name: string, xml: string): void {
  locales.set(name, xml);
}

// We deliberately do NOT cache CSL.Engine instances across calls.
//
// Strategy chosen: Option B — fresh engine per formatCitation call.
//
// Why: citeproc's bibliography registry is keyed by item id. Once an id is
// inserted (via updateItems([id])), subsequent updateItems([id]) calls are
// no-ops in CSL.Registry.doinserts (`if (!this.registry[item])` guard at
// citeproc_commonjs.js:23137). That means a cached engine returns the FIRST
// item's rendered output for any later call that reuses the id — even if the
// underlying CSLItem content differs. This is a real correctness bug for any
// caller that reuses ids within a single Worker isolate (or any test that
// uses a fixed id like 'fixture').
//
// Option A (updateItems([]) to clear, then updateItems([id])) does work in
// the current citeproc version (init([]) resets myhash to {}, dodeletes
// purges everything not in myhash, doinserts then re-adds the new id). But
// the contract is undocumented and fragile across citeproc versions. Since
// engine construction is only ~5-20ms and these calls happen server-side
// (Cloudflare Worker), correctness > microbenchmark.
//
// We still cache parsed style XML and locale XML strings — those are pure
// data and safe to share.
function buildEngine(style: SupportedStyle, item: CSLItem): any {
  const csl = styles.get(style);
  if (!csl) throw new Error(`Unknown style: ${style}`);
  const sys: any = {
    retrieveLocale: (lang: string) => locales.get(lang) || locales.get('en-US') || '',
    retrieveItem: (_id: string) => item,
  };
  return new CSL.Engine(sys, csl, 'en-US');
}

export function formatCitation(item: CSLItem, style: SupportedStyle): RichText[] {
  const engine = buildEngine(style, item);
  engine.updateItems([item.id]);
  const bib = engine.makeBibliography();
  if (!bib || !bib[1] || !bib[1].length) return [];
  const raw: string = bib[1][0];
  return parseRichText(raw);
}

function parseRichText(html: string): RichText[] {
  const stripped = html
    .replace(/<div[^>]*>/g, '')
    .replace(/<\/div>/g, '')
    .replace(/^\s+|\s+$/g, '');
  const segments: RichText[] = [];
  const re = /<i>([\s\S]*?)<\/i>|([^<]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(stripped)) !== null) {
    if (m[1] !== undefined) {
      if (m[1]) segments.push({ text: decode(m[1]), italic: true });
    } else if (m[2] !== undefined) {
      const text = decode(m[2].replace(/<[^>]+>/g, ''));
      if (text) segments.push({ text });
    }
  }
  return segments;
}

function decode(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    // Generic numeric character references emitted by citeproc-js (e.g. &#38;
    // for &, &#x2014; for em-dash). The named-entity list above doesn't cover
    // these, so without this they leak through to user-visible output.
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&#x([0-9a-fA-F]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)));
}
