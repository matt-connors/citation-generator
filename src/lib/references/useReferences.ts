import { useState, useEffect } from 'react';
import type { Source } from '../citations/definitions';
import formatSource from '../citations/formatSource';

export interface UseReferencesReturn {
    sources: Source[];
    sourceCount: number;
    checkedCount: number;
    citationFormat: string;
    setSources: (sources: Source[]) => void;
    setCheckedCount: (count: number) => void;
    setCitationFormat: (format: string) => void;
    handleDelete: () => void;
    copySelected: (onCopy: () => void) => void;
    loadInitialSources: () => void;
}

export function useReferences(): UseReferencesReturn {
    const [sources, setSources] = useState<Source[]>([]);
    const [sourceCount, setSourceCount] = useState<number>(0);
    const [checkedCount, setCheckedCount] = useState<number>(0);
    const [citationFormat, setCitationFormat] = useState<string>('mla-9th-edition');

    const getExistingSources = (): Source[] => {
        const existingSources = localStorage.getItem("sources");
        return existingSources ? JSON.parse(existingSources) : [];
    };

    const isCitationInLocalStorage = (existingSources: Source[]): boolean => {
        const url = new URL(window.location.href);
        const website = url.searchParams.get('website')
            ?.replace('https://', '')
            ?.replace('http://', '');
        return existingSources.some((source: Source) => source.citationInfo.url === website);
    };

    const getRequestUrl = (): string => {
        const url = new URL(window.location.href);
        const website = url.searchParams.get('website');
        const book = url.searchParams.get('book');
        if (website) return `/cite-website?url=${website}`;
        if (book) return `/cite-book?isbn=${book}`;
        return '';
    };

    const handleDelete = () => {
        const updatedSources = sources.filter((_, index) => {
            const checkbox = document.querySelector(`#source-${index}`) as HTMLInputElement;
            return !checkbox?.checked;
        });
        setSources(updatedSources);
        setSourceCount(updatedSources.length);
        setCheckedCount(0);
        localStorage.setItem('sources', JSON.stringify(updatedSources));
    };

    const copySelected = (onCopy: () => void) => {
        const selectedSources = sources.filter((_, index) => {
            const checkbox = document.querySelector(`#source-${index}`) as HTMLInputElement;
            return checkbox?.checked;
        });

        // Create a temporary div for copying
        const tempDiv = document.createElement('div');
        tempDiv.style.cssText = `
            position: fixed;
            left: -9999px;
            font-family: "Times New Roman", Times, serif;
            font-size: 12pt;
            line-height: 2;
        `;
        document.body.appendChild(tempDiv);

        // Add each selected source's formatted HTML
        selectedSources.forEach((source, index) => {
            const formattedHtml = formatSource(source, citationFormat);
            const sourceDiv = document.createElement('div');
            sourceDiv.style.cssText = `
                font-family: "Times New Roman", Times, serif;
                font-size: 12pt;
                line-height: 2;
            `;
            sourceDiv.innerHTML = formattedHtml;
            if (index > 0) {
                tempDiv.appendChild(document.createElement('br'));
                tempDiv.appendChild(document.createElement('br'));
            }
            tempDiv.appendChild(sourceDiv);
        });

        // Select and copy the content
        const range = document.createRange();
        range.selectNodeContents(tempDiv);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
        document.execCommand('copy');
        
        // Clean up
        document.body.removeChild(tempDiv);
        selection?.removeAllRanges();

        onCopy();
    };
    
    const loadInitialSources = async () => {
        try {
            const requestUrl = getRequestUrl();
            const existingSources = getExistingSources();
            setSources(existingSources);
            setSourceCount(existingSources.length);

            if (requestUrl === '' || isCitationInLocalStorage(existingSources)) {
                return;
            }

            const response = await fetch('https://mlagenerator.com/api' + requestUrl);
            const data = await response.json();

            if (data.error) throw new Error('API Error: ' + data.error);

            const mergedSources = [...existingSources, data].filter(
                (source, index, self) =>
                    index === self.findIndex(element => element.uuid === source.uuid)
            );

            setSources(mergedSources);
            setSourceCount(mergedSources.length);
            localStorage.setItem('sources', JSON.stringify(mergedSources));
        } catch (error) {
            console.error('Error loading sources:', error);
            const existingSources = getExistingSources();
            setSources(existingSources);
            setSourceCount(existingSources.length);
        }
    };

    useEffect(() => {
        const citationStyle = new URLSearchParams(window.location.search).get('citationStyle');
        setCitationFormat(citationStyle || 'mla-9th-edition');
        loadInitialSources();
    }, []);

    return {
        sources,
        sourceCount,
        checkedCount,
        citationFormat,
        setSources,
        setCheckedCount,
        setCitationFormat,
        handleDelete,
        copySelected,
        loadInitialSources
    };
} 