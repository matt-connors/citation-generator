import React, { useEffect, useMemo, useRef, useState } from "react";
import { Input } from "./Input";
import { cn } from "./utils";
import { Button } from "./Button";
import { AlertTriangle, Building2, Calendar, ChevronDown, Trash2, UserRound, X } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./Tabs";
import type { CSLDate, CSLName } from "../../lib/citations/csl-types";
import type { Option } from './Dropdown';
import SimpleDropdown from './SimpleDropdown';
import styles from '../../styles/references.module.css';

interface TextComponentProps {
    value: string;
    onChange: (value: string) => void;
    isRequired?: boolean;
    isRecommended?: boolean;
    warning?: FieldWarning;
}

interface DateComponentProps {
    value: CSLDate | undefined;
    onChange: (value: CSLDate | undefined) => void;
    isRequired?: boolean;
    isRecommended?: boolean;
    warning?: FieldWarning;
}

export interface FieldWarning {
    message: string;
    severity?: 'info' | 'review' | 'warning' | 'error';
    dismissible?: boolean;
    onDismiss?: () => void;
}

// Add months array at the top level
const months: Option[] = [
    { label: 'January', value: '1' },
    { label: 'February', value: '2' },
    { label: 'March', value: '3' },
    { label: 'April', value: '4' },
    { label: 'May', value: '5' },
    { label: 'June', value: '6' },
    { label: 'July', value: '7' },
    { label: 'August', value: '8' },
    { label: 'September', value: '9' },
    { label: 'October', value: '10' },
    { label: 'November', value: '11' },
    { label: 'December', value: '12' }
];

/**
 * Line component
 * @param className - The class name to apply to the line
 */
export const Line = ({ className }: { className?: string }) => <div className={cn("h-[1px] w-full bg-border", className)} />

interface ContributorsProps {
    authors: CSLName[];
    onChange: (authors: CSLName[]) => void;
    warning?: FieldWarning;
}

const isPerson = (n: CSLName): n is Exclude<CSLName, { literal: string }> => !('literal' in n);

/**
 * Contributors component — operates on CSL-JSON `author` arrays.
 */
export const Contributors = ({ authors, onChange, warning }: ContributorsProps) => {
    // Stable per-row ids kept parallel to `authors`, used as React keys and to
    // track the expanded row. Index keys + an uncontrolled <details> meant that
    // deleting a middle contributor left the wrong row expanded showing another
    // person's data; stable keys fix that. Ids never enter the saved CSL.
    const idCounter = useRef(0);
    const [ids, setIds] = useState<string[]>(() => authors.map(() => `c${idCounter.current++}`));
    const [openId, setOpenId] = useState<string | null>(null);

    // Best-effort length-sync if `authors` changes from outside the mutators below.
    useEffect(() => {
        setIds((prev) => {
            if (prev.length === authors.length) return prev;
            const next = prev.slice(0, authors.length);
            while (next.length < authors.length) next.push(`c${idCounter.current++}`);
            return next;
        });
    }, [authors.length]);

    const previewName = (n: CSLName) => {
        if (isPerson(n)) {
            return (n.given || n.family) ? <span>{n.given} {n.family}</span> : <span>—</span>;
        }
        return <span>{n.literal || '—'}</span>;
    };

    const handleEdit = (idx: number, patch: Partial<CSLName>) => {
        onChange(authors.map((a, i) => i === idx ? ({ ...a, ...patch } as CSLName) : a));
    };

    const handleAddPerson = () => {
        const id = `c${idCounter.current++}`;
        onChange([...authors, { family: '', given: '' } as CSLName]);
        setIds((prev) => [...prev, id]);
        setOpenId(id);
    };

    const handleAddOrganization = () => {
        const id = `c${idCounter.current++}`;
        onChange([...authors, { literal: '' } as CSLName]);
        setIds((prev) => [...prev, id]);
        setOpenId(id);
    };

    const handleDelete = (idx: number) => {
        const removed = ids[idx];
        onChange(authors.filter((_, i) => i !== idx));
        setIds((prev) => prev.filter((_, i) => i !== idx));
        if (openId === removed) setOpenId(null);
    };

    return (
        <div className="flex flex-col gap-1 sm:grid sm:grid-cols-[130px_1fr] sm:gap-4">
            <span className="flex flex-col leading-4 text-sm h-9 justify-center">
                Contributors
                <span className="text-xs text-muted-foreground">Recommended</span>
            </span>
            <div className="flex flex-col gap-4">
                {authors.map((author, idx) => (
                    <details key={ids[idx] ?? `i${idx}`} className="border border-border rounded-md shadow-sm [&[open]_summary_[data-chevron]]:rotate-180" open={openId === (ids[idx] ?? `i${idx}`)} onToggle={(e) => { const id = ids[idx] ?? `i${idx}`; if (e.currentTarget.open) setOpenId(id); else if (openId === id) setOpenId(null); }}>
                        <summary className="pl-3 cursor-pointer w-full h-9 flex justify-between items-center">
                            <span className="leading-none">{previewName(author)}</span>
                            <div className="flex gap-2 items-center">
                                <ChevronDown size={16} strokeWidth={1.5} className="transform transition-transform duration-100" data-chevron />
                                <Button variant="ghost" size="icon" className="p-0" onClick={() => handleDelete(idx)}>
                                    <Trash2 size={16} strokeWidth={1.5} />
                                </Button>
                            </div>
                        </summary>
                        <Line />
                        <div className="p-4 pb-5 pt-3">
                            <Tabs defaultValue={isPerson(author) ? 'person' : 'organization'}>
                                <TabsList className="mt-1 mb-4">
                                    <TabsTrigger value="person">Person</TabsTrigger>
                                    <TabsTrigger value="organization">Organization</TabsTrigger>
                                </TabsList>
                                <TabsContent value="person" className="flex flex-col gap-4">
                                    <LabelledInput
                                        label="First Name"
                                        recommended
                                        value={isPerson(author) ? (author.given || '') : ''}
                                        onChange={(v) => handleEdit(idx, { given: v } as any)}
                                    />
                                    <LabelledInput
                                        label="Last Name"
                                        recommended
                                        value={isPerson(author) ? author.family : ''}
                                        onChange={(v) => handleEdit(idx, { family: v } as any)}
                                    />
                                    <LabelledInput
                                        label="Suffix"
                                        value={isPerson(author) ? (author.suffix || '') : ''}
                                        onChange={(v) => handleEdit(idx, { suffix: v } as any)}
                                    />
                                </TabsContent>
                                <TabsContent value="organization" className="flex flex-col gap-4">
                                    <LabelledInput
                                        label="Name"
                                        recommended
                                        value={!isPerson(author) ? author.literal : ''}
                                        onChange={(v) => handleEdit(idx, { literal: v } as any)}
                                    />
                                </TabsContent>
                            </Tabs>
                        </div>
                    </details>
                ))}
                <div className="flex gap-4 items-center">
                    <Button variant="secondary" className="gap-2" onClick={handleAddPerson}>
                        <UserRound size={17} strokeWidth={1.5} />
                        <span className="leading-none">Add Person</span>
                    </Button>
                    <Button variant="secondary" className="gap-2" onClick={handleAddOrganization}>
                        <Building2 size={17} strokeWidth={1.5} />
                        <span className="leading-none">Add Organization</span>
                    </Button>
                </div>
                <FieldWarningText warning={warning} />
            </div>
        </div>
    );
};

const LabelledInput = ({ label, value, onChange, recommended }: { label: string; value: string; onChange: (v: string) => void; recommended?: boolean }) => (
    <label className="flex flex-col gap-1 sm:grid sm:grid-cols-[110px_1fr] sm:items-center sm:gap-4">
        <span className="flex flex-col leading-4 text-sm">
            {label}
            {recommended && <span className="text-xs text-muted-foreground">Recommended</span>}
        </span>
        <Input placeholder={label} type="text" value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
);

const FieldWarningText = ({ warning }: { warning?: FieldWarning }) => {
    if (!warning) return null;
    const handleDismiss = (event: React.MouseEvent<HTMLButtonElement>) => {
        event.preventDefault();
        event.stopPropagation();
        warning.onDismiss?.();
    };
    return (
        <p
            className={cn("m-0 flex items-center gap-1.5 text-xs leading-5", styles.fieldWarningText)}
            data-severity={warning.severity || 'review'}
        >
            <AlertTriangle size={13} strokeWidth={1.7} className="shrink-0" aria-hidden="true" />
            <span className={styles.fieldWarningMessage}>{warning.message}</span>
            {warning.dismissible && warning.onDismiss && (
                <button
                    type="button"
                    className={styles.fieldWarningDismiss}
                    onClick={handleDismiss}
                    aria-label={`Dismiss warning: ${warning.message}`}
                    title="Dismiss warning"
                >
                    <X className={styles.fieldWarningDismissIcon} aria-hidden="true" />
                </button>
            )}
        </p>
    );
};

const FieldInputStack = ({ children, warning }: { children: React.ReactNode; warning?: FieldWarning }) => (
    <div className="flex min-w-0 flex-col gap-1.5">
        {children}
        <FieldWarningText warning={warning} />
    </div>
);

/**
 * Title component
 * @param value - The value to display
 * @param onChange - The function to call when the value changes
 * @param isRequired - Whether the field is required
 * @param isRecommended - Whether the field is recommended
 */
export const Title = ({ value, onChange, isRequired, isRecommended, warning }: TextComponentProps) => {
    return (
        <label className="flex flex-col gap-1 sm:grid sm:grid-cols-[130px_1fr] sm:items-center sm:gap-4">
            <span className="flex flex-col leading-4 text-sm">
                Title
                {isRequired && <span className="text-xs text-muted-foreground">Required</span>}
                {isRecommended && <span className="text-xs text-muted-foreground">Recommended</span>}
            </span>
            <FieldInputStack warning={warning}>
                <Input
                    placeholder="Title"
                    type="text"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                />
            </FieldInputStack>
        </label>
    )
}

/**
 * Name component
 * @param value - The value to display
 * @param onChange - The function to call when the value changes
 * @param isRequired - Whether the field is required
 * @param isRecommended - Whether the field is recommended
 */
export const Name = ({ value, onChange, isRequired, isRecommended, warning }: TextComponentProps) => {
    return (
        <label className="flex flex-col gap-1 sm:grid sm:grid-cols-[130px_1fr] sm:items-center sm:gap-4">
            <span className="flex flex-col leading-4 text-sm">
                Name
                {isRequired && <span className="text-xs text-muted-foreground">Required</span>}
                {isRecommended && <span className="text-xs text-muted-foreground">Recommended</span>}
            </span>
            <FieldInputStack warning={warning}>
                <Input
                    placeholder="Name"
                    type="text"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                />
            </FieldInputStack>
        </label>
    )
}

/**
 * Website name component
 * @param value - The value to display
 * @param onChange - The function to call when the value changes
 * @param isRequired - Whether the field is required
 * @param isRecommended - Whether the field is recommended
 */
export const WebsiteName = ({ value, onChange, isRequired, isRecommended, warning }: TextComponentProps) => {
    return (
        <label className="flex flex-col gap-1 sm:grid sm:grid-cols-[130px_1fr] sm:items-center sm:gap-4">
            <span className="flex flex-col leading-4 text-sm">
                Website Name
                {isRequired && <span className="text-xs text-muted-foreground">Required</span>}
                {isRecommended && <span className="text-xs text-muted-foreground">Recommended</span>}
            </span>
            <FieldInputStack warning={warning}>
                <Input
                    placeholder="Website Name"
                    type="text"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                />
            </FieldInputStack>
        </label>
    )
}

/**
 * Edition component
 * @param value - The value to display
 * @param onChange - The function to call when the value changes
 * @param isRequired - Whether the field is required
 * @param isRecommended - Whether the field is recommended
 */
export const Edition = ({ value, onChange, isRequired, isRecommended, warning }: TextComponentProps) => {
    return (
        <label className="flex flex-col gap-1 sm:grid sm:grid-cols-[130px_1fr] sm:items-center sm:gap-4">
            <span className="flex flex-col leading-4 text-sm">
                Edition
                {isRequired && <span className="text-xs text-muted-foreground">Required</span>}
                {isRecommended && <span className="text-xs text-muted-foreground">Recommended</span>}
            </span>
            <FieldInputStack warning={warning}>
                <Input
                    placeholder="e.g., 3"
                    type="text"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                />
            </FieldInputStack>
        </label>
    )
}

/**
 * Volume number component
 * @param value - The value to display
 * @param onChange - The function to call when the value changes
 * @param isRequired - Whether the field is required
 * @param isRecommended - Whether the field is recommended
 */
export const VolumeNumber = ({ value, onChange, isRequired, isRecommended, warning }: TextComponentProps) => {
    return (
        <label className="flex flex-col gap-1 sm:grid sm:grid-cols-[130px_1fr] sm:items-center sm:gap-4">
            <span className="flex flex-col leading-4 text-sm">
                Volume Number
                {isRequired && <span className="text-xs text-muted-foreground">Required</span>}
                {isRecommended && <span className="text-xs text-muted-foreground">Recommended</span>}
            </span>
            <FieldInputStack warning={warning}>
                <Input
                    placeholder="Volume number"
                    type="text"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                />
            </FieldInputStack>
        </label>
    )
}

export const IssueNumber = ({ value, onChange, isRequired, isRecommended, warning }: TextComponentProps) => {
    return (
        <label className="flex flex-col gap-1 sm:grid sm:grid-cols-[130px_1fr] sm:items-center sm:gap-4">
            <span className="flex flex-col leading-4 text-sm">
                Issue Number
                {isRequired && <span className="text-xs text-muted-foreground">Required</span>}
                {isRecommended && <span className="text-xs text-muted-foreground">Recommended</span>}
            </span>
            <FieldInputStack warning={warning}>
                <Input
                    placeholder="Issue number"
                    type="text"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                />
            </FieldInputStack>
        </label>
    )
}

export const PageRange = ({ value, onChange, isRequired, isRecommended, warning }: TextComponentProps) => {
    return (
        <label className="flex flex-col gap-1 sm:grid sm:grid-cols-[130px_1fr] sm:items-center sm:gap-4">
            <span className="flex flex-col leading-4 text-sm">
                Page Range
                {isRequired && <span className="text-xs text-muted-foreground">Required</span>}
                {isRecommended && <span className="text-xs text-muted-foreground">Recommended</span>}
            </span>
            <FieldInputStack warning={warning}>
                <Input
                    placeholder="Page range"
                    type="text"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                />
            </FieldInputStack>
        </label>
    )
}

export const JournalName = ({ value, onChange, isRequired, isRecommended, warning }: TextComponentProps) => {
    return (
        <label className="flex flex-col gap-1 sm:grid sm:grid-cols-[130px_1fr] sm:items-center sm:gap-4">
            <span className="flex flex-col leading-4 text-sm">
                Journal Name
                {isRequired && <span className="text-xs text-muted-foreground">Required</span>}
                {isRecommended && <span className="text-xs text-muted-foreground">Recommended</span>}
            </span>
            <FieldInputStack warning={warning}>
                <Input
                    placeholder="Journal name"
                    type="text"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                />
            </FieldInputStack>
        </label>
    )
}

/**
 * Publisher component
 * @param value - The value to display
 * @param onChange - The function to call when the value changes
 * @param isRequired - Whether the field is required
 * @param isRecommended - Whether the field is recommended
 */
export const Publisher = ({ value, onChange, isRequired, isRecommended, warning }: TextComponentProps) => {
    return (
        <label className="flex flex-col gap-1 sm:grid sm:grid-cols-[130px_1fr] sm:items-center sm:gap-4">
            <span className="flex flex-col leading-4 text-sm">
                Publisher
                {isRequired && <span className="text-xs text-muted-foreground">Required</span>}
                {isRecommended && <span className="text-xs text-muted-foreground">Recommended</span>}
            </span>
            <FieldInputStack warning={warning}>
                <Input
                    placeholder="Publisher"
                    type="text"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                />
            </FieldInputStack>
        </label>
    )
}

/**
 * Medium component
 * @param value - The value to display
 * @param onChange - The function to call when the value changes
 * @param isRequired - Whether the field is required
 * @param isRecommended - Whether the field is recommended
 */
export const Medium = ({ value, onChange, isRequired, isRecommended, warning }: TextComponentProps) => {
    return (
        <label className="flex flex-col gap-1 sm:grid sm:grid-cols-[130px_1fr] sm:items-center sm:gap-4">
            <span className="flex flex-col leading-4 text-sm">
                Genre / Medium
                {isRequired && <span className="text-xs text-muted-foreground">Required</span>}
                {isRecommended && <span className="text-xs text-muted-foreground">Recommended</span>}
            </span>
            <FieldInputStack warning={warning}>
                <Input
                    placeholder="e.g., Video"
                    type="text"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                />
            </FieldInputStack>
        </label>
    )
}

/**
 * DOI component
 * @param value - The value to display
 * @param onChange - The function to call when the value changes
 * @param isRequired - Whether the field is required
 * @param isRecommended - Whether the field is recommended
 */
export const DOI = ({ value, onChange, isRequired, isRecommended, warning }: TextComponentProps) => {
    return (
        <label className="flex flex-col gap-1 sm:grid sm:grid-cols-[130px_1fr] sm:items-center sm:gap-4">
            <span className="flex flex-col leading-4 text-sm">
                DOI
                {isRequired && <span className="text-xs text-muted-foreground">Required</span>}
                {isRecommended && <span className="text-xs text-muted-foreground">Recommended</span>}
            </span>
            <FieldInputStack warning={warning}>
                <Input
                    placeholder="DOI"
                    type="text"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                />
            </FieldInputStack>
        </label>
    )
}

/**
 * URL component
 * @param value - The value to display
 * @param onChange - The function to call when the value changes
 * @param isRequired - Whether the field is required
 * @param isRecommended - Whether the field is recommended
 */
export const URL = ({ value, onChange, isRequired, isRecommended, warning }: TextComponentProps) => {
    return (
        <label className="flex flex-col gap-1 sm:grid sm:grid-cols-[130px_1fr] sm:items-center sm:gap-4">
            <span className="flex flex-col leading-4 text-sm">
                URL
                {isRequired && <span className="text-xs text-muted-foreground">Required</span>}
                {isRecommended && <span className="text-xs text-muted-foreground">Recommended</span>}
            </span>
            <FieldInputStack warning={warning}>
                <Input
                    placeholder="Website URL"
                    type="text"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                />
            </FieldInputStack>
        </label>
    )
}

/**
 * Build a CSLDate from year/month/day input values. Returns undefined if nothing is set.
 */
function buildCslDate(year: number, month: number, day: number): CSLDate | undefined {
    if (year > 0 && month > 0 && day > 0) {
        return { 'date-parts': [[year, month, day]] };
    }
    if (year > 0 && month > 0) {
        return { 'date-parts': [[year, month]] };
    }
    if (year > 0) {
        return { 'date-parts': [[year]] };
    }
    return undefined;
}

// Reject 4-digit years that are clearly out of range (pre-1000, or beyond next
// year). Returns '' to clear the input; shorter typed-in-progress values pass.
function validateYear(value: string): string {
    const yearNum = parseInt(value);
    const currentYear = new Date().getFullYear();
    if (value.length >= 4 && (yearNum > currentYear + 1 || yearNum < 1000)) {
        return '';
    }
    return value;
}

// Reject day values outside 1–31. Returns '' to clear the input on bad input.
function validateDay(value: string): string {
    const dayNum = parseInt(value);
    if (dayNum < 1 || dayNum > 31 || isNaN(dayNum)) {
        return '';
    }
    return value;
}

function deriveDateParts(value: CSLDate | undefined): { year: string; month: string; day: string } {
    const parts = value?.['date-parts']?.[0];
    return {
        year: parts?.[0] ? String(parts[0]) : '',
        month: parts?.[1] ? String(parts[1]) : '',
        day: parts?.[2] ? String(parts[2]) : '',
    };
}

/**
 * Shared year/month/day input grid for PublicationDate and AccessDate.
 *
 * Local state for year/month/day is the source of truth for what's IN the
 * inputs. `value` is only seeded on mount and updated externally via the
 * imperative `setToToday` (exposed through `showSetToday`). The reason for
 * the local-state shape: buildCslDate emits `undefined` whenever year is
 * unset, so a fully value-derived implementation silently drops partial
 * entry (typed day without year, picked month without year) and cascades
 * year-clear into wiping month/day too.
 */
const DateInput = ({ value, onChange, showSetToday }: {
    value: CSLDate | undefined;
    onChange: (v: CSLDate | undefined) => void;
    showSetToday?: boolean;
}) => {
    const initial = useMemo(() => deriveDateParts(value), []);
    const [year, setYear] = useState(initial.year);
    const [month, setMonth] = useState(initial.month);
    const [day, setDay] = useState(initial.day);

    const emit = (y: string, m: string, d: string) => {
        onChange(buildCslDate(parseInt(y) || 0, parseInt(m) || 0, parseInt(d) || 0));
    };

    const handleYear = (raw: string) => {
        const v = validateYear(raw);
        setYear(v);
        emit(v, month, day);
    };
    const handleMonth = (raw: string) => {
        setMonth(raw);
        emit(year, raw, day);
    };
    const handleDay = (raw: string) => {
        const v = validateDay(raw);
        setDay(v);
        emit(year, month, v);
    };

    const handleSetToToday = () => {
        const today = new Date();
        const y = String(today.getFullYear());
        const m = String(today.getMonth() + 1);
        const d = String(today.getDate());
        setYear(y);
        setMonth(m);
        setDay(d);
        emit(y, m, d);
    };

    return (
        <div>
            <div className="grid grid-cols-[minmax(0,3.5rem)_minmax(0,1fr)_minmax(0,3.5rem)] items-center gap-2 sm:gap-4">
                <Input
                    placeholder="Year"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={year}
                    onChange={(e) => handleYear(e.target.value.replace(/\D/g, ''))}
                />
                <SimpleDropdown
                    options={months}
                    value={month ? months[parseInt(month) - 1] : undefined}
                    onChange={(option) => handleMonth(option.value)}
                    placeholder="Month"
                    className="min-w-0"
                />
                <Input
                    placeholder="Day"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={day}
                    onChange={(e) => handleDay(e.target.value.replace(/\D/g, ''))}
                />
            </div>
            {showSetToday && (
                <Button variant="secondary" className="gap-2 mt-4" onClick={handleSetToToday}>
                    <Calendar size={17} strokeWidth={1.5} />
                    <span className="leading-none">Set to Today</span>
                </Button>
            )}
        </div>
    );
};

/**
 * Publication Date component — emits CSL-JSON `date-parts` shape.
 */
export const PublicationDate = ({ value, onChange, isRequired, isRecommended, warning }: DateComponentProps) => (
    <div className="flex flex-col gap-1 sm:grid sm:grid-cols-[130px_1fr] sm:items-center sm:gap-4">
        <span className="flex flex-col leading-4 text-sm">
            Publication Date
            {isRequired && <span className="text-xs text-muted-foreground">Required</span>}
            {isRecommended && <span className="text-xs text-muted-foreground">Recommended</span>}
        </span>
        <FieldInputStack warning={warning}>
            <DateInput value={value} onChange={onChange} />
        </FieldInputStack>
    </div>
);

/**
 * Access Date component — emits CSL-JSON `date-parts` shape.
 */
export const AccessDate = ({ value, onChange, isRequired, isRecommended, warning }: DateComponentProps) => (
    <div className="flex flex-col gap-1 sm:grid sm:grid-cols-[130px_1fr] sm:gap-4">
        <span className="flex flex-col leading-4 text-sm h-9 justify-center">
            Access Date
            {isRequired && <span className="text-xs text-muted-foreground">Required</span>}
            {isRecommended && <span className="text-xs text-muted-foreground">Recommended</span>}
        </span>
        <FieldInputStack warning={warning}>
            <DateInput value={value} onChange={onChange} showSetToday />
        </FieldInputStack>
    </div>
);
