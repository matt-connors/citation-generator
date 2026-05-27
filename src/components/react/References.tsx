import React, { useRef, useState } from 'react';
import styles from '../../styles/references.module.css';
import citationStyles from '../citationStyles';
import Dropdown from './Dropdown';
import CitationSearch from './CitationSearch';
import ReferenceItem from './ReferenceItem';
import { useReferences } from '../../lib/references/useReferences';
import type { StoredSource } from '../../lib/references/storage';
import type { SupportedStyle } from '../../lib/citations/csl-types';
import { Clipboard, Plus, Trash2 } from 'lucide-react';
import { cn } from './utils';
import { Button } from './Button';

function emptySource(): StoredSource {
    const id = crypto.randomUUID();
    return { uuid: id, csl: { id, type: 'webpage' } };
}

function escape(s: string): string {
    return s.replace(/[&<>"']/g, (c) => c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : '&#39;');
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
    } = useReferences();
    const [lastAddedId, setLastAddedId] = useState<string | null>(null);
    const citationFormatRef = useRef<HTMLInputElement>(null);
    const selectAllRef = useRef<HTMLInputElement>(null);

    const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
        const checkboxes = document.querySelectorAll(`.${styles.citationSourceItem} input[type="checkbox"]`);
        const checked = event.target.checked;
        checkboxes.forEach((cb: any) => { cb.checked = checked; });
        setCheckedCount(checked ? sources.length : 0);
    };

    const handleCheckChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const amount = checkedCount + (event.target.checked ? 1 : -1);
        setCheckedCount(amount);
        if (selectAllRef.current) selectAllRef.current.checked = amount === sources.length;
    };

    const handleCopySelected = async () => {
        const selected = sources.filter((_, i) => (document.querySelector(`#source-${i}`) as HTMLInputElement | null)?.checked);
        if (!selected.length) return;
        // Request formatted versions in parallel
        const results = await Promise.all(selected.map(async (s) => {
            const res = await fetch('/api/format', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ csl: s.csl, style: citationFormat }),
            });
            if (!res.ok) return '';
            const body = await res.json();
            return (body.formatted as Array<{ text: string; italic?: boolean }>)
                .map((seg) => seg.italic ? `<i>${escape(seg.text)}</i>` : escape(seg.text)).join('');
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
                    {checkedCount > 0 && (
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
                        {sources.map((source, i) => (
                            <ReferenceItem
                                key={source.uuid}
                                source={source}
                                sources={sources}
                                setSources={setSources}
                                index={i}
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
