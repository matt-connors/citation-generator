import React, { useRef, useState } from 'react';
import { ClipboardIcon, TrashIcon } from '@heroicons/react/24/outline';
import styles from '../../styles/references.module.css';
import type { Option } from './Dropdown';
import citationStyles from '../citationStyles';
import Dropdown from './Dropdown';
import CitationSearch from './CitationSearch';
import ReferenceItem from './ReferenceItem';
import { useReferences } from '../../lib/references/useReferences';
import { Clipboard, Plus, Trash, Trash2 } from 'lucide-react';
import { cn } from './utils';
import { Button } from './Button';
import type { Source, PublicationDate } from '../../lib/citations/definitions';

// Generate a new empty citation
function createEmptyCitation(): Source {
    const emptyDate: PublicationDate = {
        context: { prefix: '', matchedText: '' },
        date: { year: 0, month: 0, day: 0 }
    };

    return {
        uuid: crypto.randomUUID(),
        citationType: 'website',
        citationInfo: {
            authors: [],
            sourceTitle: '',
            publisher: '',
            publicationDate: emptyDate,
            accessDate: { year: 0, month: 0, day: 0 },
            url: ''
        }
    };
}

export default function References() {
    const {
        sources,
        sourceCount,
        checkedCount,
        citationFormat,
        setSources,
        setCheckedCount,
        setCitationFormat,
        handleDelete,
        copySelected
    } = useReferences();

    const [lastAddedId, setLastAddedId] = useState<string | null>(null);
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

    const handleAddManually = () => {
        const newSource = createEmptyCitation();
        const updatedSources = [...sources, newSource];
        setSources(updatedSources);
        setLastAddedId(newSource.uuid);
        // Save to localStorage
        localStorage.setItem('sources', JSON.stringify(updatedSources));
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
                        <Clipboard className={cn(styles.icon, "transform translate-y-[1px]")} />
                        <span>Copy selected</span>
                    </button>
                    <button 
                        className={styles.button} 
                        onClick={handleDelete}
                        aria-label="Delete selected references"
                    >
                        <Trash2 className={cn(styles.icon, "transform translate-y-[1px]")} />
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
                    <Button 
                        className="leading-none shadow-none text-white bg-primary rounded-lg flex gap-3 ml-7"
                        onClick={handleAddManually}
                    >
                        <Plus size={19} />
                        <span>Add Manually</span>
                    </Button>
                </div>
                {sources.length > 0 && (
                    <ul className={styles.citationSourceContainer} role="list">
                        {sources.map((source, index) => (
                            <ReferenceItem
                                key={source.uuid}
                                source={source}
                                sources={sources}
                                setSources={setSources}
                                index={index}
                                citationFormat={citationFormat}
                                onCheckChange={handleCheckChange}
                                autoOpenEdit={source.uuid === lastAddedId}
                            />
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}