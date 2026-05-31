// Single source of truth for guide categories. Used by the guides hub
// (src/pages/guides/index.astro), the per-category hub pages
// (src/pages/guides/category/[category].astro), and the category tier in
// guide breadcrumbs. Keep `key` in sync with the `category` enum in
// src/content/config.ts.

export type GuideCategoryKey =
    | 'style-guide'
    | 'how-to'
    | 'concept'
    | 'comparison'
    | 'meta';

export interface GuideCategory {
    key: GuideCategoryKey;
    /** Short label for headings, breadcrumbs, and nav. */
    label: string;
    /** One-line summary shown under the heading on the guides hub. */
    blurb: string;
    /** Longer description for the category hub page meta + intro. */
    description: string;
}

export const GUIDE_CATEGORIES: GuideCategory[] = [
    {
        key: 'style-guide',
        label: 'Style guides',
        blurb: 'Complete reference for each major citation style.',
        description:
            'Edition-accurate reference guides for each major citation style — APA 7, MLA 9, Chicago 18, Harvard (Cite Them Right), Vancouver, IEEE, and AMA 11 — covering in-text citations, the reference list, and worked examples for every common source type.',
    },
    {
        key: 'how-to',
        label: 'How to cite',
        blurb: 'Format common source types across every style.',
        description:
            'Step-by-step guides for citing specific source types — websites, books, journal articles, PDFs, interviews, and videos — formatted correctly in APA, MLA, Chicago, Harvard, Vancouver, IEEE, and AMA.',
    },
    {
        key: 'concept',
        label: 'Concepts',
        blurb: 'Core citation concepts and how they apply.',
        description:
            'The core ideas behind citing sources well: in-text citations, hanging indents, annotated bibliographies, the difference between a works-cited list and a bibliography, and how to avoid plagiarism.',
    },
    {
        key: 'comparison',
        label: 'Comparisons',
        blurb: 'Choosing the right style for your work.',
        description:
            'Side-by-side comparisons to help you choose between citation styles and switch cleanly from one to another, including which style to use for your field.',
    },
    {
        key: 'meta',
        label: 'Reference & FAQ',
        blurb: 'Tool documentation and frequently asked questions.',
        description:
            'Documentation for the citation generator, a log of citation-style edition updates, and answers to frequently asked questions.',
    },
];

export function categoryByKey(key: string): GuideCategory | undefined {
    return GUIDE_CATEGORIES.find((c) => c.key === key);
}

export function categoryPath(key: string): string {
    return `/guides/category/${key}`;
}
