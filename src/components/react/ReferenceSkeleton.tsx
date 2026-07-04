import React from 'react';
import styles from '../../styles/references.module.css';

interface ReferenceSkeletonProps {
    url?: string;
}

// A non-interactive placeholder row shown while a citation request is in flight.
// It mirrors ReferenceItem's outer box + grid so the resolved item drops into the
// same slot without a layout shift, but renders only shimmer bars — it never
// calls useFormattedCitation, so a loading row triggers zero /api/format traffic
// and cannot be selected, copied, or edited.
export default function ReferenceSkeleton({ url }: ReferenceSkeletonProps) {
    return (
        <li className={styles.citationSourceItem}>
            <div
                className={styles.citation}
                role="status"
                aria-busy="true"
                aria-label={url ? `Fetching citation for ${url}…` : 'Fetching citation…'}
            >
                <div className={styles.checkbox} aria-hidden="true"></div>
                <div className={styles.citationSourceWrapper}>
                    <span className={styles.skeletonBar} aria-hidden="true"></span>
                    <span className={styles.skeletonBar} aria-hidden="true"></span>
                </div>
            </div>
        </li>
    );
}
