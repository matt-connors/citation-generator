// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { copyRichText } from '../../src/components/react/clipboard';
import { richTextToHtml, richTextToPlain } from '../../src/components/react/richText';

const RT = [
    { text: 'Doe, Jane. ' },
    { text: 'My Title', italic: true },
    { text: '. Publisher, 2024.' },
];

const clipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, 'clipboard');

afterEach(() => {
    if (clipboardDescriptor) {
        Object.defineProperty(navigator, 'clipboard', clipboardDescriptor);
    } else {
        delete (navigator as any).clipboard;
    }
    delete (globalThis as any).ClipboardItem;
    delete (document as any).execCommand;
    vi.restoreAllMocks();
});

describe('richTextToPlain', () => {
    it('joins segment text and drops italic formatting', () => {
        expect(richTextToPlain(RT)).toBe('Doe, Jane. My Title. Publisher, 2024.');
    });
});

describe('copyRichText — primary: selection + execCommand (preserves formatting)', () => {
    it('copies a styled offscreen element (font + italics) via execCommand and does NOT use the async API', async () => {
        let styleAtCopy = '';
        let htmlAtCopy = '';
        (document as any).execCommand = vi.fn((cmd: string) => {
            if (cmd === 'copy') {
                const el = document.querySelector('div[style*="-9999px"]') as HTMLElement | null;
                styleAtCopy = el?.getAttribute('style') ?? '';
                htmlAtCopy = el?.innerHTML ?? '';
            }
            return true;
        });
        // Async API is available, but must NOT be used when the selection copy works.
        const write = vi.fn();
        Object.defineProperty(navigator, 'clipboard', { value: { write }, configurable: true });
        (globalThis as any).ClipboardItem = class {
            constructor(_data: unknown) {}
        };

        const ok = await copyRichText(richTextToHtml(RT), richTextToPlain(RT));

        expect(ok).toBe(true);
        expect(document.execCommand).toHaveBeenCalledWith('copy');
        expect(write).not.toHaveBeenCalled();
        // The copied element carried the Times New Roman styling and the italic title.
        expect(styleAtCopy).toContain('Times New Roman');
        expect(htmlAtCopy).toContain('<i>My Title</i>');
        // Offscreen element cleaned up afterward.
        expect(document.querySelectorAll('div[style*="-9999px"]').length).toBe(0);
    });
});

describe('copyRichText — fallback: async Clipboard API', () => {
    it('falls back to navigator.clipboard.write (both flavors) when execCommand fails', async () => {
        (document as any).execCommand = vi.fn().mockReturnValue(false);
        let captured: Record<string, Blob> | undefined;
        const write = vi.fn().mockResolvedValue(undefined);
        Object.defineProperty(navigator, 'clipboard', { value: { write }, configurable: true });
        (globalThis as any).ClipboardItem = class {
            data: Record<string, Blob>;
            constructor(data: Record<string, Blob>) {
                this.data = data;
                captured = data;
            }
        };

        const ok = await copyRichText(richTextToHtml(RT), richTextToPlain(RT));

        expect(ok).toBe(true);
        expect(write).toHaveBeenCalledTimes(1);
        const html = await captured!['text/html'].text();
        const plain = await captured!['text/plain'].text();
        expect(html).toContain('<i>My Title</i>');
        expect(html).toContain('Times New Roman');
        expect(plain).toBe('Doe, Jane. My Title. Publisher, 2024.');
    });

    it('returns false when execCommand fails and no async API is available', async () => {
        (document as any).execCommand = vi.fn().mockReturnValue(false);
        delete (navigator as any).clipboard;
        delete (globalThis as any).ClipboardItem;

        const ok = await copyRichText(richTextToHtml(RT), richTextToPlain(RT));

        expect(ok).toBe(false);
    });
});
