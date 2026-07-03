import React, { memo, useEffect, useRef } from 'react';
import EditReferenceDialogDrawer from './EditReferenceDialogDrawer';
import { useFormattedCitation } from '../../lib/citations/useFormattedCitation';
import type { StoredSource } from '../../lib/references/storage';
import type { SupportedStyle } from '../../lib/citations/csl-types';
import styles from '../../styles/references.module.css';
import { AlertTriangle, Clipboard, Globe } from 'lucide-react';
import { escapeHtml, richTextToHtml, richTextToPlain } from './richText';
import { copyRichText } from './clipboard';
import { visibleCitationWarnings } from '../../lib/references/warnings';

interface Props {
    source: StoredSource;
    checked: boolean;
    onToggle: (uuid: string, checked: boolean) => void;
    citationFormat: SupportedStyle;
    setSources: (s: StoredSource[] | ((prev: StoredSource[]) => StoredSource[])) => void;
    autoOpenEdit?: boolean;
}

function ReferenceItem({ source, checked, onToggle, citationFormat, setSources, autoOpenEdit }: Props) {
    const editButtonRef = useRef<HTMLButtonElement>(null);
    const { formatted, loading, error } = useFormattedCitation(source, citationFormat);
    const visibleWarnings = visibleCitationWarnings(source.quality?.warnings, source.dismissedWarningKeys);
    const fieldWarnings = visibleWarnings.filter((warning) => warning.field && warning.severity !== 'info');
    const topFieldWarning = fieldWarnings[0];
    const hasFieldWarnings = fieldWarnings.length > 0;
    const warningLabel = topFieldWarning?.severity === 'error'
        ? 'Citation is missing required information'
        : 'Citation has fields to review';

    useEffect(() => {
        if (autoOpenEdit && editButtonRef.current) editButtonRef.current.click();
    }, [source.uuid, autoOpenEdit]);

    const handleCopy = async (event: React.MouseEvent<HTMLButtonElement>) => {
        // Don't copy an empty/placeholder citation while it is still loading or
        // errored — that would wipe the clipboard while showing "Copied".
        if (loading || error || formatted.length === 0) return;
        // Capture the label span before awaiting: React resets the synthetic
        // event's currentTarget once the handler returns.
        const targetSpan = event.currentTarget.querySelector('span');
        const ok = await copyRichText(richTextToHtml(formatted), richTextToPlain(formatted));
        if (!ok || !targetSpan) return;
        const current = targetSpan.textContent;
        targetSpan.textContent = 'Copied';
        setTimeout(() => { targetSpan.textContent = current; }, 1000);
    };

    return (
        <li className={styles.citationSourceItem}>
            <label className={styles.citation}>
                <input
                    type="checkbox"
                    id={`source-${source.uuid}`}
                    className={styles.checkboxElement}
                    checked={checked}
                    onChange={(e) => onToggle(source.uuid, e.target.checked)}
                    aria-label={`Select reference: ${source.csl.title || 'untitled'}`}
                />
                <div className={styles.checkbox} aria-hidden="true"></div>
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
                    {hasFieldWarnings && (
                        <span
                            className={styles.qualityIndicator}
                            data-severity={topFieldWarning?.severity || 'review'}
                            role="img"
                            aria-label={warningLabel}
                            title={warningLabel}
                        >
                            <AlertTriangle className={styles.qualityIcon} aria-hidden="true" />
                        </span>
                    )}
                </div>
            </label>
            <div className={styles.citationSourceButtons}>
                <button
                    className={styles.button}
                    onClick={handleCopy}
                    disabled={loading || !!error}
                    aria-label="Copy citation"
                >
                    <Clipboard className={styles.icon} />
                    <span>Copy</span>
                </button>
                <EditReferenceDialogDrawer source={source} setSources={setSources} ref={editButtonRef} />
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

// Memoized so editing one citation doesn't re-render every row. `source`,
// `setSources`, and `onToggle` identities are stable per uuid; `checked` and
// `autoOpenEdit` are primitives that only change for the affected row.
export default memo(ReferenceItem);
