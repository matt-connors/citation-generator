// @ts-ignore — citeproc has no types
import CSL from 'citeproc';
import type { CSLItem, RichText, SupportedStyle } from '../csl-types';

const styles: Map<string, string> = new Map();
const locales: Map<string, string> = new Map();
const engines: Map<string, any> = new Map();

export function registerStyle(name: SupportedStyle, csl: string): void {
  styles.set(name, csl);
  engines.delete(name);
}

export function registerLocale(name: string, xml: string): void {
  locales.set(name, xml);
  engines.clear();
}

function getEngine(style: SupportedStyle, item: CSLItem): any {
  const cached = engines.get(style);
  if (cached) {
    cached.sys.__currentItem = item;
    return cached;
  }
  const csl = styles.get(style);
  if (!csl) throw new Error(`Unknown style: ${style}`);
  const sys: any = {
    __currentItem: item as CSLItem,
    retrieveLocale: (lang: string) => locales.get(lang) || locales.get('en-US') || '',
    retrieveItem: (_id: string) => sys.__currentItem,
  };
  const engine = new CSL.Engine(sys, csl, 'en-US');
  engines.set(style, engine);
  return engine;
}

export function formatCitation(item: CSLItem, style: SupportedStyle): RichText[] {
  const engine = getEngine(style, item);
  engine.sys.__currentItem = item;
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
    .replace(/&#x2009;/g, ' ');
}
