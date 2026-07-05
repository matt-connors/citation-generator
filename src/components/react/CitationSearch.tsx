import React, { useState, useEffect, useRef, forwardRef, type Ref } from "react";
import clsx from "clsx";
import { Tab, Tabs, TabList, TabPanel } from 'react-tabs';
import { ChevronRightIcon, EllipsisHorizontalIcon, ChevronDownIcon } from '@heroicons/react/24/outline';
import Dropdown from "./Dropdown";
import citationStyles from '../citationStyles';
import styles from "../../styles/citation-search.module.css";

// Component for each search input field
const SearchPanel = ({ label, placeholder, name, idKey, active }: {
    label: string; placeholder: string; name: string; idKey?: string; active: boolean;
}) => {
    const key = idKey ?? name;
    const inputId = `${key}-input`;
    return (
        <div className={styles.labelContent}>
            <label htmlFor={inputId} id={key} className={styles.inputLabel}>{label}</label>
            <div className={styles.inputWrapper}>
                <div className={styles.inputFade} aria-hidden="true"></div>
                {/* Inactive panels' inputs are disabled so only the visible
                    field submits — the More panel reuses name="website" and a
                    second enabled website field would shadow it in the query
                    string (URLSearchParams.get returns the first). */}
                <input id={inputId} type="text" placeholder={placeholder} name={name} autoComplete="off" disabled={!active} />
            </div>
        </div>
    );
}

export type CitationSearchTab = 'website' | 'book' | 'journal';

// Extra source types behind the "More" menu. All are website-URL lookups —
// the entry point just names the source and tailors the placeholder, and the
// matching guide is offered under the box. `key` doubles as the attribution
// value (menu-<key>) so the dashboard can see which entry points get used.
export const MORE_SOURCE_TYPES = [
    { key: 'youtube', label: 'YouTube', placeholder: 'Paste the video URL', guide: 'how-to-cite-a-youtube-video' },
    { key: 'tiktok', label: 'TikTok', placeholder: 'Paste the TikTok URL', guide: 'how-to-cite-a-tiktok' },
    { key: 'x-post', label: 'X / Tweet', placeholder: "Paste the post's URL", guide: 'how-to-cite-a-tweet' },
    { key: 'instagram', label: 'Instagram', placeholder: 'Paste the post or Reel URL', guide: 'how-to-cite-an-instagram-post' },
    { key: 'wikipedia', label: 'Wikipedia', placeholder: 'Paste the article URL', guide: 'how-to-cite-wikipedia' },
    { key: 'news', label: 'News article', placeholder: 'Paste the article URL', guide: 'how-to-cite-a-newspaper-article' },
    { key: 'blog', label: 'Blog post', placeholder: 'Paste the blog post URL', guide: 'how-to-cite-a-blog-post' },
    { key: 'podcast', label: 'Podcast', placeholder: "Paste the episode's URL", guide: 'how-to-cite-a-podcast' },
    { key: 'ted', label: 'TED Talk', placeholder: "Paste the talk's URL", guide: 'how-to-cite-a-ted-talk' },
    { key: 'gov', label: 'Government page', placeholder: 'Paste the .gov page URL', guide: 'how-to-cite-a-government-website' },
] as const;

type MoreSourceType = (typeof MORE_SOURCE_TYPES)[number];

interface CitationSearchProps {
    includeDropdown?: Boolean;
    includeManualCite?: Boolean;
    defaultStyle?: string;
    /** Which tab opens first — lets a guide about DOIs start on the Journal tab. */
    defaultTab?: CitationSearchTab;
    /** Placeholder override for the default tab (e.g. "Paste the TikTok URL"). */
    placeholder?: string;
    /** Attribution slug carried through to /my-references and the cite APIs. */
    from?: string;
}

const MORE_TAB_INDEX = 3;

// Main CitationSearch component
const CitationSearch = forwardRef((props: CitationSearchProps, ref: Ref<HTMLInputElement>) => {
    // Array of search panels with their respective labels, placeholders, and names
    const tabPanels = [
        { label: "Website", placeholder: "Paste the website URL", name: "website" },
        { label: "Book", placeholder: "Enter an ISBN", name: "book" },
        { label: "Journal", placeholder: "Enter a DOI", name: "journal" },
    ];

    const defaultTabIndex = Math.max(0, tabPanels.findIndex((panel) => panel.name === props.defaultTab));

    // State for managing active tab index
    const [tabIndex, setTabIndex] = useState(defaultTabIndex);
    // The source type chosen from the More menu (TikTok, YouTube, ...)
    const [sourceType, setSourceType] = useState<MoreSourceType | null>(null);
    const [menuOpen, setMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    // A guide-supplied placeholder applies only to the tab it was written for.
    if (props.placeholder) {
        tabPanels[defaultTabIndex].placeholder = props.placeholder;
    }

    // Close the More menu on outside press or Escape. pointerdown, not click:
    // the opening click is still bubbling to the document when this listener
    // attaches, so a click listener would close the menu the instant it opened.
    // The More tab itself is excluded — its own handler owns the toggle.
    useEffect(() => {
        if (!menuOpen) return;
        const onPointerDown = (event: PointerEvent) => {
            const target = event.target as Element;
            if (menuRef.current?.contains(target)) return;
            if (target.closest('[aria-haspopup="menu"]')) return;
            setMenuOpen(false);
        };
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setMenuOpen(false);
        };
        document.addEventListener('pointerdown', onPointerDown);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('pointerdown', onPointerDown);
            document.removeEventListener('keydown', onKey);
        };
    }, [menuOpen]);

    // Function to generate class names for styling active tabs
    const getClassNames = (className: string, index: number) => clsx(
        styles[className],
        tabIndex === index && styles.active
    );

    const chooseSourceType = (type: MoreSourceType) => {
        setSourceType(type);
        setTabIndex(MORE_TAB_INDEX);
        setMenuOpen(false);
    };

    // Attribution: an explicit from prop (guide pages) always wins; otherwise
    // a More-menu pick is attributed as menu-<key> so the dashboard can see
    // which entry points convert.
    const fromValue = props.from ?? (tabIndex === MORE_TAB_INDEX && sourceType ? `menu-${sourceType.key}` : undefined);

    return (
        <Tabs
            selectedIndex={tabIndex}
            onSelect={(index) => {
                if (index === MORE_TAB_INDEX) {
                    // The More tab opens the menu; it only becomes selectable
                    // once a source type has been chosen from it.
                    setMenuOpen((open) => !open);
                    return sourceType !== null;
                }
                setMenuOpen(false);
                setTabIndex(index);
                return true;
            }}
            className={styles.citationSearch}
        >

            {/* Tab list */}
            <TabList className={styles.searchTablist} role="tablist">
                {tabPanels.map((panel, index) => (
                    <Tab key={index} className={getClassNames('searchPanelTab', index)} role="tab" aria-selected={tabIndex === index ? "true" : "false"}>{panel.label}</Tab>
                ))}
                <Tab
                    className={clsx(getClassNames('searchPanelTab', MORE_TAB_INDEX), styles.moreTab)}
                    role="tab"
                    aria-selected={tabIndex === MORE_TAB_INDEX ? "true" : "false"}
                    aria-haspopup="menu"
                    aria-expanded={menuOpen}
                >
                    {sourceType ? (
                        <>{sourceType.label}<ChevronDownIcon className={styles.moreIcon} aria-hidden="true" /></>
                    ) : (
                        <><EllipsisHorizontalIcon className={styles.moreIcon} aria-hidden="true" /><span className={styles.srOnly}>More source types</span></>
                    )}
                </Tab>
            </TabList>

            {/* More-menu popover, anchored under the tab strip. Lives outside
                the TabList because TabList renders a <ul> whose children must
                be <li> elements. */}
            {menuOpen && (
                <div className={styles.moreMenu} ref={menuRef} role="menu" aria-label="More source types">
                    {MORE_SOURCE_TYPES.map((type) => (
                        <button
                            key={type.key}
                            type="button"
                            role="menuitem"
                            className={clsx(styles.moreMenuItem, sourceType?.key === type.key && styles.moreMenuItemActive)}
                            onClick={() => chooseSourceType(type)}
                        >
                            {type.label}
                        </button>
                    ))}
                </div>
            )}

            {/* Form containing search inputs and citation options */}
            <form className={`${styles.searchBox} ${clsx(
                props.includeDropdown && styles.withDropdown
            )}`} action="/my-references/">

                {/* Dropdown for selecting citation style */}
                {props.includeDropdown ? <Dropdown
                    options={citationStyles}
                    className={clsx(styles.label, styles.dropdown)}
                    defaultStyle={props.defaultStyle}
                /> : <input type="hidden" name="citationStyle" ref={ref} />}

                {/* Attribution: which guide page or menu pick this search started from */}
                {fromValue && <input type="hidden" name="from" value={fromValue} />}

                {/* Render tab panels dynamically */}
                {tabPanels.map((panel, index) => (
                    <TabPanel key={index} className={`${styles.label} ${getClassNames('searchPanel', index)}`} role="tabpanel" aria-labelledby={panel.name} hidden={tabIndex !== index}>
                        <SearchPanel {...panel} active={tabIndex === index} />
                    </TabPanel>
                ))}

                {/* The More panel: a website-URL lookup labeled with the chosen source type */}
                <TabPanel className={`${styles.label} ${getClassNames('searchPanel', MORE_TAB_INDEX)}`} role="tabpanel" aria-labelledby="more-source" hidden={tabIndex !== MORE_TAB_INDEX}>
                    <SearchPanel
                        label={sourceType?.label ?? 'Website'}
                        placeholder={sourceType?.placeholder ?? 'Paste the website URL'}
                        name="website"
                        idKey="more-source"
                        active={tabIndex === MORE_TAB_INDEX}
                    />
                </TabPanel>

                {/* Cite button */}
                <button type="submit" className={`button-primary ${styles.citeBtn}`}>
                    <span>Cite</span>
                </button>
            </form>
            <div className={styles.smallButtonRow}>
                {tabIndex === MORE_TAB_INDEX && sourceType && (
                    <a href={`/guides/${sourceType.guide}/`} className={styles.smallButton}>
                        <span>How to cite: {sourceType.label}</span>
                        <ChevronRightIcon className={styles.icon} aria-hidden="true" />
                    </a>
                )}
                {props.includeManualCite && (
                    <a href="/my-references/" className={styles.smallButton}>
                        <span>Cite Manually</span>
                        <ChevronRightIcon className={styles.icon} aria-hidden="true" />
                    </a>
                )}
            </div>
        </Tabs>
    );
})

export default CitationSearch;
