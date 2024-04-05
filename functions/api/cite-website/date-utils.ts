import { DATE_FORMATS } from './consts';
import moment, { Moment } from 'moment';

/**
 * Extracts dates from a string
 */
function _extractDates(text: string) {
    const regexPatterns = DATE_FORMATS.map(format => format.regex);

    const extractedDates = [];
    for (const pattern of regexPatterns) {
        let match: RegExpExecArray;
        while ((match = pattern.exec(text)) !== null) {
            extractedDates.push(match[0]);
            text = text.slice(match.index + match[0].length); // Update remaining text
        }
    }

    return extractedDates;
}

// last modified on wed 29 aug 2018 04.45 edt

/**
 * Extracts dates from a string based on prefixes
 */
function _extractMatchingDates(text: string, prefix: string, prefixEnd: string) {

    // console.log(`"${prefix.toLowerCase() + prefixEnd}"`);

    const foundDates = [];
    const preceeding = prefix.toLowerCase() + prefixEnd;
    const startIndex = text.indexOf(preceeding);

    // Create an array of moment.js supported date formats
    const supportedFormats = DATE_FORMATS.map(format => format.format);

    if (startIndex !== -1) {
        // Extract date string after prefix, removing leading/trailing white spaces
        const dateStringText = text.substring(startIndex + preceeding.length).trim();
        const dates = _extractDates(dateStringText);

        for (const dateString of dates) {
            // Use moment.js to parse the date string and handle various formats
            const parsedDate = moment(dateString, supportedFormats, false);
            if (parsedDate.isValid()) {
                foundDates.push({
                    context: {
                        prefix: prefix,
                        matchedText: dateString
                    },
                    date: _getDateParts(parsedDate)
                });
            }
        }
    }
    return foundDates;
}

/**
 * Get the day, month, and year from a date
 */
function _getDateParts(date: Moment) {
    return {
        day: date.date(),
        month: date.month() + 1,
        year: date.year()
    };
}

/**
 * Extracts dates from a string based on prefixes
 */
export function getDateMatches(prefixes: string[], text: string) {
    const foundDates = [];
    const textLower = text.toLowerCase(); // Convert to lowercase for case-insensitive matching
    const prefixEnds = [" on", " at", ": ", " "];

    // Extract dates based on prefixes
    for (const prefix of prefixes) {
        for (const prefixEnd of prefixEnds) {
            foundDates.push(
                ..._extractMatchingDates(textLower, prefix, prefixEnd)
            );
        }
    }

    // Extract all other dates without a prefix
    foundDates.push(
        ..._extractMatchingDates(textLower, "", "")
    );

    return foundDates;
}

