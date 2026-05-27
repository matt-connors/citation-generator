import React, { useState, useCallback, useEffect, useRef } from 'react';
import type { StoredSource } from '../../lib/references/storage';
import type { CSLItem } from '../../lib/citations/csl-types';
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
    // TODO(typo): the named export below is misspelled `Publsiher` in EditCitationFormComponents.tsx.
    // Aliased as Publisher here; rename the export in a follow-up PR.
    Publsiher as Publisher,
    DOI,
} from './EditCitationFormComponents';
import { useDebounce } from '../../hooks/useDebounce';
import SimpleDropdown from './SimpleDropdown';

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
            <Title value={local.title || ''} onChange={(v) => patch({ title: v })} isRequired />
            {local.type === 'webpage' && (
                <WebsiteName value={local['container-title'] || ''} onChange={(v) => patch({ 'container-title': v })} />
            )}
            <Line className="my-4" />
            <Contributors source={{ ...source, csl: local }} setSources={setSources} />
            <Line className="my-4" />
            <PublicationDate value={local.issued} onChange={(d) => patch({ issued: d })} isRecommended />
            <AccessDate value={local.accessed} onChange={(d) => patch({ accessed: d })} />
            <Line className="my-4" />
            {(local.type === 'webpage' || local.type === 'book' || local.type === 'article-journal') && (
                <UrlField value={local.URL || ''} onChange={(v) => patch({ URL: v })} isRecommended />
            )}
            {local.type === 'book' && (
                <>
                    <Edition value={local.edition || ''} onChange={(v) => patch({ edition: v })} />
                    <VolumeNumber value={local.volume || ''} onChange={(v) => patch({ volume: v })} />
                    <Publisher value={local.publisher || ''} onChange={(v) => patch({ publisher: v })} isRecommended />
                    <DOI value={local.DOI || ''} onChange={(v) => patch({ DOI: v })} />
                </>
            )}
            {local.type === 'article-journal' && (
                <>
                    <Publisher value={local['container-title'] || ''} onChange={(v) => patch({ 'container-title': v })} isRecommended />
                    <DOI value={local.DOI || ''} onChange={(v) => patch({ DOI: v })} isRecommended />
                </>
            )}
        </div>
    );
}
