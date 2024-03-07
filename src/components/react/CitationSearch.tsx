import React, { useState } from "react";
import clsx from "clsx";
import { Tab, Tabs, TabList, TabPanel } from 'react-tabs';
import Dropdown from "./Dropdown";
import styles from "../../styles/citation-search.module.css";

// Component for each search input field
const SearchPanel = ({ label, placeholder, name }) => {
    return (
        <div role="group" aria-labelledby={name} className={styles.labelContent}>
            <span id={name} className={styles.inputLabel}>{label}</span>
            <div className={styles.inputWrapper}>
                <div className={styles.inputFade}></div>
                <input type="text" placeholder={placeholder} name={name} autoComplete="off" />
            </div>
        </div>
    );
}

// Main CitationSearch component
const CitationSearch = () => {
    // State for managing active tab index
    const [tabIndex, setTabIndex] = useState(0);

    // Function to generate class names for styling active tabs
    const getClassNames = (className: string, index: number) => clsx(
        styles[className],
        tabIndex === index && styles.active
    );

    // Array of search panels with their respective labels, placeholders, and names
    const tabPanels = [
        { label: "Website", placeholder: "Paste the website URL", name: "website" },
        { label: "Book", placeholder: "Enter an ISBN or DOI", name: "book" },
        { label: "Journal", placeholder: "Enter an ISBN or DOI", name: "journal" }
    ];

    const citationStyles = [
        { label: "MLA 9th edition", value: "mla-9th-edition" },
        { label: "MLA 8th edition", value: "mla-8th-edition" },
        { label: "AMA 11th edition", value: "ama-11th-edition" },
        { label: "AMA 10th edition", value: "ama-10th-edition" },
        { label: "APA 7th edition", value: "apa-7th-edition" },
        { label: "APA 6th edition", value: "apa-6th-edition" },
        { label: "Chicago 17th edition", value: "chicago-17th-edition" },
        { label: "Harvard", value: "harvard" },
        { label: "Vancouver", value: "vancouver" },
        { label: "IEEE", value: "ieee" },
        { label: "American Chemical Society", value: "acs" },
        { label: "American Sociological Association", value: "asa" },
        { label: "Council of Science Editors", value: "cse" },
    ];

    return (
        <Tabs selectedIndex={tabIndex} onSelect={setTabIndex}>
            {/* Tab list */}
            <TabList className={styles.searchTablist} role="tablist">
                {tabPanels.map((panel, index) => (
                    <Tab key={index} className={getClassNames('searchPanelTab', index)} role="tab" aria-selected={tabIndex === index ? "true" : "false"}>{panel.label}</Tab>
                ))}
            </TabList>
            {/* Form containing search inputs and citation options */}
            <form className={styles.searchBox}>
                {/* Dropdown for selecting citation style */}
                <Dropdown
                    options={citationStyles}
                    defaultOption={citationStyles[0]}
                    className={styles.label}
                />
                {/* Render tab panels dynamically */}
                {tabPanels.map((panel, index) => (
                    <TabPanel key={index} className={`${styles.label} ${getClassNames('searchPanel', index)}`} role="tabpanel" aria-labelledby={panel.name} hidden={tabIndex !== index}>
                        <SearchPanel {...panel} />
                    </TabPanel>
                ))}
                {/* Cite button */}
                <button type="submit" className={`button-primary ${styles.citeBtn}`}>
                    <span>Cite</span>
                </button>
            </form>
        </Tabs>
    );
}

export default CitationSearch;
