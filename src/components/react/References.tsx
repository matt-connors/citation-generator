import styles from '../../styles/references.module.css';
import type { Source } from '../../lib/citations/definitions';
import formatSource from '../../lib/citations/formatSource';
import CitationSearch from './CitationSearch';
import type { Option } from './Dropdown';

import citationStyles from '../citationStyles';

import Dropdown from './Dropdown';

import {
    ClipboardIcon,
    FunnelIcon,
    MagnifyingGlassIcon,
    PencilIcon,
    GlobeAltIcon,
    TrashIcon,
    ArrowPathRoundedSquareIcon
} from '@heroicons/react/24/outline';

import React, { useState, useEffect, useRef } from 'react';

export default function References() {
    const [sources, setSources] = useState<Source[]>([]);
    const [sourceCount, setSourceCount] = useState<number>(0);
    const [checkedCount, setCheckedCount] = useState<number>(sourceCount);
    const [citationFormat, setCitationFormat] = useState<string>('mla-9th-edition');

    const citationFormatRef = useRef<HTMLInputElement>(null);
    const selectAllRef = useRef<any>(null);
    // const citationSearchRef = useRef<any>(null);

    useEffect(() => {
        // Get the citation style from the query parameter
        setCitationFormat(
            new URLSearchParams(window.location.search).get('citationStyle') || 'mla-9th-edition'
        );
        /**
         * Get existing sources from local storage
         */
        const getExistingSources = (): Source[] => {
            let existingSources = localStorage.getItem("sources");
            if (existingSources) {
                return JSON.parse(existingSources);
            }
            return [];
        }
        /**
         * Get request parameters from the URL
         */
        const getRequestUrl = (): string => {
            const url = new URL(window.location.href);
            const website = url.searchParams.get('website');
            const book = url.searchParams.get('book');
            if (website) {
                return `/cite-website?url=${website}`
            }
            if (book) {
                return `/cite-book?isbn=${book}`
            }
            return '';
        }
        /**
         * Validate the response from the server
         */
        const validateResponse = (response: any) => {
            if (response.error) {
                throw new Error('API Error: ' + response.error);
            }
            return response;
        }
        /**
         * Get merged sources
         */
        const getMergedSources = (newSource: Source) => {
            const mergedSources = [
                ...getExistingSources(),
                newSource
            ];
            return mergedSources
                .filter((source: Source, index: number, self: Source[]) =>
                    index === self.findIndex((element: Source) => (
                        element.uuid === source.uuid
                    ))
                );
        }
        try {
            const requestUrl = getRequestUrl();
            const exisitingSources = getExistingSources();
            // If there are no request parameters, just get the existing sources
            if (requestUrl === '') {
                setSources(exisitingSources);
                setSourceCount(exisitingSources.length);
                return;
            }
            // Fetch the sources from the server
            fetch('https://mlagenerator.com/api' + requestUrl)
                .then(response => response.json())
                .then(validateResponse)
                .then(getMergedSources)
                .then(mergedSources => {
                    setSources(mergedSources);
                    setSourceCount(mergedSources.length);
                    localStorage.setItem('sources', JSON.stringify(mergedSources));
                })
                .catch(error => {
                    console.error('Caught error:', error);
                    // If there is an error with the server, just get the existing sources
                    setSources(exisitingSources);
                });

        }
        catch (error) {
            console.error('Caught error:', error);
        }
    }, []);

    const selectAllSources = (event: React.ChangeEvent<HTMLInputElement>) => {
        const checkboxes = document.querySelectorAll(`.${styles.citationSourceItem} input[type="checkbox"]`);
        const checked = event.target.checked;
        checkboxes.forEach((checkbox: HTMLInputElement) => {
            checkbox.checked = checked;
        });
        if (checked) {
            setSourceCount(sources.length);
            setCheckedCount(sources.length);
        }
        else {
            setCheckedCount(0);
        }
    }

    const updateCheckedCount = (event: React.ChangeEvent<HTMLInputElement>) => {
        const checkedAmount = checkedCount + (event.target.checked ? 1 : -1);
        setCheckedCount(checkedAmount);
        setSourceCount(checkedAmount > 0 ? checkedAmount : sources.length);

        if (selectAllRef.current && checkedAmount === sources.length) {
            selectAllRef.current.checked = true;
        }
        else {
            selectAllRef.current.checked = false;
        }
    }

    // const handleSearch = (event: React.ChangeEvent<HTMLInputElement>) => {
    //     const search = event.target.value.toLowerCase();
    //     const filteredSources = sources.filter((source: Source) => {
    //         const formattedSource = formatSource(source, 'mla').toLowerCase();
    //         return formattedSource.includes(search);
    //     });
    //     setSources(filteredSources);
    // }

    // const handleSearchFocusWithin = (event: React.FocusEvent<HTMLInputElement>) => {
    //     const target = event.currentTarget;
    //     const searchBox = target.querySelector('input[type="text"]') as HTMLInputElement;
    //     target.classList.add(styles.open);
    //     searchBox.focus();
    //     searchBox.addEventListener('focusout', () => {
    //         target.classList.remove(styles.open);
    //     });
    // }

    const handleDelete = (event: React.MouseEvent<HTMLButtonElement>) => {
        const checkboxes = document.querySelectorAll(`.${styles.citationSourceItem} input[type="checkbox"]`);
        checkboxes.forEach((checkbox: HTMLInputElement) => {
            if (checkbox.checked) {
                const index = sources.findIndex((source: Source) => source.uuid === checkbox.id);
                sources.splice(index, 1);
                setSourceCount(sources.length);
                setCheckedCount(checkedCount - 1);
            }
        });
        setSources(sources);
        localStorage.setItem('sources', JSON.stringify(sources));
    }

    const copySelected = (event: React.MouseEvent<HTMLButtonElement>) => {
        const checkboxes = document.querySelectorAll(`.${styles.citationSourceItem} input[type="checkbox"]`);
        const copyArea = document.querySelector(`#${styles.copyArea}`) as HTMLDivElement;
        // Clear the copy area
        while (copyArea.firstChild) {
            copyArea.removeChild(copyArea.firstChild);
        }
        // Add the selected sources to the copy area
        Array.from(checkboxes).forEach((checkbox: HTMLInputElement, index: number) => {
            if (checkbox.checked) {
                let pre = document.createElement('pre');
                pre.innerHTML = formatSource(sources[index], citationFormat);
                pre.classList.add(styles.citationSource);
                copyArea.appendChild(pre);
            }
        });
        // copy the text to the clipboard with all its formatting
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(copyArea);
        selection!.removeAllRanges();
        selection!.addRange(range);
        document.execCommand('copy');
    }

    const copy = (event: React.MouseEvent<HTMLButtonElement>) => {
        const parent = event.currentTarget.closest('li') as HTMLLIElement;
        const pre = parent.querySelector('pre') as HTMLPreElement;
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(pre);
        selection!.removeAllRanges();
        selection!.addRange(range);
        document.execCommand('copy');
    }

    const ReferenceTitleButtons = () => {
        return checkedCount > 0 ? (
            <div className={styles.referenceTitleButtons}>
                <button className={styles.button} onClick={copySelected}>
                    <ClipboardIcon className={styles.icon} />
                    <span>Copy selected</span>
                </button>
                <button className={styles.button} onClick={handleDelete}>
                    <TrashIcon className={styles.icon} />
                    <span>Delete</span>
                </button>
            </div>
        ) : (
            <div className={styles.referenceTitleButtons}>
                {/* <button className={styles.button}>
                    <ArrowPathRoundedSquareIcon className={styles.icon} />
                    <span>Sort</span>
                </button>
                <button className={styles.button}>
                    <FunnelIcon className={styles.icon} />
                    <span>Filter</span>
                </button>
                <div className={styles.searchContainer} onFocus={handleSearchFocusWithin}>
                    <button className={styles.button}>
                        <MagnifyingGlassIcon className={styles.icon} />
                    </button>
                    <input type="text" placeholder="Search" className={styles.search} onChange={handleSearch} />
                </div>   */}
            </div>
        )
    }

    return (
        <div className={styles.container}>
            <CitationSearch includeDropdown={false} includeManualCite={false} ref={citationFormatRef} />
            <div className={styles.referencesContainer}>
                <h2 className="heading-2">References</h2>
                <Dropdown
                    options={citationStyles}
                    value={citationStyles.find((option: Option) => option.value === citationFormat)}
                    className={styles.dropdown}
                    onChange={(option: Option) => {
                        if (citationFormatRef.current) {
                            citationFormatRef.current.value = option.value;
                            setCitationFormat(option.value);
                            // change the query parameter for format to the selected value
                            const url = new URL(window.location.href);
                            url.searchParams.set('citationStyle', option.value);
                            window.history.pushState({}, '', url.toString());
                        }
                    }}
                />
                <div className={styles.referenceTitle}>
                    <label className={styles.citation}>
                        <input type="checkbox" className={styles.checkboxElement} onChange={selectAllSources} ref={selectAllRef} />
                        <div className={styles.checkbox}></div>
                        <span>{sourceCount} source{checkedCount == 1 || sourceCount == 1 ? '' : 's'} {checkedCount > 0 ? 'selected' : ''}</span>
                    </label>
                    <ReferenceTitleButtons />
                </div>
                {sources.length > 0 && (
                    <ul className={styles.citationSourceContainer}>
                        {sources.map((source: Source, index: number) => (
                            <li key={index} className={styles.citationSourceItem}>
                                <label className={styles.citation}>
                                    <input type="checkbox" className={styles.checkboxElement} onChange={updateCheckedCount} />
                                    <div className={styles.checkbox}></div>
                                    <div className={styles.citationSourceWrapper}>
                                        <pre dangerouslySetInnerHTML={{ __html: formatSource(source, citationFormat) }} className={styles.citationSource}></pre>
                                    </div>
                                </label>
                                <div className={styles.citationSourceButtons}>
                                    {/* <button>Edit</button> */}
                                    <button className={styles.button} onClick={copy}>
                                        <ClipboardIcon className={styles.icon} />
                                        <span>Copy</span>
                                    </button>
                                    {/* <button className={styles.button}>
                                    <PencilIcon className={styles.icon} />
                                    <span>Edit</span>
                                </button> */}
                                    {source.citationInfo.url && (
                                        <a className={styles.button} href={source.citationInfo.url} target="_blank" rel="noreferrer">
                                            <GlobeAltIcon className={styles.icon} />
                                            <span>Visit Site</span>
                                        </a>
                                    )}
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
            <div id={styles.copyArea}></div>
        </div>
    )
}


/*

TODO:
 - (done) Remove dropdown from <CitationSearch /> on the references page
 - (done) Improve font used on references page (similar to scribbr)
 - Change from /citations to /my-references
 - (done) Fix dropdown for format selector
 - (done) Implement dynamic island of references buttons, so when the users clicks [] sources button, the buttons change to copy all, etc
 - (done) Replace Copy all button and replace with sort, filter, and group buttons, in addition to search
 - Handle "invalid" responses from the server
 - Implement copy to clipboard functionality
 - Implement search functionality
 - Break into logical subcomponents
 - (done) Handle when user goes to "cite manually" -- no query params
 - Handle when info is missing and the user must manually enter it
 */