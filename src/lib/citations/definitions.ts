type URL = string;
type ISBN = string;

/**
 * Represents a date
 */
export interface Date {
    year: number;
    month: number;
    day: number;
}

/**
 * Represents a source from the server
 */
export interface Source {
    uuid: URL | ISBN;
    citationType: string;
    citationInfo: {
        authors: string[];
        sourceTitle: string;
        publisher: string;
        publicationDate: PublicationDate;
        accessDate: Date;
        url: URL;
    };
}

/**
 * Represents a publication date
 */
export interface PublicationDate {
    context: {
        [key: string]: string;
    },
    date: Date;
};

/**
 * Represents a rich text object
 */
export interface RichText {
    text: string;
    italic?: boolean;
}

/**
 * Represents a citation
 */
export interface Citation {
    toMlaFormat(): RichText[];
    toApaFormat(): RichText[];
    toChicagoFormat(): RichText[];
    toHarvardFormat(): RichText[];
}