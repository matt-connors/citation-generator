import type { Citation, Date, PublicationDate, RichText } from '../definitions';

/**
 * Create a website citation
 */
export default class BookCitation implements Citation {

    public authors: string[];
    public sourceTitle: string;
    public publisher: string;
    public publicationDate: PublicationDate[];
    public accessDate: Date;
    public isbn: string;

    constructor({ authors, sourceTitle, publisher, publicationDate, accessDate, isbn }) {
        this.authors = authors;
        this.sourceTitle = sourceTitle;
        this.publisher = publisher;
        this.publicationDate = publicationDate;
        this.accessDate = accessDate;
        this.isbn = isbn;
    }

    /**
     * Format the date as "Day Month Year"
     */
    private _formatDate(date: Date): string {
        const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        return `${date.day} ${months[date.month - 1]} ${date.year}`;
    }

    /**
     * Only attempt to format the date if it exists
     */
    private _safeltyFormatDate(publicationDate: PublicationDate): string {
        if (publicationDate && publicationDate.date) {
            return this._formatDate(publicationDate.date);
        }
        return '';
    }

    /**
     * Trim off any empty text nodes and remove any unnecessary commas and periods
     */
    private _trimResult(result: RichText[]) {
        return result.filter((item, i, arr) => item.text !== ''
            && item.text !== ', '
            && item.text !== '. '
            && !(arr[i]?.text === '"' && arr[i + 2]?.text === '." ' && arr[i + 1].text == '')
            && !(arr[i]?.text === '." ' && arr[i - 2]?.text === '"' && arr[i - 1].text == ''))
    }

    /**
     * Returns the citation in MLA format
     * Author(s) Last Name, First Name. "Title of the Web Page or Article." Title of the Website, Publisher/Sponsor, Date of publication or last update, URL.
     */
    public toMlaFormat(): RichText[] {

        // const authors = this.authors.map(author => author.split(' ').pop()).join(", "); // Only get authors last name
        const authors = this.authors.join(", ");
        const bookTitle = this.sourceTitle || '';
        const publisher = this.publisher || '';
        const publicationDate = this._safeltyFormatDate(this.publicationDate[0]);

        return this._trimResult([
            { text: `${authors}. ` },
            { text: `"` },
            { text: `${bookTitle}`, italic: true },
            { text: `." ` },
            { text: `${publisher}, ` },
            { text: `${publicationDate}` },
        ]);

    }

    /**
     * Returns the citation in APA format
     * Author(s). (Year). Title of the page. Publisher. URL
     */
    public toApaFormat(): RichText[] {
        return this.toMlaFormat();
    }

    /**
     * Returns the citation in Chicago format
     * Author(s). "Title of the page," Publisher, Publication Date. URL.
     */
    public toChicagoFormat(): RichText[] {
        return this.toMlaFormat();
    }

    /**
     * Returns the citation in Harvard format
     * Author(s) Year, 'Title of the page', Publisher, Publication Date, URL.
     */
    public toHarvardFormat(): RichText[] {
        return this.toMlaFormat();
    }

    /**
     * Returns the citation in AMA format
     * Author(s). Title of the page. Publisher; Publication Date. URL.
     */
    public toAmaFormat(): RichText[] {

        const authors = this.authors.join(", ");
        const pageTitle = this.sourceTitle || '';
        const publisher = this.publisher || '';
        const publicationDate = this._safeltyFormatDate(this.publicationDate[0]);

        return [
            { text: `${authors}. ` },
            { text: `${pageTitle}. ${publisher}; ${publicationDate}` }
        ];
    }

}