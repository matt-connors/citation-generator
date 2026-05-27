import React, { useEffect, useRef } from 'react';
import EditReferenceDialogDrawer from './EditReferenceDialogDrawer';
import { useFormattedCitation } from '../../lib/citations/useFormattedCitation';
import type { StoredSource } from '../../lib/references/storage';
import type { SupportedStyle, RichText } from '../../lib/citations/csl-types';
import styles from '../../styles/references.module.css';
import { Clipboard, Globe } from 'lucide-react';

interface Props {
    source: StoredSource;
    sources: StoredSource[];
    index: number;
    citationFormat: SupportedStyle;
    onCheckChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
    setSources: (s: StoredSource[] | ((prev: StoredSource[]) => StoredSource[])) => void;
    autoOpenEdit?: boolean;
}

function richTextToHtml(rt: RichText[]): string {
    return rt.map((seg) => seg.italic ? `<i>${escapeHtml(seg.text)}</i>` : escapeHtml(seg.text)).join('');
}

function escapeHtml(s: string): string {
    return s.replace(/[&<>"']/g, (c) =>
        c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : '&#39;');
}

function copyRichText(rt: RichText[]) {
    const html = richTextToHtml(rt);
    const div = document.createElement('div');
    div.style.cssText = 'position:fixed;left:-9999px;font-family:"Times New Roman",Times,serif;font-size:12pt;line-height:2;';
    div.innerHTML = html;
    document.body.appendChild(div);
    const range = document.createRange();
    range.selectNodeContents(div);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
    document.execCommand('copy');
    document.body.removeChild(div);
    sel?.removeAllRanges();
}

export default function ReferenceItem({ source, sources, index, citationFormat, onCheckChange, setSources, autoOpenEdit }: Props) {
    const editButtonRef = useRef<HTMLButtonElement>(null);
    const { formatted, loading, error } = useFormattedCitation(source, citationFormat);

    useEffect(() => {
        if (autoOpenEdit && editButtonRef.current) editButtonRef.current.click();
    }, [source.uuid, autoOpenEdit]);

    const handleCopy = (event: React.MouseEvent<HTMLButtonElement>) => {
        const target = event.currentTarget;
        const targetSpan = target.querySelector('span') as HTMLSpanElement;
        const current = targetSpan.textContent;
        copyRichText(formatted);
        targetSpan.textContent = 'Copied';
        setTimeout(() => { targetSpan.textContent = current; }, 1000);
    };

    return (
        <li className={styles.citationSourceItem}>
            <label className={styles.citation}>
                <input
                    type="checkbox"
                    id={`source-${index}`}
                    className={styles.checkboxElement}
                    onChange={onCheckChange}
                />
                <div className={styles.checkbox}></div>
                <div className={styles.citationSourceWrapper}>
                    <pre
                        className={styles.citationSource}
                        dangerouslySetInnerHTML={{
                            __html: error
                                ? `Failed to format citation: ${escapeHtml(error)}`
                                : loading
                                    ? 'Loading…'
                                    : richTextToHtml(formatted),
                        }}
                    />
                </div>
            </label>
            <div className={styles.citationSourceButtons}>
                <button
                    className={styles.button}
                    onClick={handleCopy}
                    aria-label="Copy citation"
                >
                    <Clipboard className={styles.icon} />
                    <span>Copy</span>
                </button>
                <EditReferenceDialogDrawer source={source} sources={sources} setSources={setSources} ref={editButtonRef} />
                {source.csl.URL && (
                    <a
                        className={styles.button}
                        href={source.csl.URL.startsWith('http') ? source.csl.URL : `https://${source.csl.URL}`}
                        target="_blank"
                        rel="noreferrer"
                        aria-label="Visit source website"
                    >
                        <Globe className={styles.icon} />
                        <span>Visit Site</span>
                    </a>
                )}
            </div>
        </li>
    );
}
