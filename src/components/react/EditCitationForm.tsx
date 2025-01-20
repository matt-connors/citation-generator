import React, { useState, useCallback } from "react";
import type { Author, BookSource, Date, Source, WebsiteSource } from "../../lib/citations/definitions";
import { Title, WebsiteName, Contributors, URL, Line, PublicationDate, AccessDate, Edition, VolumeNumber, Publsiher, Medium, DOI } from "./EditCitationFormComponents";
import { useDebounce } from "../../hooks/useDebounce";
import SimpleDropdown from "./SimpleDropdown";

interface FormHandlerProps<T extends Source> {
    source: T;
    setSources: React.Dispatch<React.SetStateAction<Source[]>>;
    handleInputChange: (name: string, value: string | Date) => void;
    localCitationInfo: T['citationInfo'];
}

type CitationType = Source['citationType'];
type CitationInfo = Source['citationInfo'];

interface CitationOption {
    label: string;
    value: CitationType;
}

type SourceUpdate = {
    citationType?: CitationType;
    citationInfo?: CitationInfo;
    uuid?: string;
};

/**
 * The form for webpage type citations
 */
const WebpageCitationForm = ({ source, setSources, handleInputChange, localCitationInfo }: FormHandlerProps<WebsiteSource>) => {
    // Get the first publication date if it exists
    const publicationDate = Array.isArray(localCitationInfo.publicationDate) && localCitationInfo.publicationDate.length > 0
        ? localCitationInfo.publicationDate[0].date
        : { year: 0, month: 0, day: 0 };

    return (
        <>
            {/* Title */}
            <Title
                value={localCitationInfo.sourceTitle}
                onChange={(value) => handleInputChange('sourceTitle', value)}
                isRequired={true}
            />

            {/* Website Name */}
            <WebsiteName
                value={localCitationInfo.publisher}
                onChange={(value) => handleInputChange('publisher', value)}
            />
            <Line className="my-4" />

            {/* Contributors */}
            <Contributors
                source={source}
                setSources={setSources}
            />
            <Line className="my-4" />

            {/* Publication Date */}
            <PublicationDate
                value={publicationDate}
                onChange={(value) => handleInputChange('publicationDate', value)}
                isRecommended={true}
            />

            {/* Access Date */}
            <AccessDate
                value={localCitationInfo.accessDate}
                onChange={(value) => handleInputChange('accessDate', value)}
            />
            <Line className="my-4" />

            {/* URL */}
            <URL
                value={localCitationInfo.url}
                onChange={(value) => handleInputChange('url', value)}
                isRecommended={true}
            />
        </>
    )
}

/**
 * The form for book citations
 */
const BookCitationForm = ({ source, setSources, handleInputChange, localCitationInfo }: FormHandlerProps<BookSource>) => {
    // Get the first publication date if it exists
    const publicationDate = Array.isArray(localCitationInfo.publicationDate) && localCitationInfo.publicationDate.length > 0
        ? localCitationInfo.publicationDate[0].date
        : { year: 0, month: 0, day: 0 };

    return (
        <>
            {/* Title */}
            <Title
                value={localCitationInfo.sourceTitle}
                onChange={(value) => handleInputChange('sourceTitle', value)}
                isRequired={true}
            />
            <Line className="my-4" />

            {/* Contributors */}
            <Contributors
                source={source}
                setSources={setSources}
            />
            <Line className="my-4" />

            {/* Edition */}
            <Edition
                value={localCitationInfo.edition || ''}
                onChange={(value) => handleInputChange('edition', value)}
            />

            {/* Volume Number */}
            <VolumeNumber
                value={localCitationInfo.volume || ''}
                onChange={(value) => handleInputChange('volume', value)}
            />
            <Line className="my-4" />

            {/* Medium */}
            <Medium
                value={localCitationInfo.medium || ''}
                onChange={(value) => handleInputChange('medium', value)}
                isRecommended={true}
            />

            {/* Publication Date */}
            <PublicationDate
                value={publicationDate}
                onChange={(value) => handleInputChange('publicationDate', value)}
                isRecommended={true}
            />
            <Line className="my-4" />

            {/* Publisher */}
            <Publsiher
                value={localCitationInfo.publisher}
                onChange={(value) => handleInputChange('publisher', value)}
                isRecommended={true}
            />
            <Line className="my-4" />

            {/* DOI */}
            <DOI
                value={localCitationInfo.doi}
                onChange={(value) => handleInputChange('doi', value)}
            />

            {/* URL */}
            <URL
                value={localCitationInfo.url || ''}
                onChange={(value) => handleInputChange('url', value)}
                isRecommended={true}
            />
        </>
    )
}

/**
 * Edit citation form component
 */
export default function EditCitationForm({ source, setSources }: { source: Source, setSources: React.Dispatch<React.SetStateAction<Source[]>> }) {
    const [localCitationInfo, setLocalCitationInfo] = useState<CitationInfo>(source.citationInfo);
    const [citationType, setCitationType] = useState<CitationType>(source.citationType);

    // Debounce the update to parent state to avoid unnecessary re-renders
    const debouncedSetSources = useDebounce((updates: SourceUpdate) => {
        setSources((prevSources) => {
            const updatedSources = prevSources.map(s =>
                s.uuid === source.uuid
                    ? { ...s, ...updates } as Source
                    : s
            );
            // Save to localStorage whenever sources are updated
            localStorage.setItem('sources', JSON.stringify(updatedSources));
            return updatedSources;
        });
    }, 500);

    const handleInputChange = useCallback((name: string, value: string | Date) => {
        const newCitationInfo = {
            ...localCitationInfo,
            [name]: name === 'publicationDate' ? [{
                context: { prefix: '', matchedText: '' },
                date: value
            }] : value
        } as CitationInfo;
        
        setLocalCitationInfo(newCitationInfo);
        debouncedSetSources({ citationInfo: newCitationInfo });
    }, [localCitationInfo, debouncedSetSources]);

    const handleTypeChange = useCallback((newType: CitationType) => {
        // Create a new citation info object with the common fields
        const commonFields = {
            authors: localCitationInfo.authors,
            sourceTitle: localCitationInfo.sourceTitle,
            publisher: localCitationInfo.publisher,
            publicationDate: localCitationInfo.publicationDate,
            accessDate: localCitationInfo.accessDate,
            url: localCitationInfo.url || ''
        };

        // Add type-specific fields
        const newCitationInfo = newType === 'book' 
            ? {
                ...commonFields,
                doi: '',
                edition: '',
                volume: '',
                medium: ''
            }
            : commonFields;

        setCitationType(newType);
        setLocalCitationInfo(newCitationInfo as CitationInfo);
        
        // Create a properly typed update
        const update: SourceUpdate = {
            citationType: newType,
            citationInfo: newCitationInfo as CitationInfo,
            uuid: source.uuid
        };
        debouncedSetSources(update);
    }, [localCitationInfo, debouncedSetSources, source.uuid]);

    const citationOptions: CitationOption[] = [
        { label: 'Website', value: 'website' },
        { label: 'Book', value: 'book' }
    ];

    return (
        <div className="flex flex-col gap-4 w-full pt-8">
            <div className="grid grid-cols-[130px_1fr] items-center gap-4">
                <span className="flex flex-col leading-4 text-sm">
                    Source Type
                    <span className="text-xs text-muted-foreground">Required</span>
                </span>
                <SimpleDropdown
                    options={citationOptions}
                    value={citationOptions.find(option => option.value === citationType)}
                    onChange={(option: CitationOption) => handleTypeChange(option.value)}
                    placeholder="Source Type"
                    className="min-w-[7rem]"
                />
            </div>
            <Line className="my-4" />
            {citationType === 'website' && (
                <WebpageCitationForm
                    source={source as WebsiteSource}
                    setSources={setSources}
                    handleInputChange={handleInputChange}
                    localCitationInfo={localCitationInfo as WebsiteSource['citationInfo']}
                />
            )}
            {citationType === 'book' && (
                <BookCitationForm
                    source={source as BookSource}
                    setSources={setSources}
                    handleInputChange={handleInputChange}
                    localCitationInfo={localCitationInfo as BookSource['citationInfo']}
                />
            )}
        </div>
    )
}
