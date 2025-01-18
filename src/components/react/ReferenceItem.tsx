import React from 'react';
import { ClipboardIcon, GlobeAltIcon } from "@heroicons/react/24/outline";
import type { Source } from '../../lib/citations/definitions';
import formatSource from '../../lib/citations/formatSource';
import EditReferenceDialogDrawer from './EditReferenceDialogDrawer';
import styles from '../../styles/references.module.css';
import { Clipboard, Globe } from 'lucide-react';

interface ReferenceItemProps {
    source: Source;
    index: number;
    citationFormat: string;
    onCheckChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
    setSources: (sources: Source[]) => void;
}

export default function ReferenceItem({ source, index, citationFormat, onCheckChange, setSources }: ReferenceItemProps) {
    const handleCopy = (event: React.MouseEvent<HTMLButtonElement>) => {
        const target = event.currentTarget;
        const targetSpan = target.querySelector('span') as HTMLSpanElement;
        const currentText = targetSpan.textContent;
        const formattedHtml = formatSource(source, citationFormat);
        
        // Create a temporary div for copying
        const tempDiv = document.createElement('div');
        tempDiv.style.cssText = `
            position: fixed;
            left: -9999px;
            font-family: "Times New Roman", Times, serif;
            font-size: 12pt;
            line-height: 2;
        `;
        tempDiv.innerHTML = formattedHtml;
        document.body.appendChild(tempDiv);

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

        targetSpan.textContent = 'Copied';
        setTimeout(() => {
            targetSpan.textContent = currentText;
        }, 1000);
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
                        dangerouslySetInnerHTML={{ __html: formatSource(source, citationFormat) }} 
                        className={styles.citationSource}
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
                <EditReferenceDialogDrawer source={source} setSources={setSources} />
                {source.citationInfo.url && (
                    <a 
                        className={styles.button} 
                        href={`https://${source.citationInfo.url}`} 
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