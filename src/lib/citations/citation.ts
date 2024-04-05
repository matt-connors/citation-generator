interface Citation {
    toMlaFormat(): RichText[];
    toApaFormat(): string;
    toChicagoFormat(): string;
    toHarvardFormat(): string;
}

interface Date {
    year: number;
    month: number;
    day: number;
}

interface RichText {
    text: string;
    italic?: boolean;
}


export class WebsiteCitation implements Citation {

    public authors: string[];
    public sourceTitle: string;
    public publisher: string;
    public publicationDate: Date;
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

    private _formatDate(date: Date): string {
        const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        return `${date.day} ${months[date.month - 1]} ${date.year}`;
    }

    /**
     * Returns the citation in MLA format
     * Author(s) Last Name, First Name. "Title of the Web Page or Article." Title of the Website, Publisher/Sponsor, Date of publication or last update, URL.
     */
    public toMlaFormat(): RichText[] {

        const authors = this.authors.join(", ");
        const pageTitle = this.sourceTitle || '';
        const websiteTitle = this.publisher || '';
        const publisher = this.publisher || '';
        const publicationDate = this._formatDate(this.publicationDate);
        const url = this.url || '';
        
        return [
            { text: `${authors}. "`, },
            { text: `${pageTitle}`, italic: true },
            { text: `." ` },
            { text: `${websiteTitle}`, italic: true },
            { text: `, ${publisher}, ${publicationDate}, ${url}.` }
        ];
        
    }

    /**
     * Returns the citation in APA format
     */
    public toApaFormat(): string {
        return "";
    }

    /**
     * Returns the citation in Chicago format
     */
    public toChicagoFormat(): string {
        return "";
    }

    /**
     * Returns the citation in Harvard format
     */
    public toHarvardFormat(): string {
        return "";
    }

}