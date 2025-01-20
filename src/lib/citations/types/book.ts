import type { Author, Citation, Date, PublicationDate, RichText, CitationVersion } from '../definitions';
import BaseCitation from './baseCitation';

/**
 * Create a book citation
 */
export default class BookCitation extends BaseCitation implements Citation {
    private isbn: string;
    private edition?: string;
    private city?: string;

    constructor({ 
        authors, 
        sourceTitle, 
        publisher, 
        publicationDate, 
        accessDate, 
        isbn,
        edition,
        city 
    }) {
        super({ authors, sourceTitle, publisher, publicationDate, accessDate });
        this.isbn = isbn;
        this.edition = edition;
        this.city = city;
    }

    public formatCitation(version: CitationVersion): RichText[] {
        switch(version.style) {
            case 'mla':
                return this._formatMLA(version.version);
            case 'apa':
                return this._formatAPA(version.version);
            case 'chicago':
                return this._formatChicago(version.version);
            case 'ama':
                return this._formatAMA(version.version);
            case 'harvard':
                return this._formatHarvard();
            case 'ieee':
                return this._formatIEEE();
            case 'vancouver':
                return this._formatVancouver();
            default:
                throw new Error(`Unsupported citation style: ${version.style}`);
        }
    }

    private _formatMLA(version: number): RichText[] {
        const authors = this.formatAuthors({ style: 'mla', version });
        const year = this.safelyFormatYear(this.publicationDate[0]);

        if (version >= 9 || version >= 8) {
            // MLA 8th and 9th editions
            return this.trimResult([
                this.createRichText(authors && `${authors}. `),
                this.createRichText(this.sourceTitle, true),
                this.createRichText(this.publisher && `. ${this.publisher}, `),
                this.createRichText(year),
                this.createRichText('.')
            ]);
        } else {
            // MLA 7th edition and earlier
            return this.trimResult([
                this.createRichText(authors && `${authors}. `),
                this.createRichText(this.sourceTitle, true),
                this.createRichText(this.city ? `. ${this.city}: ` : '. '),
                this.createRichText(this.publisher && `${this.publisher}, `),
                this.createRichText(year && `${year}. `),
                this.createRichText('Print.')
            ]);
        }
    }

    private _formatAPA(version: number): RichText[] {
        const authors = this.formatAuthors({ style: 'apa', version });
        const year = this.safelyFormatYear(this.publicationDate[0]);

        if (version >= 7) {
            // APA 7th edition
            return this.trimResult([
                this.createRichText(authors && `${authors} `),
                this.createRichText(year && `(${year}). `),
                this.createRichText(this.sourceTitle, true),
                this.createRichText(this.publisher && `. ${this.publisher}.`)
            ]);
        } else {
            // APA 6th edition
            const location = this.joinWithSeparator([this.city, this.publisher], ', ');
            return this.trimResult([
                this.createRichText(authors && `${authors} `),
                this.createRichText(year && `(${year}). `),
                this.createRichText(this.sourceTitle, true),
                this.createRichText(location && `. ${location}.`)
            ]);
        }
    }

    private _formatChicago(version: number): RichText[] {
        const authors = this.formatAuthors({ style: 'chicago', version });
        const year = this.safelyFormatYear(this.publicationDate[0]);
        const publisherInfo = this.concat(
            this.city && `. ${this.city}: `,
            this.publisher && `${this.publisher}.`
        );

        if (version >= 17) {
            // Chicago 17th edition
            return this.trimResult([
                this.createRichText(authors && `${authors}. `),
                this.createRichText(year && `${year}. `),
                this.createRichText(this.sourceTitle, true),
                this.createRichText(publisherInfo)
            ]);
        } else {
            // Chicago 16th edition
            return this.trimResult([
                this.createRichText(authors && `${authors}. `),
                this.createRichText(year && `${year}. `),
                this.createRichText(this.sourceTitle, true),
                this.createRichText(publisherInfo)
            ]);
        }
    }

    private _formatAMA(version: number): RichText[] {
        const authors = this.formatAuthors({ style: 'ama', version });
        const year = this.safelyFormatYear(this.publicationDate[0]);

        if (version >= 11) {
            // AMA 11th edition
            return this.trimResult([
                this.createRichText(authors && `${authors}. `),
                this.createRichText(this.sourceTitle, true),
                this.createRichText(this.concat(
                    this.publisher && `. ${this.publisher}`,
                    year && `; ${year}.`
                ))
            ]);
        } else {
            // AMA 10th edition
            return this.trimResult([
                this.createRichText(authors && `${authors}. `),
                this.createRichText(this.sourceTitle, true),
                this.createRichText(this.concat(
                    this.publisher && `. ${this.publisher}`,
                    year && `; ${year}.`
                ))
            ]);
        }
    }

    private _formatHarvard(): RichText[] {
        const authors = this.formatAuthors({ style: 'harvard', version: 1 });
        const year = this.safelyFormatYear(this.publicationDate[0]);
        const publisherInfo = this.concat(
            this.city && `. ${this.city}: `,
            this.publisher && `${this.publisher}.`
        );
        
        return this.trimResult([
            this.createRichText(authors && `${authors} `),
            this.createRichText(year && `(${year}). `),
            this.createRichText(this.sourceTitle, true),
            this.createRichText(publisherInfo)
        ]);
    }

    private _formatIEEE(): RichText[] {
        const authors = this.formatAuthors({ style: 'ieee', version: 1 });
        const year = this.safelyFormatYear(this.publicationDate[0]);
        const editionText = this.edition ? `, ${this.edition} ed.` : '';
        const publisherInfo = this.concat(
            editionText,
            '. ',
            this.city && `${this.city}: `,
            this.publisher,
            year && `, ${year}.`
        );
        
        return this.trimResult([
            this.createRichText(authors && `${authors}, `),
            this.createRichText(this.sourceTitle, true),
            this.createRichText(publisherInfo)
        ]);
    }

    private _formatVancouver(): RichText[] {
        const authors = this.formatAuthors({ style: 'vancouver', version: 1 });
        const year = this.safelyFormatYear(this.publicationDate[0]);
        const editionText = this.edition ? ` ${this.edition} ed.` : '';
        const publisherInfo = this.concat(
            editionText,
            '. ',
            this.city && `${this.city}: `,
            this.publisher,
            year && `; ${year}.`
        );
        
        return this.trimResult([
            this.createRichText(authors && `${authors}. `),
            this.createRichText(this.sourceTitle, true),
            this.createRichText(publisherInfo)
        ]);
    }
}