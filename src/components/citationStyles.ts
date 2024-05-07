const citationStyles = [
    { label: "MLA 9th edition", value: "mla-9th-edition", default: true },
    { label: "MLA 8th edition", value: "mla-8th-edition" },
    { label: "AMA 11th edition", value: "ama-11th-edition" },
    { label: "AMA 10th edition", value: "ama-10th-edition" },
    { label: "APA 7th edition", value: "apa-7th-edition" },
    { label: "APA 6th edition", value: "apa-6th-edition" },
    { label: "Harvard", value: "harvard" },
    { label: "Chicago", value: "chicago" }
    // { label: "Chicago 17th edition", value: "chicago-17th-edition" },
    // { label: "Harvard", value: "harvard" },
    // { label: "Vancouver", value: "vancouver" },
    // { label: "IEEE", value: "ieee" },
    // { label: "American Chemical Society", value: "acs" },
    // { label: "American Sociological Association", value: "asa" },
    // { label: "Council of Science Editors", value: "cse" },
]
.sort((a, b) => a.label.localeCompare(b.label));

export default citationStyles;