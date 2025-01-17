import type { Source, RichText, Citation, CitationVersion } from './definitions';

import WebsiteCitation from './types/website';
import BookCitation from './types/book';

// Yeah, ik I should just update the dropdown to have the CitationVersion object as a value
function stringToVersionStyle(format: string): CitationVersion {
    switch (format) {

        case 'mla-9th-edition':
            return { style: 'mla', version: 9 }
        case 'mla-8th-edition':
            return { style: 'mla', version: 8 }
        case 'mla-7th-edition':
            return { style: 'mla', version: 7 }
        case 'mla-6th-edition':
            return { style: 'mla', version: 6 }

        case 'apa-7th-edition':
            return { style: 'apa', version: 7 }
        case 'apa-6th-edition':
            return { style: 'apa', version: 6 }

        case 'chicago-17th-edition':
            return { style: 'chicago', version: 17 }
        case 'chicago-16th-edition':
            return { style: 'chicago', version: 17 }

        case 'ama-11th-edition':
            return { style: 'ama', version: 11 }
        case 'ama-10th-edition':
            return { style: 'ama', version: 10 }

        case 'harvard':
            return { style: 'harvard', version: NaN }
        case 'ieee':
            return { style: 'ieee', version: NaN }
        case 'vancouver':
            return { style: 'vancouver', version: NaN }

        default:
            throw new Error('Invalid format');
    }
}

function getRichText(source: Source, format: string): RichText[] {

    const { version, style } = stringToVersionStyle(format);

    switch (source.citationType) {
        case 'website':
            const websiteCitation = new WebsiteCitation(source.citationInfo);
            return websiteCitation.formatCitation({
                version,
                style
            });

        case 'book':
            const bookCitation = new BookCitation(source.citationInfo as any);
            return bookCitation.formatCitation({
                version,
                style
            });

        default:
            throw new Error('Invalid citation type');
    }
}

/**
 * 
 */
export default function formatSource(source: Source, format: string): string {
    // const
    const richText = getRichText(source, format);
    return richText
        .map(({ text, italic }) => italic ? `<i>${text}</i>` : text)
        .join('')
}