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
    Medium,
    type FieldWarning,
} from './EditCitationFormComponents';
import { useDebounce } from '../../hooks/useDebounce';
import SimpleDropdown from './SimpleDropdown';
import {
    isCitationWarningDismissed,
    isDismissibleCitationWarning,
    warningDismissalKey,
} from '../../lib/references/warnings';

/** UI option id — maps to CSL type (and optional YouTube field patches). */
type SourceTypeOptionId =
    | CSLItem['type']
    | 'youtube-video';

interface CitationOption { label: string; value: SourceTypeOptionId; }

const TYPE_OPTIONS: CitationOption[] = [
    { label: 'Website', value: 'webpage' },
    { label: 'Book', value: 'book' },
    { label: 'Journal Article', value: 'article-journal' },
    { label: 'Newspaper Article', value: 'article-newspaper' },
    { label: 'Magazine Article', value: 'article-magazine' },
    { label: 'YouTube / Video', value: 'youtube-video' },
];

function isYouTubeLike(csl: CSLItem): boolean {
    if (csl.genre && /^video$/i.test(csl.genre.trim())) return true;
    if (csl['container-title'] && /^youtube$/i.test(csl['container-title'].trim())) return true;
    const url = csl.URL || csl.id || '';
    try {
        const host = new URL(url).hostname.toLowerCase();
        return host === 'youtu.be' || host === 'youtube.com' || host.endsWith('.youtube.com');
    } catch {
        return false;
    }
}

function selectedTypeOption(csl: CSLItem): CitationOption {
    if (csl.type === 'webpage' && isYouTubeLike(csl)) {
        return TYPE_OPTIONS.find((o) => o.value === 'youtube-video')!;
    }
    return TYPE_OPTIONS.find((o) => o.value === csl.type) ?? TYPE_OPTIONS[0];
}

function patchForTypeOption(option: SourceTypeOptionId, prev: CSLItem): Partial<CSLItem> {
    if (option === 'youtube-video') {
        return {
            type: 'webpage',
            genre: prev.genre?.trim() || 'Video',
            'container-title': prev['container-title']?.trim() || 'YouTube',
        };
    }
    // Leaving YouTube representation for any other type — drop video genre and
    // a pure "YouTube" container so newspaper/journal styles do not keep [Video].
    const next: Partial<CSLItem> = { type: option };
    if (prev.genre && /^video$/i.test(prev.genre.trim())) next.genre = undefined;
    if (prev['container-title'] && /^youtube$/i.test(prev['container-title'].trim())) {
        next['container-title'] = undefined;
    }
    return next;
}

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
    const typeWarning = sourceTypeWarning(source.quality?.warnings ?? [], source.dismissedWarningKeys, dismissWarning);

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
        setLocal((prev) => {
            const next = { ...prev, ...p } as CSLItem;
            // Explicit undefined clears optional fields (e.g. leaving YouTube mode).
            for (const key of Object.keys(p) as Array<keyof CSLItem>) {
                if (p[key] === undefined) delete (next as any)[key];
            }
            return next;
        });
        debouncedSet();
    }, [debouncedSet]);

    const handleTypeChange = (option: SourceTypeOptionId) => {
        setLocal((prev) => {
            const typePatch = patchForTypeOption(option, prev);
            const next = { ...prev, ...typePatch } as CSLItem;
            for (const key of Object.keys(typePatch) as Array<keyof CSLItem>) {
                if (typePatch[key] === undefined) delete (next as any)[key];
            }
            localRef.current = next;
            if (currentRef) currentRef.current = next;
            return next;
        });
        debouncedSet();
    };

    const youtubeMode = local.type === 'webpage' && isYouTubeLike(local);
    const showWebsiteName = local.type === 'webpage' || local.type === 'article-newspaper' || local.type === 'article-magazine';
    const showUrl = local.type === 'webpage' || local.type === 'book' || local.type === 'article-journal'
        || local.type === 'article-newspaper' || local.type === 'article-magazine';

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
                <div className="flex min-w-0 flex-col gap-1.5">
                    <SimpleDropdown
                        options={TYPE_OPTIONS}
                        value={selectedTypeOption(local)}
                        onChange={(o: CitationOption) => handleTypeChange(o.value)}
                        placeholder="Source Type"
                        className="min-w-0 sm:min-w-[7rem]"
                    />
                    {typeWarning && (
                        <p className="m-0 text-xs leading-5 text-muted-foreground" data-severity={typeWarning.severity || 'review'}>
                            {typeWarning.message}
                        </p>
                    )}
                </div>
            </div>
            <Line className="my-4" />
            <Title value={local.title || ''} onChange={(v) => patch({ title: v })} isRequired warning={fieldWarnings.title} />
            {showWebsiteName && (
                <WebsiteName
                    value={local['container-title'] || ''}
                    onChange={(v) => patch({ 'container-title': v })}
                    warning={fieldWarnings['container-title']}
                />
            )}
            {youtubeMode && (
                <Medium
                    value={local.genre || ''}
                    onChange={(v) => patch({ genre: v })}
                    isRecommended
                />
            )}
            <Line className="my-4" />
            <Contributors authors={local.author ?? []} onChange={(next) => patch({ author: next })} warning={fieldWarnings.author} />
            <Line className="my-4" />
            <PublicationDate value={local.issued} onChange={(d) => patch({ issued: d })} isRecommended warning={fieldWarnings.issued} />
            <AccessDate value={local.accessed} onChange={(d) => patch({ accessed: d })} />
            <Line className="my-4" />
            {showUrl && (
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
            {(local.type === 'article-newspaper' || local.type === 'article-magazine') && (
                <Publisher value={local.publisher || ''} onChange={(v) => patch({ publisher: v })} warning={fieldWarnings.publisher} />
            )}
        </div>
    );
}

function sourceTypeWarning(
    warnings: CitationQualityWarning[],
    dismissedWarningKeys: readonly string[] | undefined,
    onDismissWarning: (warningKey: string) => void,
): FieldWarning | undefined {
    for (const warning of warnings) {
        if (warning.action !== 'choose-source-type' && warning.code !== 'source_type_ambiguous') continue;
        if (isCitationWarningDismissed(warning, dismissedWarningKeys)) continue;
        const warningKey = warningDismissalKey(warning);
        const dismissible = isDismissibleCitationWarning(warning);
        return {
            message: warning.message,
            severity: warning.severity,
            dismissible,
            onDismiss: dismissible ? () => onDismissWarning(warningKey) : undefined,
        };
    }
    return undefined;
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
            if (warning.code.endsWith('_ai_suggested')) return 'AI-suggested — verify this value against the source.';
            if (warning.code.endsWith('_conflict')) return 'Conflicting source data was found; confirm this value.';
            return warning.message;
    }
}

function warningResolved(warning: CitationQualityWarning, csl: CSLItem): boolean {
    // Once the user supplies a title, they have taken over the (unreadable)
    // social post, so the "couldn't read this automatically" flag is resolved.
    if (warning.code === 'social_unresolved') return hasStringValue(csl.title);
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
