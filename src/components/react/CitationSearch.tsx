import React, { useState, forwardRef, type Ref } from "react";
import clsx from "clsx";
import { Tab, Tabs, TabList, TabPanel } from 'react-tabs';
import { ChevronRightIcon } from '@heroicons/react/24/outline';
import Dropdown from "./Dropdown";
import citationStyles from '../citationStyles';
import styles from "../../styles/citation-search.module.css";

// Component for each search input field
const SearchPanel = ({ label, placeholder, name }) => {
    const inputId = `${name}-input`;
    return (
        <div className={styles.labelContent}>
            <label htmlFor={inputId} id={name} className={styles.inputLabel}>{label}</label>
            <div className={styles.inputWrapper}>
                <div className={styles.inputFade} aria-hidden="true"></div>
                <input id={inputId} type="text" placeholder={placeholder} name={name} autoComplete="off" />
            </div>
        </div>
    );
}

export type CitationSearchTab = 'website' | 'book' | 'journal';

interface CitationSearchProps {
    includeDropdown?: Boolean;
    includeManualCite?: Boolean;
    defaultStyle?: string;
    /** Which tab opens first — lets a guide about DOIs start on the Journal tab. */
    defaultTab?: CitationSearchTab;
    /** Placeholder override for the default tab (e.g. "Paste the TikTok URL"). */
    placeholder?: string;
    /** Attribution slug carried through to /my-references and the cite APIs. */
    from?: string;
}

// Main CitationSearch component
const CitationSearch = forwardRef((props: CitationSearchProps, ref: Ref<HTMLInputElement>) => {
    // Array of search panels with their respective labels, placeholders, and names
    const tabPanels = [
        { label: "Website", placeholder: "Paste the website URL", name: "website" },
        { label: "Book", placeholder: "Enter an ISBN", name: "book" },
        { label: "Journal", placeholder: "Enter a DOI", name: "journal" },
    ];

    const defaultTabIndex = Math.max(0, tabPanels.findIndex((panel) => panel.name === props.defaultTab));

    // State for managing active tab index
    const [tabIndex, setTabIndex] = useState(defaultTabIndex);

    // A guide-supplied placeholder applies only to the tab it was written for.
    if (props.placeholder) {
        tabPanels[defaultTabIndex].placeholder = props.placeholder;
    }

    // Function to generate class names for styling active tabs
    const getClassNames = (className: string, index: number) => clsx(
        styles[className],
        tabIndex === index && styles.active
    );

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
            )}`} action="/my-references/">

                {/* Dropdown for selecting citation style */}
                {props.includeDropdown ? <Dropdown
                    options={citationStyles}
                    className={clsx(styles.label, styles.dropdown)}
                    defaultStyle={props.defaultStyle}
                /> : <input type="hidden" name="citationStyle" ref={ref} />}

                {/* Attribution: which guide page this search started from */}
                {props.from && <input type="hidden" name="from" value={props.from} />}

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
                <a href="/my-references/" className={styles.smallButton}>
                    <span>Cite Manually</span>
                    <ChevronRightIcon className={styles.icon} aria-hidden="true" />
                </a>
            )}
        </Tabs>
    );
})

export default CitationSearch;
