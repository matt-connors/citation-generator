// Copy a citation to the clipboard preserving rich text (italics, the
// Times-New-Roman / double-line-height styling that word processors honor on
// paste). Uses the async Clipboard API with both `text/html` and `text/plain`
// flavors, and falls back to the legacy execCommand selection method when the
// async API or ClipboardItem is unavailable or rejects (e.g. permission denied,
// document not focused, older browsers).

const COPY_STYLE =
    'font-family:"Times New Roman",Times,serif;font-size:12pt;line-height:2;';

// Legacy path: drop the HTML into an offscreen styled element, select it, and
// run execCommand('copy'). This is what the app did before the async rewrite;
// it carries the wrapper's inline styles onto the clipboard.
function legacyCopyHtml(html: string): boolean {
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

/**
 * Copy rich text to the clipboard. `html` is the formatted markup (with `<i>`
 * for titles, etc.); `plain` is the text-only fallback flavor.
 * Returns true on success.
 */
export async function copyRichText(html: string, plain: string): Promise<boolean> {
    const canUseAsync =
        typeof navigator !== 'undefined' &&
        !!navigator.clipboard &&
        typeof navigator.clipboard.write === 'function' &&
        typeof ClipboardItem !== 'undefined';

    if (canUseAsync) {
        try {
            // Inline the formatting on a wrapper so pasted output keeps the
            // citation's font/spacing the way the legacy selection copy did.
            const styledHtml = `<div style="${COPY_STYLE}">${html}</div>`;
            const item = new ClipboardItem({
                'text/html': new Blob([styledHtml], { type: 'text/html' }),
                'text/plain': new Blob([plain], { type: 'text/plain' }),
            });
            await navigator.clipboard.write([item]);
            return true;
        } catch {
            // Fall through to the legacy path.
        }
    }

    return legacyCopyHtml(html);
}
