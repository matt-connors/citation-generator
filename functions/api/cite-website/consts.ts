export const MATCH_MAX = 12;
export const DATE_FORMATS = [
    {
        // YYYY-MM-DD (e.g., 2024-03-10)
        regex: /\d{4}-\d{2}-\d{2}/,
        format: "YYYY-MM-DD"
    },
    {
        // MM/DD/YYYY (e.g., 03/10/2024)
        regex: /\d{2}\/\d{2}\/\d{4}/,
        format: "MM/DD/YYYY"
    },
    {
        // DD/MM/YYYY (e.g., 10/03/2024) - for countries with DD/MM format
        regex: /\d{2}\/\d{2}\/\d{4}/,
        format: "DD/MM/YYYY"
    },
    {
        // Month name DD, YYYY (e.g., March 10, 2024)
        regex: /\w+\s\d{1,2},\s\d{4}/,
        format: "MMMM DD, YYYY"
    },
    {
        // Month abbreviation (3 letters) DD, YYYY (e.g., Mar 10, 2024)
        regex: /\b[A-Z]{3}\s\d{1,2},\s\d{4}/,
        format: "MMM DD, YYYY"
    },
    {
        // Ordinal dates (e.g., 1st of March 2024, 2nd April, 2023)
        regex: /\d{1,2}(?:st|nd|rd|th)\s+(of)?\s+\w+\s+\d{4}/,
        format: "Do MMMM YYYY"
    },
    {
        // Two-digit year format (e.g., 10/03/23) - Use with caution due to ambiguity
        regex: /\d{2}\/\d{2}\/\d{2}/,
        format: "YY/MM/DD"
    },
    {
        // Day, Month, Year (e.g., 10 March 2024)
        regex: /\d{1,2}\s\w+\s\d{4}/,
        format: "DD MMMM YYYY"
    },
];