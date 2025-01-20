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
        const pageTitle = this.sourceTitle?.trim() || '';
        const websiteTitle = this.publisher?.trim() || '';
        const publicationDate = this.safelyFormatDate(this.publicationDate[0]);
        const accessDate = this.formatAccessDate();

        if (version >= 9) {
            // MLA 9th edition (2021-Present)
            // Author Last Name, First Name. "Title of Webpage." Title of Website, Publisher/Sponsor, Publication Date, URL. Accessed Date.
            return this.trimResult([
                this.createRichText(authors && `${authors}. `),
                this.createRichText(`"${pageTitle}." `),
                this.createRichText(websiteTitle, true),
                this.createRichText(publicationDate && `, ${publicationDate}, `),
                this.createRichText(this.url),
                this.createRichText(accessDate && `. Accessed ${accessDate}`),
                this.createRichText('.')
            ]);
        } else if (version >= 8) {
            // MLA 8th edition (2016-2021)
            // Author Last Name, First Name. "Title of Webpage." Title of Website, Publisher/Sponsor, Publication Date, URL.
            return this.trimResult([
                this.createRichText(authors && `${authors}. `),
                this.createRichText(`"${pageTitle}." `),
                this.createRichText(websiteTitle, true),
                this.createRichText(publicationDate && `, ${publicationDate}, `),
                this.createRichText(this.url),
                this.createRichText('.')
            ]);
        } else if (version >= 7) {
            // MLA 7th edition (2009-2016)
            // Author Last Name, First Name. "Title of Webpage." Title of Website. Publisher/Sponsor, Publication Date. Web. Date of Access.
            return this.trimResult([
                this.createRichText(authors && `${authors}. `),
                this.createRichText(`"${pageTitle}." `),
                this.createRichText(websiteTitle, true),
                this.createRichText(`. `),
                this.createRichText(publicationDate && `${publicationDate}. `),
                this.createRichText('Web. '),
                this.createRichText(accessDate && `${accessDate}`),
                this.createRichText('.')
            ]);
        } else {
            // MLA 6th edition (2003-2009)
            // Author Last Name, First Name. "Title of Webpage." Title of Website. Publisher/Sponsor, Publication Date. Date of Access <URL>.
            return this.trimResult([
                this.createRichText(authors && `${authors}. `),
                this.createRichText(`"${pageTitle}." `),
                this.createRichText(websiteTitle, true),
                this.createRichText(`. `),
                this.createRichText(publicationDate && `${publicationDate}. `),
                this.createRichText(accessDate && `${accessDate} `),
                this.createRichText(`<${this.url}>`),
                this.createRichText('.')
            ]);
        }
    }

    private _formatAPA(version: number): RichText[] {
        const authors = this.formatAuthors({ style: 'apa', version });
        const formattedDate = this.publicationDate[0]?.date ? 
            `(${this.formatDateYMD(this.publicationDate[0].date)})` : '(n.d.)';
        const accessDate = this.formatDateMDY(this.accessDate);

        if (version >= 7) {
            // APA 7th edition (2020-Present)
            // Structure: Author. (Date). Title. Site Name. URL
            // Example: Google. (n.d.). Google. Retrieved January 20, 2025, from https://google.com
            return this.trimResult([
                this.createRichText(authors ? `${authors}. ` : this.sourceTitle ? `${this.sourceTitle}. ` : ''),
                this.createRichText(formattedDate && `${formattedDate}. `),
                this.createRichText(authors ? `${this.sourceTitle}. ` : ''),
                this.createRichText(this.publisher && `${this.publisher}. `),
                this.createRichText(accessDate && `Retrieved ${accessDate}, from `),
                this.createRichText(this.url && `https://${this.url.replace(/^https?:\/\//, '')}`)
            ]);
        } else {
            // APA 6th edition (2009-2020)
            // Structure: Author. (Date). Title. Retrieved from Site Name: URL
            return this.trimResult([
                this.createRichText(authors ? `${authors}. ` : this.sourceTitle ? `${this.sourceTitle}. ` : ''),
                this.createRichText(formattedDate && `${formattedDate}. `),
                this.createRichText(authors ? `${this.sourceTitle}. ` : ''),
                this.createRichText(`Retrieved from ${this.publisher}${this.publisher ? ': ' : ''}`),
                this.createRichText(this.url && `https://${this.url.replace(/^https?:\/\//, '')}`)
            ]);
        }
    }

    private _formatChicago(version: number): RichText[] {
        const authors = this.formatAuthors({ style: 'chicago', version });
        const publicationDate = this.safelyFormatDate(this.publicationDate[0]);
        const accessDate = this.formatAccessDate();

        // Chicago 17th and 16th editions are virtually identical for websites
        // Bibliography format:
        // Author Last Name, First Name. "Title of Webpage." Website Name. Month Day, Year. URL.
        return this.trimResult([
            this.createRichText(authors && `${authors}. `),
            this.createRichText(`"${this.sourceTitle}." `),
            this.createRichText(this.publisher, true),
            this.createRichText(publicationDate && `. ${publicationDate}. `),
            this.createRichText(this.url),
            this.createRichText('.')
        ]);
    }

    private _formatAMA(version: number): RichText[] {
        const authors = this.formatAuthors({ style: 'ama', version });
        const publicationDate = this.safelyFormatDateMDY(this.publicationDate[0]);
        const accessDate = this.formatDateMDY(this.accessDate);

        // AMA 11th and 10th editions
        // Author Last Name First Initial. Title of webpage. Website Name. Published Month Day, Year. Accessed Month Day, Year. URL
        return this.trimResult([
            this.createRichText(authors && `${authors}. `),
            this.createRichText(this.sourceTitle && `${this.sourceTitle}. `),
            this.createRichText(this.publisher, true),
            this.createRichText(publicationDate && `. Published ${publicationDate}. `),
            this.createRichText(accessDate && `Accessed ${accessDate}. `),
            this.createRichText(this.url),
            this.createRichText('.')
        ]);
    }

    private _formatHarvard(): RichText[] {
        const authors = this.formatAuthors({ style: 'harvard', version: 1 });
        const year = this.safelyFormatYear(this.publicationDate[0]);
        const accessDate = this.formatAccessDate();

        // Author Last Name, First Initial. (Year) Title of webpage. [online] Website Name. Available at: URL [Accessed Date]
        return this.trimResult([
            this.createRichText(authors && `${authors} `),
            this.createRichText(year && `(${year}) `),
            this.createRichText(this.sourceTitle, true),
            this.createRichText('. [online] '),
            this.createRichText(this.publisher),
            this.createRichText('. Available at: '),
            this.createRichText(this.url),
            this.createRichText(accessDate && ` [Accessed ${accessDate}]`),
            this.createRichText('.')
        ]);
    }

    private _formatIEEE(): RichText[] {
        const authors = this.formatAuthors({ style: 'ieee', version: 1 });
        const accessDate = this.formatAccessDate();

        // [Number] Author First Initial. Last Name, "Title of Webpage," Website Name, URL (accessed Month Day, Year)
        return this.trimResult([
            this.createRichText(authors && `${authors}, `),
            this.createRichText(`"${this.sourceTitle}," `),
            this.createRichText(this.publisher, true),
            this.createRichText(`, ${this.url} `),
            this.createRichText(accessDate && `(accessed ${accessDate})`),
            this.createRichText('.')
        ]);
    }

    private _formatVancouver(): RichText[] {
        const authors = this.formatAuthors({ style: 'vancouver', version: 1 });
        const publicationDate = this.safelyFormatDate(this.publicationDate[0]);
        const accessDate = this.formatAccessDate();

        // Author Last Name First Initial. Title of Webpage. Website Name [Internet]. Year [cited Year Month Day]. Available from: URL
        return this.trimResult([
            this.createRichText(authors && `${authors}. `),
            this.createRichText(this.sourceTitle && `${this.sourceTitle}. `),
            this.createRichText(this.publisher),
            this.createRichText(' [Internet]. '),
            this.createRichText(publicationDate && `${publicationDate} `),
            this.createRichText(accessDate && `[cited ${accessDate}]. `),
            this.createRichText('Available from: '),
            this.createRichText(this.url),
            this.createRichText('.')
        ]);
    }
}