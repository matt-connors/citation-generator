import React, { useEffect, useRef, useState } from 'react';
import styles from '../../styles/references.module.css';
import citationStyles from '../citationStyles';
import Dropdown from './Dropdown';
import CitationSearch from './CitationSearch';
import ReferenceItem from './ReferenceItem';
import ReferenceSkeleton from './ReferenceSkeleton';
import { useReferences } from '../../lib/references/useReferences';
import type { StoredSource } from '../../lib/references/storage';
import type { SupportedStyle, RichText } from '../../lib/citations/csl-types';
import { formatCitation } from '../../lib/citations/useFormattedCitation';
import { Clipboard, Plus, Trash2 } from 'lucide-react';
import { cn } from './utils';
import { Button } from './Button';
import { richTextToHtml, richTextToPlain } from './richText';
import { copyRichText } from './clipboard';

function emptySource(): StoredSource {
    const id = crypto.randomUUID();
    return { uuid: id, csl: { id, type: 'webpage' } };
}

export default function References() {
    const {
        sources,
        pending,
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

    // Mirror the active style into the hidden search-form input so re-citing from
    // this page submits the right citationStyle. Covers the ?citationStyle=… URL-
    // seeded path, where the dropdown onChange never fired and the input stayed
    // empty (the form then silently reverted the next page to MLA).
    useEffect(() => {
        if (citationFormatRef.current) citationFormatRef.current.value = citationFormat;
    }, [citationFormat]);

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
        const rts = await Promise.all(items.map(async (s) => {
            try {
                return await formatCitation({ uuid: s.uuid, csl: s.csl }, citationFormat);
            } catch {
                return null;
            }
        }));
        const valid = rts.filter((rt): rt is RichText[] => rt !== null && rt.length > 0);
        if (!valid.length) return;
        const html = valid.map(richTextToHtml).join('<br><br>');
        const plain = valid.map(richTextToPlain).join('\n\n');
        const ok = await copyRichText(html, plain);
        if (!ok) return;
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
                {(sources.length > 0 || pending.length > 0) && (
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
                        {pending.map((p) => (
                            <ReferenceSkeleton key={p.id} url={p.url} />
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}
