import React, { useState, forwardRef, type Ref } from "react";
import clsx from "clsx";
import { Tab, Tabs, TabList, TabPanel } from 'react-tabs';
import { ChevronRightIcon } from '@heroicons/react/24/outline';
import Dropdown from "./Dropdown";
import citationStyles from '../citationStyles';
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
const CitationSearch = forwardRef((props: { includeDropdown: Boolean, includeManualCite: Boolean }, ref: Ref<HTMLInputElement>) => {
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
        { label: "Book", placeholder: "Enter an ISBN", name: "book" },
        { label: "Journal", placeholder: "Enter an ISBN", name: "journal" }
    ];

    return (
        <Tabs selectedIndex={tabIndex} onSelect={setTabIndex} className={styles.citationSearch}>

            {/* Tab list */}
            <TabList className={styles.searchTablist} role="tablist">
                {tabPanels.map((panel, index) => (
                    <Tab key={index} className={getClassNames('searchPanelTab', index)} role="tab" aria-selected={tabIndex === index ? "true" : "false"}>{panel.label}</Tab>
                ))}
            </TabList>

            {/* Form containing search inputs and citation options */}
            <form className={`${styles.searchBox} ${clsx(
                props.includeDropdown && styles.withDropdown
            )}`} action="/my-references">

                {/* Dropdown for selecting citation style */}
                {props.includeDropdown ? <Dropdown
                    options={citationStyles}
                    className={clsx(styles.label, styles.dropdown)}
                /> : <input type="hidden" name="citationStyle" ref={ref} />}

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
            {props.includeManualCite && (
                <a href="/my-references" className={styles.smallButton}>
                    <span>Cite Manually</span>
                    <ChevronRightIcon className={styles.icon} />
                </a>
            )}
        </Tabs>
    );
})

export default CitationSearch;
