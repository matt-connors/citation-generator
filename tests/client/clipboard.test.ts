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
    // Restore globals mutated by individual tests.
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

describe('copyRichText (async Clipboard API)', () => {
    it('writes both text/html (with italics + styled wrapper) and text/plain, and returns true', async () => {
        let captured: any;
        const writeMock = vi.fn().mockResolvedValue(undefined);
        Object.defineProperty(navigator, 'clipboard', {
            value: { write: writeMock },
            configurable: true,
        });
        (globalThis as any).ClipboardItem = class {
            data: Record<string, Blob>;
            constructor(data: Record<string, Blob>) {
                this.data = data;
                captured = data;
            }
        };

        const ok = await copyRichText(richTextToHtml(RT), richTextToPlain(RT));

        expect(ok).toBe(true);
        expect(writeMock).toHaveBeenCalledTimes(1);
        const html = await captured['text/html'].text();
        const plain = await captured['text/plain'].text();
        // Rich text preserved: italic title + the inline wrapper styling.
        expect(html).toContain('<i>My Title</i>');
        expect(html).toContain('Times New Roman');
        // Plain flavor is text-only.
        expect(plain).toBe('Doe, Jane. My Title. Publisher, 2024.');
        expect(plain).not.toContain('<i>');
    });
});

describe('copyRichText (legacy fallback)', () => {
    it('falls back to execCommand when the async API is unavailable', async () => {
        // No navigator.clipboard / ClipboardItem available.
        delete (navigator as any).clipboard;
        delete (globalThis as any).ClipboardItem;
        // jsdom does not implement execCommand; define it so the legacy path runs.
        const exec = vi.fn().mockReturnValue(true);
        (document as any).execCommand = exec;

        const ok = await copyRichText(richTextToHtml(RT), richTextToPlain(RT));

        expect(ok).toBe(true);
        expect(exec).toHaveBeenCalledWith('copy');
    });

    it('falls back to execCommand when the async write rejects', async () => {
        Object.defineProperty(navigator, 'clipboard', {
            value: { write: vi.fn().mockRejectedValue(new Error('denied')) },
            configurable: true,
        });
        (globalThis as any).ClipboardItem = class {
            constructor(_data: Record<string, Blob>) {}
        };
        const exec = vi.fn().mockReturnValue(true);
        (document as any).execCommand = exec;

        const ok = await copyRichText(richTextToHtml(RT), richTextToPlain(RT));

        expect(ok).toBe(true);
        expect(exec).toHaveBeenCalledWith('copy');
    });
});
