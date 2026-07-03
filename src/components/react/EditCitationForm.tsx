import React, { useState, useCallback, useEffect, useRef } from 'react';
import type { StoredSource } from '../../lib/references/storage';
import type { CitationQualityWarning, CSLItem } from '../../lib/citations/csl-types';
import {
    Title,
    WebsiteName,
    Contributors,
    URL as UrlField,
    Line,
    PublicationDate,
    AccessDate,
    Edition,
    VolumeNumber,
    IssueNumber,
    PageRange,
    Publisher,
    JournalName,
    DOI,
    type FieldWarning,
} from './EditCitationFormComponents';
import { useDebounce } from '../../hooks/useDebounce';
import SimpleDropdown from './SimpleDropdown';
import {
    isCitationWarningDismissed,
    isDismissibleCitationWarning,
    warningDismissalKey,
} from '../../lib/references/warnings';

interface CitationOption { label: string; value: CSLItem['type']; }

const TYPE_OPTIONS: CitationOption[] = [
    { label: 'Website', value: 'webpage' },
    { label: 'Book', value: 'book' },
    { label: 'Journal Article', value: 'article-journal' },
];

interface Props {
    source: StoredSource;
    setSources: (s: StoredSource[] | ((prev: StoredSource[]) => StoredSource[])) => void;
    // Parent ref populated with the latest in-flight CSL on every render. The
    // dialog/drawer reads it on close to decide empty-vs-flush before the
    // debounced 500ms timer would have fired — otherwise typed input is lost
    // (citation removed as "still empty") or stale (form unmount cancels timer).
    currentRef?: React.MutableRefObject<CSLItem | null>;
}

export default function EditCitationForm({ source, setSources, currentRef }: Props) {
    const [local, setLocal] = useState<CSLItem>(source.csl);
    const dismissWarning = useCallback((warningKey: string) => {
        setSources((prev) => prev.map((item) => {
            if (item.uuid !== source.uuid) return item;
            const existing = item.dismissedWarningKeys ?? [];
            if (existing.includes(warningKey)) return item;
            return { ...item, dismissedWarningKeys: [...existing, warningKey] };
        }));
    }, [setSources, source.uuid]);
    const fieldWarnings = warningMapFor(source.quality?.warnings ?? [], local, source.dismissedWarningKeys, dismissWarning);

    // Read the latest `local` via ref inside the debounced flush so the 500ms
    // timer always writes the most recent state, regardless of how many
    // intervening patches happened (functional setLocal + ref instead of
    // closure-captured `local` avoids dropping characters under rapid typing).
    const localRef = useRef(local);
    useEffect(() => {
        localRef.current = local;
        if (currentRef) currentRef.current = local;
    }, [local, currentRef]);

    const debouncedSet = useDebounce(() => {
        setSources((prev) => prev.map((s) => s.uuid === source.uuid ? { ...s, csl: localRef.current } : s));
    }, 500);

    const patch = useCallback((p: Partial<CSLItem>) => {
        setLocal((prev) => ({ ...prev, ...p } as CSLItem));
        debouncedSet();
    }, [debouncedSet]);

    const handleTypeChange = (t: CSLItem['type']) => patch({ type: t });

    return (
        // data-vaul-no-drag tells vaul to skip its drag-to-dismiss detection
        // for touches anywhere inside the form. Without it, tapping a dropdown
        // trigger or input doesn't reliably register on the first tap — vaul's
        // shouldDrag walks up the DOM, finds the ScrollArea viewport with
        // scrollTop=0, and treats the touch as a potential dismiss instead of
        // forwarding the click to the control.
        <div data-vaul-no-drag className="flex flex-col gap-4 w-full pt-8">
            <div className="flex flex-col gap-1 sm:grid sm:grid-cols-[130px_1fr] sm:items-center sm:gap-4">
                <span className="flex flex-col leading-4 text-sm">
                    Source Type
                    <span className="text-xs text-muted-foreground">Required</span>
                </span>
                <SimpleDropdown
                    options={TYPE_OPTIONS}
                    value={TYPE_OPTIONS.find((o) => o.value === local.type)}
                    onChange={(o: CitationOption) => handleTypeChange(o.value)}
                    placeholder="Source Type"
                    className="min-w-0 sm:min-w-[7rem]"
                />
            </div>
            <Line className="my-4" />
            <Title value={local.title || ''} onChange={(v) => patch({ title: v })} isRequired warning={fieldWarnings.title} />
            {local.type === 'webpage' && (
                <WebsiteName value={local['container-title'] || ''} onChange={(v) => patch({ 'container-title': v })} warning={fieldWarnings['container-title']} />
            )}
            <Line className="my-4" />
            <Contributors authors={local.author ?? []} onChange={(next) => patch({ author: next })} warning={fieldWarnings.author} />
            <Line className="my-4" />
            <PublicationDate value={local.issued} onChange={(d) => patch({ issued: d })} isRecommended warning={fieldWarnings.issued} />
            <AccessDate value={local.accessed} onChange={(d) => patch({ accessed: d })} />
            <Line className="my-4" />
            {(local.type === 'webpage' || local.type === 'book' || local.type === 'article-journal') && (
                <UrlField value={local.URL || ''} onChange={(v) => patch({ URL: v })} isRecommended warning={fieldWarnings.URL} />
            )}
            {local.type === 'book' && (
                <>
                    <Edition value={local.edition || ''} onChange={(v) => patch({ edition: v })} warning={fieldWarnings.edition} />
                    <VolumeNumber value={local.volume || ''} onChange={(v) => patch({ volume: v })} warning={fieldWarnings.volume} />
                    <Publisher value={local.publisher || ''} onChange={(v) => patch({ publisher: v })} isRecommended warning={fieldWarnings.publisher} />
                    <DOI value={local.DOI || ''} onChange={(v) => patch({ DOI: v })} warning={fieldWarnings.DOI} />
                </>
            )}
            {local.type === 'article-journal' && (
                <>
                    <JournalName value={local['container-title'] || ''} onChange={(v) => patch({ 'container-title': v })} isRecommended warning={fieldWarnings['container-title']} />
                    <VolumeNumber value={local.volume || ''} onChange={(v) => patch({ volume: v })} isRecommended warning={fieldWarnings.volume} />
                    <IssueNumber value={local.issue || ''} onChange={(v) => patch({ issue: v })} warning={fieldWarnings.issue} />
                    <PageRange value={local.page || ''} onChange={(v) => patch({ page: v })} isRecommended warning={fieldWarnings.page} />
                    <DOI value={local.DOI || ''} onChange={(v) => patch({ DOI: v })} isRecommended warning={fieldWarnings.DOI} />
                </>
            )}
        </div>
    );
}

function warningMapFor(
    warnings: CitationQualityWarning[],
    csl: CSLItem,
    dismissedWarningKeys: readonly string[] | undefined,
    onDismissWarning: (warningKey: string) => void,
): Partial<Record<keyof CSLItem, FieldWarning>> {
    const out: Partial<Record<keyof CSLItem, FieldWarning>> = {};
    for (const warning of warnings) {
        if (isCitationWarningDismissed(warning, dismissedWarningKeys)) continue;
        if (!warning.field || warningResolved(warning, csl)) continue;
        const warningKey = warningDismissalKey(warning);
        const dismissible = isDismissibleCitationWarning(warning);
        const next = {
            message: conciseWarningMessage(warning),
            severity: warning.severity,
            dismissible,
            onDismiss: dismissible ? () => onDismissWarning(warningKey) : undefined,
        };
        const current = out[warning.field];
        if (!current || severityRank(next.severity) > severityRank(current.severity)) {
            out[warning.field] = next;
        }
    }
    return out;
}

function conciseWarningMessage(warning: CitationQualityWarning): string {
    switch (warning.code) {
        case 'title_missing':
            return 'Add the source title before using this citation.';
        case 'author_not_found':
            return 'Add the listed author or organization, if the source has one.';
        case 'date_not_found':
            return 'Add the published or updated date, if the source lists one.';
        case 'url_missing':
            return 'Add the source URL.';
        case 'journal_title_missing':
            return 'Add the journal name.';
        case 'journal_volume_missing':
            return 'Add the volume number if the source lists one.';
        case 'journal_locator_missing':
            return 'Add a page range, DOI, or URL if one is available.';
        case 'issued_conflict':
            return 'Multiple dates were found; confirm the date shown here.';
        case 'author_conflict':
            return 'Multiple author values were found; confirm this list.';
        case 'DOI_conflict':
            return 'Multiple DOIs were found; confirm this value.';
        case 'title_conflict':
            return 'Multiple titles were found; confirm this title.';
        default:
            if (warning.code.endsWith('_conflict')) return 'Conflicting source data was found; confirm this value.';
            return warning.message;
    }
}

function warningResolved(warning: CitationQualityWarning, csl: CSLItem): boolean {
    if (!warning.code.includes('missing') && !warning.code.includes('not_found')) return false;
    const field = warning.field;
    if (warning.code === 'journal_locator_missing') {
        return hasStringValue(csl.page) || hasStringValue(csl.DOI) || hasStringValue(csl.URL);
    }
    if (field === 'author') return hasAuthorValue(csl.author);
    if (field === 'issued') return !!csl.issued?.['date-parts']?.[0]?.[0] || !!csl.issued?.literal || !!csl.issued?.raw;
    const value = field ? csl[field] : undefined;
    return hasStringValue(value);
}

function hasStringValue(value: unknown): boolean {
    return typeof value === 'string' && value.trim().length > 0;
}

function hasAuthorValue(author: CSLItem['author']): boolean {
    return Array.isArray(author) && author.some((name) => {
        if ('literal' in name) return hasStringValue(name.literal);
        return hasStringValue(name.family) || hasStringValue(name.given);
    });
}

function severityRank(severity: FieldWarning['severity']): number {
    if (severity === 'error') return 4;
    if (severity === 'warning') return 3;
    if (severity === 'review') return 2;
    if (severity === 'info') return 1;
    return 0;
}
