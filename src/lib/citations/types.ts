export interface Date {
    year: number;
    month: number;
    day: number;
}

interface Base {
    authors?: string[];
    sourceTitle?: string;
    publisher?: string;
    publicationDate?: Date[];
    accessDate?: Date;
}

export interface WebsiteCitation extends Base {
    url?: string;
}

export interface BookCitation extends Base {
    edition?: number;
    volume?: number;
    pageNumbers?: string;
}

// create an export meaning it can be one of the two types
export type CitationInfo = WebsiteCitation | BookCitation;

// export interface CitationInfo extends WebsiteCitation, BookCitation {}