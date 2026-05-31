// @ts-ignore — citeproc has no types
import CSL from 'citeproc';
import { Parser } from 'htmlparser2';
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
// Per-style default rendering locale. Most styles are American English, but
// Cite Them Right (Harvard) is a British style (declared xml:lang="en-GB").
// Rendering it under en-US silently produces US date order ("May 31, 2026"
// instead of "31 May 2026"), US double quotation marks instead of British
// single quotes, and "ed." instead of "edn." Rendering under en-GB — with the
// en-GB locale registered — fixes all three. citeproc falls back to en-US for
// any locale that has not been registered.
const STYLE_LOCALE: Partial<Record<SupportedStyle, string>> = {
  harvard: 'en-GB',
};

function buildEngine(style: SupportedStyle, item: CSLItem): any {
  const csl = styles.get(style);
  if (!csl) throw new Error(`Unknown style: ${style}`);
  const lang = STYLE_LOCALE[style] ?? 'en-US';
  const sys: any = {
    retrieveLocale: (l: string) => locales.get(l) || locales.get('en-US') || '',
    retrieveItem: (_id: string) => item,
  };
  return new CSL.Engine(sys, csl, lang);
}

export function formatCitation(item: CSLItem, style: SupportedStyle): RichText[] {
  const engine = buildEngine(style, item);
  engine.updateItems([item.id]);
  const bib = engine.makeBibliography();
  if (!bib || !bib[1] || !bib[1].length) return [];
  const raw: string = bib[1][0];
  return parseRichText(raw);
}

// Parses citeproc-js's HTML output into RichText[]. Earlier versions used a
// regex that only recognized <i>; this missed <div class="csl-left-margin">
// (used by IEEE/Vancouver), <span class="nocase">, <sup>, <sub>, <b>, etc.,
// and produced glued-together text at div boundaries (e.g. "[1]J. Doe").
//
// htmlparser2 (already in the cheerio tree, no new dep) decodes HTML entities
// natively — including numeric refs like &#38; and &#x2014; — so the previous
// manual decode pass is no longer required.
function parseRichText(html: string): RichText[] {
  const segments: RichText[] = [];
  let italicDepth = 0;
  // When we exit a <div>, insert a separator before the next text run so that
  // sibling divs (csl-left-margin / csl-right-inline) don't collapse together.
  let pendingSpace = false;

  const flush = (text: string): void => {
    if (!text) return;
    if (pendingSpace) {
      text = ' ' + text;
      pendingSpace = false;
    }
    segments.push(italicDepth > 0 ? { text, italic: true } : { text });
  };

  const parser = new Parser({
    onopentag(name) {
      const n = name.toLowerCase();
      if (n === 'i' || n === 'em') italicDepth += 1;
    },
    onclosetag(name) {
      const n = name.toLowerCase();
      if (n === 'i' || n === 'em') italicDepth = Math.max(0, italicDepth - 1);
      else if (n === 'div' && segments.length > 0) pendingSpace = true;
    },
    ontext(text) {
      flush(text);
    },
  }, { decodeEntities: true });
  try {
    parser.write(html);
    parser.end();
  } catch {
    // htmlparser2 is lenient, but on truly malformed input we degrade to plain
    // text (tags stripped) rather than letting the exception 500 the request.
    return [{ text: html.replace(/<[^>]*>/g, '').trim() }].filter((s) => s.text);
  }

  // Merge adjacent same-formatting segments (cosmetic; keeps RichText[] tidy
  // and avoids fragmenting JSX render output).
  const merged: RichText[] = [];
  for (const seg of segments) {
    const prev = merged[merged.length - 1];
    if (prev && !!prev.italic === !!seg.italic) {
      prev.text += seg.text;
    } else {
      merged.push({ ...seg });
    }
  }

  // Trim leading/trailing whitespace on the whole bibliography string by
  // stripping it off the first/last segment only. Internal whitespace is
  // preserved verbatim because citeproc already lays it out correctly.
  if (merged.length > 0) {
    merged[0].text = merged[0].text.replace(/^\s+/, '');
    merged[merged.length - 1].text = merged[merged.length - 1].text.replace(/\s+$/, '');
  }
  return merged.filter((s) => s.text);
}
