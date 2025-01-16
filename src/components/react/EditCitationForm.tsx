import React, { useState, useCallback } from "react";
import type { Date, Source } from "../../lib/citations/definitions";
import { Title, WebsiteName, Contributors, URL, Line, PublicationDate, AccessDate } from "./EditCitationFormComponents";
import { useDebounce } from "../../hooks/useDebounce";

/**
 * Edit citation form component
 * @param source - The source to edit
 * @param setSources - The function to set the sources
 */
export default function EditCitationForm({ source, setSources }: { source: Source, setSources: React.Dispatch<React.SetStateAction<Source[]>> }) {
    const [localCitationInfo, setLocalCitationInfo] = useState(source.citationInfo);

    // Debounce the update to parent state to avoid unnecessary re-renders
    const debouncedSetSources = useDebounce((newCitationInfo: typeof source.citationInfo) => {
        setSources(prevSources =>
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

    // Get the first publication date if it exists
    const publicationDate = Array.isArray(localCitationInfo.publicationDate) && localCitationInfo.publicationDate.length > 0
        ? localCitationInfo.publicationDate[0].date
        : { year: 0, month: 0, day: 0 };

    return (

        <div className="flex flex-col gap-4 w-full pt-6">

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
            <Line className="my-2" />

            {/* Contributors */}
            <Contributors
                source={source}
                setSources={setSources}
            />
            <Line className="my-2" />

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
            <Line className="my-2" />

            {/* URL */}
            <URL
                value={localCitationInfo.url}
                onChange={(value) => handleInputChange('url', value)}
                isRecommended={true}
            />
            <Line className="my-2" />

            <p className="text-sm text-muted-foreground text-xs">All changes are saved automatically.</p>
        </div>
    )
}
