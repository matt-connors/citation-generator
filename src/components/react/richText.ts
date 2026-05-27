import type { RichText } from '../../lib/citations/csl-types';

export function escapeHtml(s: string): string {
    return s.replace(/[&<>"']/g, (c) =>
        c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : '&#39;');
}

export function richTextToHtml(rt: RichText[]): string {
    return rt.map((seg) => seg.italic ? `<i>${escapeHtml(seg.text)}</i>` : escapeHtml(seg.text)).join('');
}
