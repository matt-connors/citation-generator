/**
 * Extracts the author from the given string.
 */

import { Author } from "../definitions";

// <a rel="author" href="https://www.example.com/author/author-name">Author Name</a>
// "author" included in class name
// author in json+ld
// check if the author's name is preceeded by a keyword and prioritize those matches

// check if the remaining text is a name (less than 3 words, no numbers, no special characters
export function getAuthorMatches(text: string): Author[] {

    const matches = [];
    const prefixes = ["written by", "author", "by"];
    const textLower = text.toLowerCase(); // Convert to lowercase for case-insensitive matching
    const possibleAuthors = textLower.split(',')

    // Extract authors based on prefixes
    for (let author of possibleAuthors) {
        for (const prefix of prefixes) {
            matches.push(
                ..._extractMatchingAuthors(author, prefix)
            );
        }
    }

    return matches
        .filter((author, index, self) =>
            matches.indexOf(author) === index
        )
        .map((author, index) => ({
            type: "person",
            firstName: author.split(' ')[0],
            lastName: author.split(' ')[1],
            id: index
        }));
}

/**
 * Extracts matching authors from a string based on prefixes
 */
function _extractMatchingAuthors(text: string, prefix: string): string[] {
    const foundAuthors = [];
    const containsKeyword = text.includes(prefix);

    // remove the keyword from the text
    if (containsKeyword) {
        text = text.replace(prefix, '');
    }

    // Extract author name from the remaining text
    const authorName = text.trim();

    if (_isViableAuthor(authorName)) {
        foundAuthors.push(authorName);
    }

    return foundAuthors;
}

/**
 * Ensure the author's name is viable
 * Must be less than 3 words, no numbers, no special characters
 */
function _isViableAuthor(text: string): boolean {
    const meetsWordCount = text.split(' ').length < 3;
    const hasNoNumbers = !text.match(/\d/);
    const hasNoSpecialCharacters = !text.match(/[^a-zA-Z\s]/);

    return text
            && meetsWordCount
            && hasNoNumbers
            && hasNoSpecialCharacters;
}