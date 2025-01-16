import React, { useState, useCallback } from "react";
import type { Author, BookSource, Date, Source, WebsiteSource } from "../../lib/citations/definitions";
import { Title, WebsiteName, Contributors, URL, Line, PublicationDate, AccessDate, Edition, VolumeNumber, Publsiher, Medium, DOI } from "./EditCitationFormComponents";
import { useDebounce } from "../../hooks/useDebounce";
import SimpleDropdown from "./SimpleDropdown";

interface FormHandlerProps {
    source: Source;
    setSources: React.Dispatch<React.SetStateAction<Source[]>>;
    handleInputChange: (name: string, value: string | Date) => void;
}   

/**
 * The form for webpage type citations
 * @param source - The source to edit
 * @param setSources - The function to set the sources
 */
const WebpageCitationForm = ({ source, setSources, handleInputChange, localCitationInfo }: FormHandlerProps & {
    localCitationInfo: WebsiteSource['citationInfo']
}) => {

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
                value={localCitationInfo.url || ''}
                onChange={(value) => handleInputChange('url', value)}
                isRecommended={true}
            />
        </>
    )
}

/**
 * The form for book citations
 * @param source
 * @param setSources
 */
const BookCitationForm = ({ source, setSources, handleInputChange, localCitationInfo }: FormHandlerProps & {
    localCitationInfo: BookSource['citationInfo']
}) => {

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
 * @param source - The source to edit
 * @param setSources - The function to set the sources
 */
export default function EditCitationForm({ source, setSources }: { source: Source, setSources: React.Dispatch<React.SetStateAction<Source[]>> }) {
    const [localCitationInfo, setLocalCitationInfo] = useState(source.citationInfo);
    const [citationType, setCitationType] = useState('website');

    // Debounce the update to parent state to avoid unnecessary re-renders
    const debouncedSetSources = useDebounce((newCitationInfo: typeof source.citationInfo) => {
        setSources((prevSources: any) =>
            prevSources.map(s =>
                s.uuid === source.uuid
                    ? { ...s, citationInfo: newCitationInfo }
                    : s
            )
        );
    }, 500);

    const handleInputChange = useCallback((name: string, value: string | Date) => {
        const newCitationInfo = {
            ...localCitationInfo,
            [name]: name === 'publicationDate' ? [{
                context: { prefix: '', matchedText: '' },
                date: value
            }] : value
        };
        setLocalCitationInfo(newCitationInfo);
        debouncedSetSources(newCitationInfo);
    }, [localCitationInfo, debouncedSetSources]);

    const citationOptions = [
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
                    onChange={(option) => setCitationType(option.value)}
                    placeholder="Month"
                    className="min-w-[7rem]"
                />
            </div>
            <Line className="my-4" />
            {citationType === 'website' && (
                <WebpageCitationForm
                    source={source}
                    setSources={setSources}
                    handleInputChange={handleInputChange}
                    localCitationInfo={localCitationInfo as WebsiteSource['citationInfo']}
                />
            )}
            {citationType === 'book' && (
                <BookCitationForm
                    source={source}
                    setSources={setSources}
                    handleInputChange={handleInputChange}
                    localCitationInfo={localCitationInfo as BookSource['citationInfo']}
                />
            )}
        </div>
    )
}
