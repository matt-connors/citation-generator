const citationStyles = [
    { label: "MLA 9th edition", value: "mla-9th-edition", default: true },
    { label: "MLA 8th edition", value: "mla-8th-edition" },
    { label: "MLA 7th edition", value: "mla-7th-edition" },
    { label: "MLA 6th edition", value: "mla-6th-edition" },

    { label: "APA 7th edition", value: "apa-7th-edition" },
    { label: "APA 6th edition", value: "apa-6th-edition" },

    { label: "Chicago 17th edition", value: "chicago-17th-edition" },
    { label: "Chicago 16th edition", value: "chicago-16th-edition" },

    { label: "AMA 11th edition", value: "ama-11th-edition" },
    { label: "AMA 10th edition", value: "ama-10th-edition" },

    { label: "Harvard", value: "harvard" },
    { label: "IEEE", value: "ieee" },
    { label: "Vancouver", value: "vancouver" },
]
.sort((a, b) => a.label.localeCompare(b.label));

export default citationStyles;