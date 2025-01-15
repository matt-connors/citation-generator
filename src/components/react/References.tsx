import React, { useRef } from 'react';
import { ClipboardIcon, TrashIcon } from '@heroicons/react/24/outline';
import styles from '../../styles/references.module.css';
import type { Option } from './Dropdown';
import citationStyles from '../citationStyles';
import Dropdown from './Dropdown';
import CitationSearch from './CitationSearch';
import ReferenceItem from './ReferenceItem';
import { useReferences } from '../../lib/references/useReferences';

export default function References() {
    const {
        sources,
        sourceCount,
        checkedCount,
        citationFormat,
        setCheckedCount,
        setCitationFormat,
        handleDelete,
        copySelected
    } = useReferences();

    const citationFormatRef = useRef<HTMLInputElement>(null);
    const selectAllRef = useRef<HTMLInputElement>(null);

    const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
        const checkboxes = document.querySelectorAll(`.${styles.citationSourceItem} input[type="checkbox"]`);
        const checked = event.target.checked;
        checkboxes.forEach((checkbox: HTMLInputElement) => {
            checkbox.checked = checked;
        });
        setCheckedCount(checked ? sources.length : 0);
    };

    const handleCheckChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const checkedAmount = checkedCount + (event.target.checked ? 1 : -1);
        setCheckedCount(checkedAmount);

        if (selectAllRef.current) {
            selectAllRef.current.checked = checkedAmount === sources.length;
        }
    };

    const handleCopySelected = () => {
        copySelected(() => {
            const copyButton = document.querySelector('[data-copy-selected]');
            if (copyButton) {
                const span = copyButton.querySelector('span');
                if (span) {
                    const currentText = span.textContent;
                    span.textContent = 'Copied selected';
                    setTimeout(() => {
                        span.textContent = currentText;
                    }, 1000);
                }
            }
        });
    };

    const ReferenceTitleButtons = () => {
        if (checkedCount > 0) {
            return (
                <div className={styles.referenceTitleButtons}>
                    <button 
                        className={styles.button} 
                        onClick={handleCopySelected}
                        data-copy-selected
                        aria-label="Copy selected references"
                    >
                        <ClipboardIcon className={styles.icon} />
                        <span>Copy selected</span>
                    </button>
                    <button 
                        className={styles.button} 
                        onClick={handleDelete}
                        aria-label="Delete selected references"
                    >
                        <TrashIcon className={styles.icon} />
                        <span>Delete</span>
                    </button>
                </div>
            );
        }
        return null;
    };

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
                            const url = new URL(window.location.href);
                            url.searchParams.set('citationStyle', option.value);
                            window.history.pushState({}, '', url.toString());
                        }
                    }}
                />
                <div className={styles.referenceTitle}>
                    <label className={styles.citation}>
                        <input 
                            type="checkbox" 
                            className={styles.checkboxElement} 
                            onChange={handleSelectAll} 
                            ref={selectAllRef}
                            aria-label="Select all references"
                        />
                        <div className={styles.checkbox}></div>
                        <span>
                            {sourceCount} source{sourceCount === 1 ? '' : 's'} 
                            {checkedCount > 0 ? ' selected' : ''}
                        </span>
                    </label>
                    <ReferenceTitleButtons />
                </div>
                {sources.length > 0 && (
                    <ul className={styles.citationSourceContainer} role="list">
                        {sources.map((source, index) => (
                            <ReferenceItem
                                key={source.uuid}
                                source={source}
                                index={index}
                                citationFormat={citationFormat}
                                onCheckChange={handleCheckChange}
                            />
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
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