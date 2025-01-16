type URL = string;
type ISBN = string;

export type Author = (PersonAuthor | CorporateAuthor);

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