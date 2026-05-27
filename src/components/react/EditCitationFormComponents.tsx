import React, { useState, useMemo } from "react";
import { Input } from "./Input";
import { cn } from "./utils";
import { Button } from "./Button";
import { Building2, Calendar, ChevronDown, Trash2, UserRound } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./Tabs";
import type { CSLDate, CSLName } from "../../lib/citations/csl-types";
import type { StoredSource } from "../../lib/references/storage";
import type { Option } from './Dropdown';
import SimpleDropdown from './SimpleDropdown';

interface TextComponentProps {
    value: string;
    onChange: (value: string) => void;
    isRequired?: boolean;
    isRecommended?: boolean;
}

interface DateComponentProps {
    value: CSLDate | undefined;
    onChange: (value: CSLDate | undefined) => void;
    isRequired?: boolean;
    isRecommended?: boolean;
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
    source: StoredSource;
    setSources: (s: StoredSource[] | ((prev: StoredSource[]) => StoredSource[])) => void;
}

const isPerson = (n: CSLName): n is Exclude<CSLName, { literal: string }> => !('literal' in n);

/**
 * Contributors component — operates on CSL-JSON `author` arrays.
 */
export const Contributors = ({ source, setSources }: ContributorsProps) => {
    const authors = source.csl.author ?? [];
    const [lastOpenedIdx, setLastOpenedIdx] = useState<number | null>(null);

    const update = (next: CSLName[]) => {
        setSources((prev) => prev.map((s) =>
            s.uuid === source.uuid ? { ...s, csl: { ...s.csl, author: next } } : s,
        ));
    };

    const previewName = (n: CSLName) => {
        if (isPerson(n)) {
            return (n.given || n.family) ? <span>{n.given} {n.family}</span> : <span>—</span>;
        }
        return <span>{n.literal || '—'}</span>;
    };

    const handleEdit = (idx: number, patch: Partial<CSLName>) => {
        update(authors.map((a, i) => i === idx ? ({ ...a, ...patch } as CSLName) : a));
    };

    const handleAddPerson = () => {
        const next = [...authors, { family: '', given: '' } as CSLName];
        update(next);
        setLastOpenedIdx(next.length - 1);
    };

    const handleAddOrganization = () => {
        const next = [...authors, { literal: '' } as CSLName];
        update(next);
        setLastOpenedIdx(next.length - 1);
    };

    const handleDelete = (idx: number) => update(authors.filter((_, i) => i !== idx));

    return (
        <div className="flex flex-col gap-1 sm:grid sm:grid-cols-[130px_1fr] sm:gap-4">
            <span className="flex flex-col leading-4 text-sm h-9 justify-center">
                Contributors
                <span className="text-xs text-muted-foreground">Recommended</span>
            </span>
            <div className="flex flex-col gap-4">
                {authors.map((author, idx) => (
                    <details key={idx} className="border border-border rounded-md shadow-sm [&[open]_summary_[data-chevron]]:rotate-180" open={idx === lastOpenedIdx}>
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

/**
 * Title component
 * @param value - The value to display
 * @param onChange - The function to call when the value changes
 * @param isRequired - Whether the field is required
 * @param isRecommended - Whether the field is recommended
 */
export const Title = ({ value, onChange, isRequired, isRecommended }: TextComponentProps) => {
    return (
        <label className="flex flex-col gap-1 sm:grid sm:grid-cols-[130px_1fr] sm:items-center sm:gap-4">
            <span className="flex flex-col leading-4 text-sm">
                Title
                {isRequired && <span className="text-xs text-muted-foreground">Required</span>}
                {isRecommended && <span className="text-xs text-muted-foreground">Recommended</span>}
            </span>
            <Input
                placeholder="Title"
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
            />
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
export const Name = ({ value, onChange, isRequired, isRecommended }: TextComponentProps) => {
    return (
        <label className="flex flex-col gap-1 sm:grid sm:grid-cols-[130px_1fr] sm:items-center sm:gap-4">
            <span className="flex flex-col leading-4 text-sm">
                Name
                {isRequired && <span className="text-xs text-muted-foreground">Required</span>}
                {isRecommended && <span className="text-xs text-muted-foreground">Recommended</span>}
            </span>
            <Input
                placeholder="Name"
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
            />
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
export const WebsiteName = ({ value, onChange, isRequired, isRecommended }: TextComponentProps) => {
    return (
        <label className="flex flex-col gap-1 sm:grid sm:grid-cols-[130px_1fr] sm:items-center sm:gap-4">
            <span className="flex flex-col leading-4 text-sm">
                Website Name
                {isRequired && <span className="text-xs text-muted-foreground">Required</span>}
                {isRecommended && <span className="text-xs text-muted-foreground">Recommended</span>}
            </span>
            <Input
                placeholder="Website Name"
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
            />
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
export const Edition = ({ value, onChange, isRequired, isRecommended }: TextComponentProps) => {
    return (
        <label className="flex flex-col gap-1 sm:grid sm:grid-cols-[130px_1fr] sm:items-center sm:gap-4">
            <span className="flex flex-col leading-4 text-sm">
                Edition
                {isRequired && <span className="text-xs text-muted-foreground">Required</span>}
                {isRecommended && <span className="text-xs text-muted-foreground">Recommended</span>}
            </span>
            <Input
                placeholder="e.g., 3"
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
            />
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
export const VolumeNumber = ({ value, onChange, isRequired, isRecommended }: TextComponentProps) => {
    return (
        <label className="flex flex-col gap-1 sm:grid sm:grid-cols-[130px_1fr] sm:items-center sm:gap-4">
            <span className="flex flex-col leading-4 text-sm">
                Volume Number
                {isRequired && <span className="text-xs text-muted-foreground">Required</span>}
                {isRecommended && <span className="text-xs text-muted-foreground">Recommended</span>}
            </span>
            <Input
                placeholder="Volume number"
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
            />
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
export const Publisher = ({ value, onChange, isRequired, isRecommended }: TextComponentProps) => {
    return (
        <label className="flex flex-col gap-1 sm:grid sm:grid-cols-[130px_1fr] sm:items-center sm:gap-4">
            <span className="flex flex-col leading-4 text-sm">
                Publisher
                {isRequired && <span className="text-xs text-muted-foreground">Required</span>}
                {isRecommended && <span className="text-xs text-muted-foreground">Recommended</span>}
            </span>
            <Input
                placeholder="Publisher"
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
            />
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
export const Medium = ({ value, onChange, isRequired, isRecommended }: TextComponentProps) => {
    return (
        <label className="flex flex-col gap-1 sm:grid sm:grid-cols-[130px_1fr] sm:items-center sm:gap-4">
            <span className="flex flex-col leading-4 text-sm">
                Medium
                {isRequired && <span className="text-xs text-muted-foreground">Required</span>}
                {isRecommended && <span className="text-xs text-muted-foreground">Recommended</span>}
            </span>
            <Input
                placeholder="Medium"
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
            />
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
export const DOI = ({ value, onChange, isRequired, isRecommended }: TextComponentProps) => {
    return (
        <label className="flex flex-col gap-1 sm:grid sm:grid-cols-[130px_1fr] sm:items-center sm:gap-4">
            <span className="flex flex-col leading-4 text-sm">
                DOI
                {isRequired && <span className="text-xs text-muted-foreground">Required</span>}
                {isRecommended && <span className="text-xs text-muted-foreground">Recommended</span>}
            </span>
            <Input
                placeholder="DOI"
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
            />
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
export const URL = ({ value, onChange, isRequired, isRecommended }: TextComponentProps) => {
    return (
        <label className="flex flex-col gap-1 sm:grid sm:grid-cols-[130px_1fr] sm:items-center sm:gap-4">
            <span className="flex flex-col leading-4 text-sm">
                URL
                {isRequired && <span className="text-xs text-muted-foreground">Required</span>}
                {isRecommended && <span className="text-xs text-muted-foreground">Recommended</span>}
            </span>
            <Input
                placeholder="Website URL"
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
            />
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
export const PublicationDate = ({ value, onChange, isRequired, isRecommended }: DateComponentProps) => (
    <div className="flex flex-col gap-1 sm:grid sm:grid-cols-[130px_1fr] sm:items-center sm:gap-4">
        <span className="flex flex-col leading-4 text-sm">
            Publication Date
            {isRequired && <span className="text-xs text-muted-foreground">Required</span>}
            {isRecommended && <span className="text-xs text-muted-foreground">Recommended</span>}
        </span>
        <DateInput value={value} onChange={onChange} />
    </div>
);

/**
 * Access Date component — emits CSL-JSON `date-parts` shape.
 */
export const AccessDate = ({ value, onChange, isRequired, isRecommended }: DateComponentProps) => (
    <div className="flex flex-col gap-1 sm:grid sm:grid-cols-[130px_1fr] sm:gap-4">
        <span className="flex flex-col leading-4 text-sm h-9 justify-center">
            Access Date
            {isRequired && <span className="text-xs text-muted-foreground">Required</span>}
            {isRecommended && <span className="text-xs text-muted-foreground">Recommended</span>}
        </span>
        <DateInput value={value} onChange={onChange} showSetToday />
    </div>
);
