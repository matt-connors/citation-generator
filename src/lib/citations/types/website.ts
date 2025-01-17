import type { Author, Citation, Date, PublicationDate, RichText, CitationVersion } from '../definitions';

/**
 * Create a website citation
 */
export default class WebsiteCitation implements Citation {
    public authors: Author[];
    public sourceTitle: string;
    public publisher: string;
    public publicationDate: PublicationDate[];
    public accessDate: Date;
    public url: string;

    constructor({ authors, sourceTitle, publisher, publicationDate, accessDate, url }) {
        this.authors = authors;
        this.sourceTitle = sourceTitle;
        this.publisher = publisher;
        this.publicationDate = publicationDate;
        this.accessDate = accessDate;
        this.url = url;
    }

    /**
     * Format the date as "Day Month Year"
     */
    private _formatDate(date: Date): string {
        const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        return `${date.day} ${months[date.month - 1]} ${date.year}`;
    }

    /**
     * Format the date as "Year"
     */
    private _formatYear(date: Date): string {
        return `${date.year}`;
    }

    /**
     * Format date as Month Day, Year
     */
    private _formatDateMDY(date: Date): string {
        const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        return `${months[date.month - 1]} ${date.day}, ${date.year}`;
    }

    /**
     * Format date as Year, Month Day
     */
    private _formatDateYMD(date: Date): string {
        const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        return `${date.year}, ${months[date.month - 1]} ${date.day}`;
    }

    private _safelyFormatDate(publicationDate: PublicationDate): string {
        if (publicationDate?.date) {
            return this._formatDate(publicationDate.date);
        }
        return '';
    }

    private _safelyFormatYear(publicationDate: PublicationDate): string {
        if (publicationDate?.date) {
            return this._formatYear(publicationDate.date);
        }
        return '';
    }

    private _safelyFormatDateMDY(publicationDate: PublicationDate): string {
        if (publicationDate?.date) {
            return this._formatDateMDY(publicationDate.date);
        }
        return '';
    }

    private _formatAccessDate(): string {
        return this.accessDate ? this._formatDate(this.accessDate) : '';
    }

    private _formatAuthors(format: CitationVersion): string {
        return this.authors.map(author => {
            if (author.type === "person") {
                switch (format.style) {
                    case 'mla':
                        return `${author.lastName}, ${author.firstName}`;
                    case 'apa':
                        if (format.version >= 7) {
                            return `${author.lastName}, ${author.firstName?.charAt(0)}. ${author.firstName?.split(' ').slice(1).map(n => n.charAt(0) + '.').join(' ')}`;
                        }
                        return `${author.lastName}, ${author.firstName?.split(' ').map(n => n.charAt(0) + '.').join('. ')}`;
                    case 'chicago':
                        return `${author.lastName}, ${author.firstName}`;
                    case 'harvard':
                        return `${author.lastName}, ${author.firstName?.split(' ').map(n => n.charAt(0) + '.').join('')}`;
                    case 'ama':
                        if (format.version >= 11) {
                            return `${author.lastName} ${author.firstName?.split(' ').map(n => n.charAt(0)).join('')}`;
                        }
                        return `${author.lastName} ${author.firstName?.charAt(0)}`;
                    default:
                        return `${author.lastName}, ${author.firstName?.split(' ').map(n => n.charAt(0) + '.').join(' ')}`;
                }
            }
            return author.name || '';
        }).join(format.style === 'mla' ? ', and ' : ', ');
    }

    private _trimResult(result: RichText[]): RichText[] {
        return result.filter((item, i, arr) =>
            item.text !== '' &&
            item.text !== ', ' &&
            item.text !== '. ' &&
            !(arr[i]?.text === '"' && arr[i + 2]?.text === '." ' && arr[i + 1].text === '') &&
            !(arr[i]?.text === '." ' && arr[i - 2]?.text === '"' && arr[i - 1].text === '') &&
            item.text !== '(). '
        );
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
        const authors = this._formatAuthors({ style: 'mla', version });
        const pageTitle = this.sourceTitle?.split('|')[0] || '';
        const websiteTitle = this.publisher || '';
        const publicationDate = this._safelyFormatDate(this.publicationDate[0]);

        if (version >= 9) {
            // MLA 9th edition
            return this._trimResult([
                { text: `${authors}. ` },
                { text: `"` },
                { text: pageTitle, italic: true },
                { text: `." ` },
                { text: websiteTitle, italic: true },
                { text: `, ${publicationDate}, ` },
                { text: this.url },
                { text: '.' }
            ]);
        } else if (version >= 8) {
            // MLA 8th edition
            return this._trimResult([
                { text: `${authors}. ` },
                { text: `"${pageTitle}." ` },
                { text: websiteTitle, italic: true },
                { text: `, ${publicationDate}, ` },
                { text: this.url },
                { text: '.' }
            ]);
        } else {
            // MLA 7th edition and earlier
            const accessDate = this._formatAccessDate();
            return this._trimResult([
                { text: `${authors}. ` },
                { text: `"${pageTitle}." ` },
                { text: websiteTitle, italic: true },
                { text: `. ${this.publisher}. ` },
                { text: `${publicationDate}. Web. ` },
                { text: `${accessDate}.` }
            ]);
        }
    }

    private _formatAPA(version: number): RichText[] {
        const authors = this._formatAuthors({ style: 'apa', version });
        const date = this.publicationDate[0]?.date;
        const formattedDate = date ? `${this._formatDateYMD(date)}` : '';

        if (version >= 7) {
            // APA 7th edition
            return this._trimResult([
                { text: `${authors}. ` },
                { text: `(${formattedDate}). ` },
                { text: `${this.sourceTitle}. ` },
                { text: this.publisher, italic: true },
                { text: `. ${this.url}` }
            ]);
        } else {
            // APA 6th edition
            return this._trimResult([
                { text: `${authors}. ` },
                { text: `(${formattedDate}). ` },
                { text: `${this.sourceTitle}. ` },
                { text: `Retrieved from ${this.url}` }
            ]);
        }
    }

    private _formatChicago(version: number): RichText[] {
        const authors = this._formatAuthors({ style: 'chicago', version });
        const publicationDate = this._safelyFormatDate(this.publicationDate[0]);
        const accessDate = this._formatAccessDate();

        if (version >= 17) {
            // Chicago 17th edition
            return this._trimResult([
                { text: `${authors}. ` },
                { text: `"${this.sourceTitle}." ` },
                { text: this.publisher, italic: true },
                { text: `. ${publicationDate}. ` },
                { text: this.url },
                { text: '.' }
            ]);
        } else {
            // Chicago 16th edition
            return this._trimResult([
                { text: `${authors}. ` },
                { text: `"${this.sourceTitle}." ` },
                { text: this.publisher, italic: true },
                { text: `. Last modified ${publicationDate}. ` },
                { text: `Accessed ${accessDate}. ` },
                { text: this.url },
                { text: '.' }
            ]);
        }
    }

    private _formatAMA(version: number): RichText[] {
        const authors = this._formatAuthors({ style: 'ama', version });
        const publicationDate = this._safelyFormatDateMDY(this.publicationDate[0]);
        const accessDate = this._formatDateMDY(this.accessDate);

        if (version >= 11) {
            // AMA 11th edition
            return this._trimResult([
                { text: `${authors}. ` },
                { text: `${this.sourceTitle}. ` },
                { text: this.publisher, italic: true },
                { text: `. Published ${publicationDate}. ` },
                { text: `Accessed ${accessDate}. ` },
                { text: this.url },
                { text: '.' }
            ]);
        } else {
            // AMA 10th edition
            return this._trimResult([
                { text: `${authors}. ` },
                { text: `${this.sourceTitle}. ` },
                { text: this.publisher, italic: true },
                { text: `. ${publicationDate}. ` },
                { text: `Available at: ${this.url}. ` },
                { text: `Accessed ${accessDate}.` }
            ]);
        }
    }

    private _formatHarvard(): RichText[] {
        const authors = this._formatAuthors({ style: 'harvard', version: 1 });
        const year = this._safelyFormatYear(this.publicationDate[0]);
        const accessDate = this._formatAccessDate();

        return this._trimResult([
            { text: `${authors} ` },
            { text: `(${year}). ` },
            { text: `"${this.sourceTitle}" ` },
            { text: `[Online]. Available at: ${this.url} ` },
            { text: `[Accessed ${accessDate}].` }
        ]);
    }

    private _formatIEEE(): RichText[] {
        const authors = this._formatAuthors({ style: 'ieee', version: 1 });
        const accessDate = this._formatAccessDate();

        return this._trimResult([
            { text: `${authors}, ` },
            { text: `"${this.sourceTitle}," ` },
            { text: this.publisher, italic: true },
            { text: `. [Online]. Available: ${this.url}. ` },
            { text: `[Accessed: ${accessDate}].` }
        ]);
    }

    private _formatVancouver(): RichText[] {
        const authors = this._formatAuthors({ style: 'vancouver', version: 1 });
        const publicationDate = this._safelyFormatDate(this.publicationDate[0]);
        const accessDate = this._formatAccessDate();

        return this._trimResult([
            { text: `${authors}. ` },
            { text: `${this.sourceTitle} [Internet]. ` },
            { text: `${this.publisher}; ` },
            { text: `${publicationDate} ` },
            { text: `[cited ${accessDate}]. ` },
            { text: `Available from: ${this.url}` }
        ]);
    }
}