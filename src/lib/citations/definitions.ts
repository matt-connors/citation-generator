type URL = string;
type ISBN = string;

export type Author = (PersonAuthor | CorporateAuthor) & { id: number }

/**
 * Represents a date
 */
export interface Date {
    year: number;
    month: number;
    day: number;
}

/**
 * Represents a person author
 */
export interface PersonAuthor {
    type: "person";
    title?: string;
    initials?: string;
    lastName?: string;
    firstName?: string;
}

/**
 * Represents a corporate author
 */
export interface CorporateAuthor {
    type: "organization";
    name: string;
}

/**
 * Represents a source from the server
 */
export type Source = BookSource | WebsiteSource;

export type BookSource = {
    uuid: ISBN;
    citationType: "book";
    citationInfo: BookCitation & AllCitations;
}

export type WebsiteSource = {
    uuid: URL;
    citationType: "website";
    citationInfo: WebsiteCitation & AllCitations;
}

/**
 * 
 */
interface WebsiteCitation {
    url: URL;
}

interface BookCitation {
    doi: string;
    url?: URL;
    medium?: string;
    edition?: string;
    volume?: string;
}


interface AllCitations {
    authors: Author[];
    sourceTitle: string;
    publisher: string;
    publicationDate: PublicationDate;
    accessDate: Date;
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
    toMlaFormat(edition?: number): RichText[];
    toApaFormat(edition?: number): RichText[];
    toChicagoFormat(edition?: number): RichText[];
    toHarvardFormat(edition?: number): RichText[];
    toAmaFormat(edition?: number): RichText[];
}