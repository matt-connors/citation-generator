import type { Source, RichText, Citation } from './definitions';

import WebsiteCitation from './types/website';
import BookCitation from './types/book';

function getFormattedRichText(citation: Citation, format: string): RichText[] {
    switch (format) {
        case 'mla':
            return citation.toMlaFormat();
        case 'apa':
            return citation.toApaFormat();
        case 'chicago':
            return citation.toChicagoFormat();
        case 'harvard':
            return citation.toHarvardFormat();
        default:
            throw new Error('Invalid format');
    }
}

function getRichText(source: Source, format: string): RichText[] {
    switch (source.citationType) {
        case 'website':
            const websiteCitation = new WebsiteCitation(source.citationInfo);
            return getFormattedRichText(websiteCitation, format);
        case 'book':
            const bookCitation = new BookCitation(source.citationInfo);
            return getFormattedRichText(bookCitation, format);
        default:
            throw new Error('Invalid citation type');
    }
}

/**
 * 
 */
export default function formatSource(source: Source, format: string): string {
    const richText = getRichText(source, format);
    return richText
        .map(({ text, italic }) => italic ? `<i>${text}</i>` : text)
        .join('')
}