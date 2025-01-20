import type { Author, Citation, Date, PublicationDate, RichText, CitationVersion } from '../definitions';
import BaseCitation from './baseCitation';

/**
 * Create a website citation
 */
export default class WebsiteCitation extends BaseCitation implements Citation {
    private url: string;

    constructor({ authors, sourceTitle, publisher, publicationDate, accessDate, url }) {
        super({ authors, sourceTitle, publisher, publicationDate, accessDate });
        this.url = url;
    }

    public formatCitation(version: CitationVersion): RichText[] {
        switch (version.style) {
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
        const pageTitle = this.sourceTitle?.split('|')[0]?.trim() || '';
        const websiteTitle = this.publisher?.trim() || '';
        const publicationDate = this.safelyFormatDate(this.publicationDate[0]);

        if (version >= 9) {
            // MLA 9th edition
            return this.trimResult([
                this.createRichText(authors && `${authors}. `),
                this.createRichText(this.wrapInQuotes(pageTitle), true),
                this.createRichText('. '),
                this.createRichText(websiteTitle, true),
                this.createRichText(publicationDate && `, ${publicationDate}, `),
                this.createRichText(this.url),
                this.createRichText('.')
            ]);
        } else if (version >= 8) {
            // MLA 8th edition
            return this.trimResult([
                this.createRichText(authors && `${authors}. `),
                this.createRichText(this.wrapInQuotes(pageTitle)),
                this.createRichText(websiteTitle, true),
                this.createRichText(publicationDate && `, ${publicationDate}, `),
                this.createRichText(this.url),
                this.createRichText('.')
            ]);
        } else {
            // MLA 7th edition and earlier
            const accessDate = this.formatAccessDate();
            return this.trimResult([
                this.createRichText(authors && `${authors}. `),
                this.createRichText(this.wrapInQuotes(pageTitle)),
                this.createRichText(websiteTitle, true),
                this.createRichText(this.publisher && `. ${this.publisher}. `),
                this.createRichText(publicationDate && `${publicationDate}. Web. `),
                this.createRichText(accessDate && `${accessDate}.`)
            ]);
        }
    }

    private _formatAPA(version: number): RichText[] {
        const authors = this.formatAuthors({ style: 'apa', version });
        const formattedDate = this.publicationDate[0]?.date ? 
            `(${this.formatDateYMD(this.publicationDate[0].date)})` : '';

        if (version >= 7) {
            // APA 7th edition
            return this.trimResult([
                this.createRichText(authors && `${authors}. `),
                this.createRichText(formattedDate && `${formattedDate}. `),
                this.createRichText(this.sourceTitle && `${this.sourceTitle}. `),
                this.createRichText(this.publisher, true),
                this.createRichText(this.url && `. ${this.url}`)
            ]);
        } else {
            // APA 6th edition
            return this.trimResult([
                this.createRichText(authors && `${authors}. `),
                this.createRichText(formattedDate && `${formattedDate}. `),
                this.createRichText(this.sourceTitle && `${this.sourceTitle}. `),
                this.createRichText(this.url && `Retrieved from ${this.url}`)
            ]);
        }
    }

    private _formatChicago(version: number): RichText[] {
        const authors = this.formatAuthors({ style: 'chicago', version });
        const publicationDate = this.safelyFormatDate(this.publicationDate[0]);
        const accessDate = this.formatAccessDate();

        if (version >= 17) {
            // Chicago 17th edition
            return this.trimResult([
                this.createRichText(authors && `${authors}. `),
                this.createRichText(this.wrapInQuotes(this.sourceTitle)),
                this.createRichText(this.publisher, true),
                this.createRichText(publicationDate && `. ${publicationDate}. `),
                this.createRichText(this.url),
                this.createRichText('.')
            ]);
        } else {
            // Chicago 16th edition
            return this.trimResult([
                this.createRichText(authors && `${authors}. `),
                this.createRichText(this.wrapInQuotes(this.sourceTitle)),
                this.createRichText(this.publisher, true),
                this.createRichText(publicationDate && `. Last modified ${publicationDate}. `),
                this.createRichText(accessDate && `Accessed ${accessDate}. `),
                this.createRichText(this.url),
                this.createRichText('.')
            ]);
        }
    }

    private _formatAMA(version: number): RichText[] {
        const authors = this.formatAuthors({ style: 'ama', version });
        const publicationDate = this.safelyFormatDateMDY(this.publicationDate[0]);
        const accessDate = this.formatDateMDY(this.accessDate);

        if (version >= 11) {
            // AMA 11th edition
            return this.trimResult([
                this.createRichText(authors && `${authors}. `),
                this.createRichText(this.sourceTitle && `${this.sourceTitle}. `),
                this.createRichText(this.publisher, true),
                this.createRichText(publicationDate && `. Published ${publicationDate}. `),
                this.createRichText(accessDate && `Accessed ${accessDate}. `),
                this.createRichText(this.url),
                this.createRichText('.')
            ]);
        } else {
            // AMA 10th edition
            return this.trimResult([
                this.createRichText(authors && `${authors}. `),
                this.createRichText(this.sourceTitle && `${this.sourceTitle}. `),
                this.createRichText(this.publisher, true),
                this.createRichText(publicationDate && `. ${publicationDate}. `),
                this.createRichText(this.url && `Available at: ${this.url}. `),
                this.createRichText(accessDate && `Accessed ${accessDate}.`)
            ]);
        }
    }

    private _formatHarvard(): RichText[] {
        const authors = this.formatAuthors({ style: 'harvard', version: 1 });
        const year = this.safelyFormatYear(this.publicationDate[0]);
        const accessDate = this.formatAccessDate();

        return this.trimResult([
            this.createRichText(authors && `${authors} `),
            this.createRichText(year && `(${year}). `),
            this.createRichText(this.wrapInQuotes(this.sourceTitle)),
            this.createRichText(`[Online]. Available at: ${this.url} `),
            this.createRichText(accessDate && `[Accessed ${accessDate}].`)
        ]);
    }

    private _formatIEEE(): RichText[] {
        const authors = this.formatAuthors({ style: 'ieee', version: 1 });
        const accessDate = this.formatAccessDate();

        return this.trimResult([
            this.createRichText(authors && `${authors}, `),
            this.createRichText(this.wrapInQuotes(this.sourceTitle)),
            this.createRichText(this.publisher, true),
            this.createRichText(`. [Online]. Available: ${this.url}. `),
            this.createRichText(accessDate && `[Accessed: ${accessDate}].`)
        ]);
    }

    private _formatVancouver(): RichText[] {
        const authors = this.formatAuthors({ style: 'vancouver', version: 1 });
        const publicationDate = this.safelyFormatDate(this.publicationDate[0]);
        const accessDate = this.formatAccessDate();

        return this.trimResult([
            this.createRichText(authors && `${authors}. `),
            this.createRichText(this.sourceTitle && `${this.sourceTitle} [Internet]. `),
            this.createRichText(this.publisher && `${this.publisher}; `),
            this.createRichText(publicationDate && `${publicationDate} `),
            this.createRichText(accessDate && `[cited ${accessDate}]. `),
            this.createRichText(this.url && `Available from: ${this.url}`)
        ]);
    }
}