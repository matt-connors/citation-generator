// Copy a citation to the clipboard preserving rich text — italics AND the
// Times-New-Roman / 12pt / double-line-height styling that word processors keep
// on paste.
//
// IMPORTANT: the selection + execCommand('copy') path is the PRIMARY method. It
// copies a *rendered, styled* DOM selection, so the browser serializes the
// computed formatting onto the clipboard exactly the way Word / Google Docs
// expect — this is the behavior that has always worked. A hand-built
// `ClipboardItem` HTML fragment (the async Clipboard API) does NOT reliably
// preserve that formatting across paste targets, so it is only a fallback for
// the rare case where execCommand is unavailable or refused.

const COPY_STYLE =
    'font-family:"Times New Roman",Times,serif;font-size:12pt;line-height:2;';

// Primary path: drop the HTML into an offscreen styled element, select it, and
// run execCommand('copy'). The selection carries the element's styling onto the
// clipboard, which is what preserves font/size/line-height/italics on paste.
function copyViaSelection(html: string): boolean {
    if (typeof document === 'undefined') return false;
    const div = document.createElement('div');
    div.style.cssText = `position:fixed;left:-9999px;${COPY_STYLE}`;
    div.innerHTML = html;
    document.body.appendChild(div);

    let ok = false;
    try {
        const range = document.createRange();
        range.selectNodeContents(div);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
        ok = document.execCommand('copy');
        sel?.removeAllRanges();
    } catch {
        ok = false;
    }

    document.body.removeChild(div);
    return ok;
}

// Fallback only: the async Clipboard API. Writes both flavors, but a bare
// fragment loses much of the formatting on paste — used only if the selection
// copy fails (e.g. execCommand disabled by policy).
async function copyViaAsyncApi(html: string, plain: string): Promise<boolean> {
    const canUseAsync =
        typeof navigator !== 'undefined' &&
        !!navigator.clipboard &&
        typeof navigator.clipboard.write === 'function' &&
        typeof ClipboardItem !== 'undefined';
    if (!canUseAsync) return false;
    try {
        const styledHtml = `<div style="${COPY_STYLE}">${html}</div>`;
        const item = new ClipboardItem({
            'text/html': new Blob([styledHtml], { type: 'text/html' }),
            'text/plain': new Blob([plain], { type: 'text/plain' }),
        });
        await navigator.clipboard.write([item]);
        return true;
    } catch {
        return false;
    }
}

/**
 * Copy rich text to the clipboard. `html` is the formatted markup (with `<i>`
 * for titles); `plain` is the text-only fallback flavor. Returns true on
 * success. Uses the selection + execCommand copy first (preserves formatting),
 * falling back to the async Clipboard API only if that fails.
 */
export async function copyRichText(html: string, plain: string): Promise<boolean> {
    if (copyViaSelection(html)) return true;
    return copyViaAsyncApi(html, plain);
}
