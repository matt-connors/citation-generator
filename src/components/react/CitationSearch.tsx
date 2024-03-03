import React from "react";
import clsx from "clsx";

import { Tab, Tabs, TabList, TabPanel } from 'react-tabs';

import styles from "../../styles/citation-search.module.css";

function WebsiteSearch() {
    return (
        <label>
            <span>Website URL</span>
            <div className={styles.inputWrapper}>
                <div className={styles.inputFade}></div>
                <input type="url" placeholder="Paste the website URL" name="website" autoComplete="off" />
            </div>
        </label>
    );
}

function BookSearch() {
    return (
        <label>
            <span>Book Title</span>
            <div className={styles.inputWrapper}>
                <div className={styles.inputFade}></div>
                <input type="text" placeholder="Enter an ISBN or DOI" name="book" autoComplete="off" />
            </div>
        </label>
    );
}

function JournalSearch() {
    return (
        <label>
            <span>Journal Title</span>
            <div className={styles.inputWrapper}>
                <div className={styles.inputFade}></div>
                <input type="text" placeholder="Enter an ISBN or DOI" name="journal" autoComplete="off" />
            </div>
        </label>
    );
}

export default function CitationSearch() {
    const [tabIndex, setTabIndex] = React.useState(0);

    // Function to get the class names for the search panel
    const getClassNames = (className: string, index: number) => clsx(
        styles[className],
        tabIndex === index && styles.active
    );

    return (
        <Tabs selectedIndex={tabIndex} onSelect={index => setTabIndex(index)}>
            <TabList className={styles.searchTablist}>
                <Tab className={getClassNames('searchPanelTab', 0)}>Website</Tab>
                <Tab className={getClassNames('searchPanelTab', 1)}>Book</Tab>
                <Tab className={getClassNames('searchPanelTab', 2)}>Journal</Tab>
            </TabList>
            <form className={styles.searchBox}>
                <label>
                    <span>Citation Style</span>
                    <p className={styles.temp}>MLA 9th edition</p>
                </label>
                <label>
                    {/* Tab for website search panel */}
                    <TabPanel className={getClassNames('searchPanel', 0)}>
                        <WebsiteSearch />
                    </TabPanel>
                    {/* Tab for book search panel */}
                    <TabPanel className={getClassNames('searchPanel', 1)}>
                        <BookSearch />
                    </TabPanel>
                    {/* Tab for journal search panel */}
                    <TabPanel className={getClassNames('searchPanel', 2)}>
                        <JournalSearch />
                    </TabPanel>
                </label>
                <button type="submit" className="button-primary">
                    <span>Cite</span>
                </button>
            </form>
        </Tabs>
    );
}