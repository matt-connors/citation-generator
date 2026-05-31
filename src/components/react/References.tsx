import React, { useEffect, useRef, useState } from 'react';
import styles from '../../styles/references.module.css';
import citationStyles from '../citationStyles';
import Dropdown from './Dropdown';
import CitationSearch from './CitationSearch';
import ReferenceItem from './ReferenceItem';
import { useReferences } from '../../lib/references/useReferences';
import type { StoredSource } from '../../lib/references/storage';
import type { SupportedStyle } from '../../lib/citations/csl-types';
import { formatCitation } from '../../lib/citations/useFormattedCitation';
import { Clipboard, Plus, Trash2 } from 'lucide-react';
import { cn } from './utils';
import { Button } from './Button';
import { richTextToHtml } from './richText';

function emptySource(): StoredSource {
    const id = crypto.randomUUID();
    return { uuid: id, csl: { id, type: 'webpage' } };
}

export default function References() {
    const {
        sources,
        sourceCount,
        selected,
        selectedCount,
        citationFormat,
        setSources,
        toggleSelected,
        selectAll,
        setCitationFormat,
        handleDelete,
    } = useReferences();
    const [lastAddedId, setLastAddedId] = useState<string | null>(null);
    const citationFormatRef = useRef<HTMLInputElement>(null);
    const selectAllRef = useRef<HTMLInputElement>(null);

    // `indeterminate` has no React prop; sync it imperatively when selection changes.
    useEffect(() => {
        if (selectAllRef.current) {
            selectAllRef.current.indeterminate = selectedCount > 0 && selectedCount < sourceCount;
        }
    }, [selectedCount, sourceCount]);

    const handleCopySelected = async () => {
        const items = sources.filter((s) => selected.has(s.uuid));
        if (!items.length) return;
        // Reuses the same module-level cache as the per-item hook, so visible
        // items are zero-network.
        const results = await Promise.all(items.map(async (s) => {
            try {
                const rt = await formatCitation({ uuid: s.uuid, csl: s.csl }, citationFormat);
                return richTextToHtml(rt);
            } catch {
                return '';
            }
        }));
        const tempDiv = document.createElement('div');
        tempDiv.style.cssText = 'position:fixed;left:-9999px;font-family:"Times New Roman",Times,serif;font-size:12pt;line-height:2;';
        tempDiv.innerHTML = results.filter(Boolean).join('<br><br>');
        document.body.appendChild(tempDiv);
        const range = document.createRange();
        range.selectNodeContents(tempDiv);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
        document.execCommand('copy');
        document.body.removeChild(tempDiv);
        sel?.removeAllRanges();
        const span = document.querySelector('[data-copy-selected] span');
        if (span) {
            const current = span.textContent;
            span.textContent = 'Copied selected';
            setTimeout(() => { span.textContent = current; }, 1000);
        }
    };

    const handleAddManually = () => {
        const next = emptySource();
        setSources((prev) => [...prev, next]);
        setLastAddedId(next.uuid);
    };

    const allSelected = sourceCount > 0 && selectedCount === sourceCount;

    return (
        <div className={styles.container}>
            <CitationSearch includeDropdown={false} includeManualCite={false} ref={citationFormatRef} />
            <div className={styles.referencesContainer}>
                <h2 className="heading-2">References</h2>
                <Dropdown
                    options={citationStyles}
                    value={citationStyles.find((o) => o.value === citationFormat)}
                    className={styles.dropdown}
                    onChange={(o: any) => {
                        if (citationFormatRef.current) citationFormatRef.current.value = o.value;
                        setCitationFormat(o.value as SupportedStyle);
                        const url = new URL(window.location.href);
                        url.searchParams.set('citationStyle', o.value);
                        window.history.pushState({}, '', url.toString());
                    }}
                />
                <div className={styles.referenceTitle}>
                    <label className={styles.citation}>
                        <input
                            type="checkbox"
                            className={styles.checkboxElement}
                            onChange={(e) => selectAll(e.target.checked)}
                            checked={allSelected}
                            ref={selectAllRef}
                            aria-label="Select all references"
                        />
                        <div className={styles.checkbox} aria-hidden="true"></div>
                        <span>
                            {selectedCount > 0
                                ? `${selectedCount} source${selectedCount === 1 ? '' : 's'} selected`
                                : `${sourceCount} source${sourceCount === 1 ? '' : 's'}`}
                        </span>
                    </label>
                    {selectedCount > 0 && (
                        <div className={styles.referenceTitleButtons}>
                            <button
                                className={styles.button}
                                onClick={handleCopySelected}
                                data-copy-selected
                                aria-label="Copy selected references"
                            >
                                <Clipboard className={cn(styles.icon, 'transform translate-y-[1px]')} />
                                <span>Copy selected</span>
                            </button>
                            <button
                                className={styles.button}
                                onClick={handleDelete}
                                aria-label="Delete selected references"
                            >
                                <Trash2 className={cn(styles.icon, 'transform translate-y-[1px]')} />
                                <span>Delete</span>
                            </button>
                        </div>
                    )}
                    <Button
                        className="leading-none shadow-none text-white bg-primary rounded-full flex gap-3 ml-7"
                        onClick={handleAddManually}
                    >
                        <Plus size={19} />
                        <span>Add Manually</span>
                    </Button>
                </div>
                {sources.length > 0 && (
                    <ul className={styles.citationSourceContainer} role="list">
                        {sources.map((source) => (
                            <ReferenceItem
                                key={source.uuid}
                                source={source}
                                setSources={setSources}
                                checked={selected.has(source.uuid)}
                                onToggle={toggleSelected}
                                citationFormat={citationFormat}
                                autoOpenEdit={source.uuid === lastAddedId}
                            />
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}
