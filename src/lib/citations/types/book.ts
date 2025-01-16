import type { Author, Citation, Date, PublicationDate, RichText, CitationVersion } from '../definitions';

/**
 * Create a website citation
 */
export default class BookCitation implements Citation {
    public authors: Author[];
    public sourceTitle: string;
    public publisher: string;
    public publicationDate: PublicationDate[];
    public accessDate: Date;
    public isbn: string;
    public edition?: string;
    public city?: string;

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
        this.authors = authors;
        this.sourceTitle = sourceTitle;
        this.publisher = publisher;
        this.publicationDate = publicationDate;
        this.accessDate = accessDate;
        this.isbn = isbn;
        this.edition = edition;
        this.city = city;
    }

    private _formatDate(date: Date): string {
        const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        return `${date.day} ${months[date.month - 1]} ${date.year}`;
    }

    private _formatYear(date: Date): string {
        return `${date.year}`;
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

    private _formatAuthors(format: CitationVersion): string {
        return this.authors.map(author => {
            if (author.type === "person") {
                switch(format.style) {
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
                    case 'ieee':
                        return `${author.firstName?.split(' ').map(n => n.charAt(0) + '.').join(' ')} ${author.lastName}`;
                    case 'vancouver':
                        return `${author.lastName} ${author.firstName?.split(' ').map(n => n.charAt(0)).join('')}`;
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
            !(arr[i]?.text === '." ' && arr[i - 2]?.text === '"' && arr[i - 1].text === '')
        );
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
        const authors = this._formatAuthors({ style: 'mla', version });
        const year = this._safelyFormatYear(this.publicationDate[0]);

        if (version >= 9 || version >= 8) {
            // MLA 8th and 9th editions
            return this._trimResult([
                { text: `${authors}. ` },
                { text: this.sourceTitle, italic: true },
                { text: `. ${this.publisher}, ` },
                { text: year },
                { text: '.' }
            ]);
        } else {
            // MLA 7th edition and earlier
            return this._trimResult([
                { text: `${authors}. ` },
                { text: this.sourceTitle, italic: true },
                { text: `. ${this.city}: ` },
                { text: `${this.publisher}, ` },
                { text: `${year}. ` },
                { text: 'Print.' }
            ]);
        }
    }

    private _formatAPA(version: number): RichText[] {
        const authors = this._formatAuthors({ style: 'apa', version });
        const year = this._safelyFormatYear(this.publicationDate[0]);

        if (version >= 7) {
            // APA 7th edition
            return this._trimResult([
                { text: `${authors} ` },
                { text: `(${year}). ` },
                { text: this.sourceTitle, italic: true },
                { text: `. ${this.publisher}.` }
            ]);
        } else {
            // APA 6th edition
            return this._trimResult([
                { text: `${authors} ` },
                { text: `(${year}). ` },
                { text: this.sourceTitle, italic: true },
                { text: `. ${this.city}, ${this.publisher}.` }
            ]);
        }
    }

    private _formatChicago(version: number): RichText[] {
        const authors = this._formatAuthors({ style: 'chicago', version });
        const year = this._safelyFormatYear(this.publicationDate[0]);

        if (version >= 17) {
            // Chicago 17th edition
            return this._trimResult([
                { text: `${authors}. ` },
                { text: `${year}. ` },
                { text: this.sourceTitle, italic: true },
                { text: `. ${this.city}: ${this.publisher}.` }
            ]);
        } else {
            // Chicago 16th edition
            return this._trimResult([
                { text: `${authors}. ` },
                { text: `${year}. ` },
                { text: this.sourceTitle, italic: true },
                { text: `. ${this.city}: ${this.publisher}.` }
            ]);
        }
    }

    private _formatAMA(version: number): RichText[] {
        const authors = this._formatAuthors({ style: 'ama', version });
        const year = this._safelyFormatYear(this.publicationDate[0]);

        if (version >= 11) {
            // AMA 11th edition
            return this._trimResult([
                { text: `${authors}. ` },
                { text: this.sourceTitle, italic: true },
                { text: `. ${this.publisher}; ${year}.` }
            ]);
        } else {
            // AMA 10th edition
            return this._trimResult([
                { text: `${authors}. ` },
                { text: this.sourceTitle, italic: true },
                { text: `. ${this.publisher}; ${year}.` }
            ]);
        }
    }

    private _formatHarvard(): RichText[] {
        const authors = this._formatAuthors({ style: 'harvard', version: 1 });
        const year = this._safelyFormatYear(this.publicationDate[0]);
        
        return this._trimResult([
            { text: `${authors} ` },
            { text: `(${year}). ` },
            { text: this.sourceTitle, italic: true },
            { text: `. ${this.city}: ${this.publisher}.` }
        ]);
    }

    private _formatIEEE(): RichText[] {
        const authors = this._formatAuthors({ style: 'ieee', version: 1 });
        const year = this._safelyFormatYear(this.publicationDate[0]);
        const editionText = this.edition ? `, ${this.edition} ed.` : '';
        
        return this._trimResult([
            { text: `${authors}, ` },
            { text: this.sourceTitle, italic: true },
            { text: `${editionText}. ${this.city}: ${this.publisher}, ${year}.` }
        ]);
    }

    private _formatVancouver(): RichText[] {
        const authors = this._formatAuthors({ style: 'vancouver', version: 1 });
        const year = this._safelyFormatYear(this.publicationDate[0]);
        const editionText = this.edition ? ` ${this.edition} ed.` : '';
        
        return this._trimResult([
            { text: `${authors}. ` },
            { text: this.sourceTitle, italic: true },
            { text: `${editionText}. ${this.city}: ${this.publisher}; ${year}.` }
        ]);
    }
}