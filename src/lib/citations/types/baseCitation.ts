import type { Author, Citation, Date, PublicationDate, RichText, CitationVersion } from '../definitions';

/**
 * Base citation class with common formatting functionality
 */
export default abstract class BaseCitation implements Citation {
    protected authors: Author[];
    protected sourceTitle: string;
    protected publisher: string;
    protected publicationDate: PublicationDate[];
    protected accessDate: Date;

    constructor({ authors, sourceTitle, publisher, publicationDate, accessDate }) {
        this.authors = authors;
        this.sourceTitle = sourceTitle;
        this.publisher = publisher;
        this.publicationDate = publicationDate;
        this.accessDate = accessDate;
    }

    abstract formatCitation(version: CitationVersion): RichText[];

    /**
     * Format date as "Day Month Year"
     */
    protected formatDate(date?: Date): string {
        if (!date?.day || !date?.month || !date?.year) return '';
        const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        return `${date.day} ${months[date.month - 1]} ${date.year}`;
    }

    /**
     * Format date as "Year"
     */
    protected formatYear(date?: Date): string {
        if (!date?.year) return '';
        return `${date.year}`;
    }

    /**
     * Format date as "Month Day, Year"
     */
    protected formatDateMDY(date?: Date): string {
        if (!date?.day || !date?.month || !date?.year) return '';
        const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        return `${months[date.month - 1]} ${date.day}, ${date.year}`;
    }

    /**
     * Format date as "Year, Month Day"
     */
    protected formatDateYMD(date?: Date): string {
        if (!date?.day || !date?.month || !date?.year) return '';
        const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        return `${date.year}, ${months[date.month - 1]} ${date.day}`;
    }

    /**
     * Safely format a publication date
     */
    protected safelyFormatDate(publicationDate?: PublicationDate): string {
        if (!publicationDate?.date) return '';
        const formatted = this.formatDate(publicationDate.date);
        return formatted || '';
    }

    /**
     * Safely format a publication year
     */
    protected safelyFormatYear(publicationDate?: PublicationDate): string {
        if (!publicationDate?.date) return '';
        const formatted = this.formatYear(publicationDate.date);
        return formatted || '';
    }

    /**
     * Safely format a publication date as MDY
     */
    protected safelyFormatDateMDY(publicationDate?: PublicationDate): string {
        if (!publicationDate?.date) return '';
        const formatted = this.formatDateMDY(publicationDate.date);
        return formatted || '';
    }

    /**
     * Format access date
     */
    protected formatAccessDate(): string {
        if (!this.accessDate) return '';
        const formatted = this.formatDate(this.accessDate);
        return formatted || '';
    }

    /**
     * Format authors based on citation style
     */
    protected formatAuthors(format: CitationVersion): string {
        if (!Array.isArray(this.authors) || this.authors.length === 0) return '';
        
        const formattedAuthors = this.authors
            .map(author => {
                if (author.type === "person") {
                    if (!author.lastName) return '';
                    
                    switch (format.style) {
                        case 'mla':
                            return this.formatMLAAuthor(author);
                        case 'apa':
                            return this.formatAPAAuthor(author, format.version);
                        case 'chicago':
                            return this.formatChicagoAuthor(author);
                        case 'harvard':
                            return this.formatHarvardAuthor(author);
                        case 'ama':
                            return this.formatAMAAuthor(author, format.version);
                        case 'ieee':
                            return this.formatIEEEAuthor(author);
                        case 'vancouver':
                            return this.formatVancouverAuthor(author);
                        default:
                            return this.formatDefaultAuthor(author);
                    }
                }
                return author.name || '';
            })
            .filter(Boolean);

        if (formattedAuthors.length === 0) return '';
        return formattedAuthors.join(format.style === 'mla' ? ', and ' : ', ');
    }

    private formatMLAAuthor(author: Author & { type: "person" }): string {
        if (!author.lastName) return '';
        return author.firstName ? `${author.lastName}, ${author.firstName}` : author.lastName;
    }

    private formatAPAAuthor(author: Author & { type: "person" }, version: number): string {
        if (!author.lastName) return '';
        if (!author.firstName) return author.lastName;

        if (version >= 7) {
            const initials = author.firstName.split(' ')
                .map(n => n.charAt(0))
                .filter(Boolean)
                .map(i => i + '.')
                .join(' ');
            return `${author.lastName}, ${initials}`;
        }
        
        const initials = author.firstName.split(' ')
            .map(n => n.charAt(0))
            .filter(Boolean)
            .map(i => i + '.')
            .join('. ');
        return `${author.lastName}, ${initials}`;
    }

    private formatChicagoAuthor(author: Author & { type: "person" }): string {
        if (!author.lastName) return '';
        return author.firstName ? `${author.lastName}, ${author.firstName}` : author.lastName;
    }

    private formatHarvardAuthor(author: Author & { type: "person" }): string {
        if (!author.lastName) return '';
        if (!author.firstName) return author.lastName;

        const initials = author.firstName.split(' ')
            .map(n => n.charAt(0))
            .filter(Boolean)
            .map(i => i + '.')
            .join('');
        return `${author.lastName}, ${initials}`;
    }

    private formatAMAAuthor(author: Author & { type: "person" }, version: number): string {
        if (!author.lastName) return '';
        if (!author.firstName) return author.lastName;

        if (version >= 11) {
            const initials = author.firstName.split(' ')
                .map(n => n.charAt(0))
                .filter(Boolean)
                .join('');
            return `${author.lastName} ${initials}`;
        }
        return `${author.lastName} ${author.firstName.charAt(0)}`;
    }

    private formatIEEEAuthor(author: Author & { type: "person" }): string {
        if (!author.lastName) return '';
        if (!author.firstName) return author.lastName;

        const initials = author.firstName.split(' ')
            .map(n => n.charAt(0))
            .filter(Boolean)
            .map(i => i + '.')
            .join(' ');
        return `${initials} ${author.lastName}`;
    }

    private formatVancouverAuthor(author: Author & { type: "person" }): string {
        if (!author.lastName) return '';
        if (!author.firstName) return author.lastName;

        const initials = author.firstName.split(' ')
            .map(n => n.charAt(0))
            .filter(Boolean)
            .join('');
        return `${author.lastName} ${initials}`;
    }

    private formatDefaultAuthor(author: Author & { type: "person" }): string {
        if (!author.lastName) return '';
        if (!author.firstName) return author.lastName;

        const initials = author.firstName.split(' ')
            .map(n => n.charAt(0))
            .filter(Boolean)
            .map(i => i + '.')
            .join(' ');
        return `${author.lastName}, ${initials}`;
    }

    /**
     * Remove empty text elements and unnecessary punctuation
     */
    protected trimResult(result: RichText[]): RichText[] {
        // First, filter out any RichText elements with empty or undefined text
        const filteredResult = result.filter(item => item?.text && item.text.trim() !== '');

        // Then apply the punctuation rules
        return filteredResult.filter((item, i, arr) => {
            // Skip if current item is empty
            if (!item?.text) return false;

            // Remove standalone punctuation
            if (item.text === ', ' || item.text === '. ') return false;

            // Remove empty quoted sections
            const isEmptyQuote = arr[i]?.text === '"' && 
                               arr[i + 2]?.text === '." ' && 
                               (!arr[i + 1]?.text || arr[i + 1].text === '');
            if (isEmptyQuote) return false;

            const isEmptyQuoteEnd = arr[i]?.text === '." ' && 
                                  arr[i - 2]?.text === '"' && 
                                  (!arr[i - 1]?.text || arr[i - 1].text === '');
            if (isEmptyQuoteEnd) return false;

            // Remove empty parentheses
            if (item.text === '(). ') return false;

            return true;
        });
    }

    /**
     * Create a rich text element with optional italic formatting
     */
    protected createRichText(text?: string, italic?: boolean): RichText {
        if (!text) return { text: '' };
        return { text, ...(italic && { italic: true }) };
    }

    /**
     * Wrap text in quotes if the text exists
     */
    protected wrapInQuotes(text?: string): string {
        if (!text?.trim()) return '';
        return `"${text}"`;
    }

    /**
     * Safely join text segments with a separator
     */
    protected joinWithSeparator(segments: (string | undefined)[], separator: string): string {
        return segments.filter(Boolean).join(separator);
    }

    /**
     * Safely concatenate text segments
     */
    protected concat(...segments: (string | undefined)[]): string {
        return segments.filter(Boolean).join('');
    }
} 