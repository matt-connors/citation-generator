import React, { useState } from "react";
import { Input } from "./Input";
import type { Author, CorporateAuthor, PersonAuthor, Source } from "../../lib/citations/definitions";
import { cn } from "./utils";
import { Button } from "./Button";
import { Building2, Calendar, ChevronDown, Trash2, UserRound } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./Tabs";
import type { Date } from "../../lib/citations/types";
import Dropdown from './Dropdown';
import type { Option } from './Dropdown';
import SimpleDropdown from './SimpleDropdown';

interface TextComponentProps {
    value: string;
    onChange: (value: string) => void;
    isRequired?: boolean;
    isRecommended?: boolean;
}

interface DateComponentProps {
    value: Date;
    onChange: (value: Date) => void;
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

/**
 * Contributors component
 * @param source - The source to edit
 * @param setSources - The function to set the sources
 */
export const Contributors = ({ source, setSources }: { source: Source, setSources: React.Dispatch<React.SetStateAction<Source[]>> }) => {

    const [lastOpenedAuthorId, setLastOpenedAuthorId] = useState<number | null>(null);

    /**
     * Delete an author from the source
     * @param author - The author to delete
     */
    const handleDelete = (author: Author) => {
        setSources((prevSources: any) => {
            const updatedSources = prevSources.map((source) => {
                if (source.uuid === source.uuid) {
                    return {
                        ...source,
                        citationInfo: {
                            ...source.citationInfo,
                            authors: source.citationInfo.authors.filter((_author) => _author !== author)
                        }
                    };
                }
                return source;
            });
            return updatedSources;
        });
    }

    const handleAddContributor = (type: "person" | "organization") => {

        let newAuthorId = source.citationInfo.authors.length + 1;

        // Update the source to initialize a new contributor
        setSources((prevSources: any) => {
            const updatedSources = prevSources.map((source) => {
                if (source.uuid === source.uuid) {
                    return {
                        ...source,
                        citationInfo: {
                            ...source.citationInfo,
                            authors: [...source.citationInfo.authors, { type, id: newAuthorId } as Author]
                        }
                    }
                }
                return source;
            });
            return updatedSources;
        });
        setLastOpenedAuthorId(newAuthorId);
    }

    const handleEditAuthor = (authorId: number, field: string, value: string) => {
        setSources((prevSources: any) => {
            const updatedSources = prevSources.map((source) => {
                if (source.uuid === source.uuid) {
                    return {
                        ...source,
                        citationInfo: {
                            ...source.citationInfo,
                            authors: source.citationInfo.authors.map((author) => {
                                if (author.id === authorId) {
                                    return {
                                        ...author,
                                        [field]: value
                                    }
                                }
                                return author;
                            })
                        }
                    };
                }
                return source;
            });
            return updatedSources;
        });
    }

    const AuthorPreviewName = (author: Author) => {
        if (author.type === "person") {
            return author.firstName || author.lastName
                ? <span>{author.firstName} {author.lastName}</span>
                : <span>{author.initials}</span>
        }
        else {
            return <span>{author.name}</span>
        }
    }

    return (
        <div className="grid grid-cols-[130px_1fr] gap-4">
            <span className="flex flex-col leading-4 text-sm h-9 justify-center">
                Contributors
                <span className="text-xs text-muted-foreground">Recommended</span>
            </span>
            <div className="flex flex-col gap-4">
                {source.citationInfo.authors.map((author) => (
                    <details className="border border-border rounded-md shadow-sm [&[open]_summary_[data-chevron]]:rotate-180" open={author.id === lastOpenedAuthorId}>
                        <summary className="pl-3 cursor-pointer w-full h-9 flex justify-between items-center">
                            <span className="leading-none">{AuthorPreviewName(author)}</span>
                            <div className="flex gap-2 items-center">
                                <ChevronDown size={16} strokeWidth={1.5} className="transform transition-transform duration-100" data-chevron />
                                <Button variant="ghost" size="icon" className="p-0" onClick={() => handleDelete(author)}>
                                    <Trash2 size={16} strokeWidth={1.5} />
                                </Button>
                            </div>
                        </summary>
                        <Line />
                        <div className="p-4 pb-5 pt-3">
                            <Tabs defaultValue={author.type}>
                                <TabsList className="mt-1 mb-4">
                                    <TabsTrigger value="person">Person</TabsTrigger>
                                    <TabsTrigger value="organization">Organization</TabsTrigger>
                                </TabsList>
                                <TabsContent value="person" className="flex flex-col gap-4">
                                    {/* Title */}
                                    <label className="grid grid-cols-[110px_1fr] items-center gap-4">
                                        <span className="flex flex-col leading-4 text-sm">
                                            Title
                                        </span>
                                        <Input
                                            placeholder="Title"
                                            type="text"
                                            value={(author as PersonAuthor).title}
                                            onChange={(e) => handleEditAuthor(author.id, "title", e.target.value)}
                                        />
                                    </label>
                                    {/* Initials */}
                                    <label className="grid grid-cols-[110px_1fr] items-center gap-4">
                                        <span className="flex flex-col leading-4 text-sm">
                                            Initials
                                        </span>
                                        <Input
                                            placeholder="Initials"
                                            type="text"
                                            value={(author as PersonAuthor).initials}
                                            onChange={(e) => handleEditAuthor(author.id, "initials", e.target.value)}
                                        />
                                    </label>
                                    {/* First Name */}
                                    <label className="grid grid-cols-[110px_1fr] items-center gap-4">
                                        <span className="flex flex-col leading-4 text-sm">
                                            First Name
                                            <span className="text-xs text-muted-foreground">Recommended</span>
                                        </span>
                                        <Input
                                            placeholder="First Name"
                                            type="text"
                                            value={(author as PersonAuthor).firstName}
                                            onChange={(e) => handleEditAuthor(author.id, "firstName", e.target.value)}
                                        />
                                    </label>
                                    {/* Last Name */}
                                    <label className="grid grid-cols-[110px_1fr] items-center gap-4">
                                        <span className="flex flex-col leading-4 text-sm">
                                            Last Name
                                            <span className="text-xs text-muted-foreground">Recommended</span>
                                        </span>
                                        <Input
                                            placeholder="Last Name"
                                            type="text"
                                            value={(author as PersonAuthor).lastName}
                                            onChange={(e) => handleEditAuthor(author.id, "lastName", e.target.value)}
                                        />
                                    </label>
                                </TabsContent>
                                <TabsContent value="organization" className="flex flex-col gap-4">
                                    {/* Name */}
                                    <label className="grid grid-cols-[110px_1fr] items-center gap-4">
                                        <span className="flex flex-col leading-4 text-sm">
                                            Name
                                            <span className="text-xs text-muted-foreground">Recommended</span>
                                        </span>
                                        <Input
                                            placeholder="Name"
                                            type="text"
                                            value={(author as CorporateAuthor).name}
                                            onChange={(e) => handleEditAuthor(author.id, "name", e.target.value)}
                                        />
                                    </label>
                                </TabsContent>
                            </Tabs>
                        </div>
                    </details>
                ))}
                <div className="flex gap-4 items-center">
                    <Button variant="secondary" className="gap-2" onClick={() => handleAddContributor("person")}>
                        <UserRound size={17} strokeWidth={1.5} />
                        <span className="leading-none">Add Person</span>
                    </Button>
                    <Button variant="secondary" className="gap-2" onClick={() => handleAddContributor("organization")}>
                        <Building2 size={17} strokeWidth={1.5} />
                        <span className="leading-none">Add Organization</span>
                    </Button>
                </div>
            </div>

        </div>
    )
}

/**
 * Title component
 * @param value - The value to display
 * @param onChange - The function to call when the value changes
 * @param isRequired - Whether the field is required
 * @param isRecommended - Whether the field is recommended
 */
export const Title = ({ value, onChange, isRequired, isRecommended }: TextComponentProps) => {
    return (
        <label className="grid grid-cols-[130px_1fr] items-center gap-4">
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
        <label className="grid grid-cols-[130px_1fr] items-center gap-4">
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
        <label className="grid grid-cols-[130px_1fr] items-center gap-4">
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
        <label className="grid grid-cols-[130px_1fr] items-center gap-4">
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
        <label className="grid grid-cols-[130px_1fr] items-center gap-4">
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
 * Publsiher component
 * @param value - The value to display
 * @param onChange - The function to call when the value changes
 * @param isRequired - Whether the field is required
 * @param isRecommended - Whether the field is recommended
 */
export const Publsiher = ({ value, onChange, isRequired, isRecommended }: TextComponentProps) => {
    return (
        <label className="grid grid-cols-[130px_1fr] items-center gap-4">
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
        <label className="grid grid-cols-[130px_1fr] items-center gap-4">
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
        <label className="grid grid-cols-[130px_1fr] items-center gap-4">
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
        <label className="grid grid-cols-[130px_1fr] items-center gap-4">
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
 * Publication Date component
 * @param value - The date to display
 * @param onChange - The function to call when the value changes
 * @param isRequired - Whether the field is required
 * @param isRecommended - Whether the field is recommended
 */
export const PublicationDate = ({ value, onChange, isRequired, isRecommended }: DateComponentProps) => {
    const [year, setYear] = useState(value?.year ? value.year.toString() : '');
    const [month, setMonth] = useState(value?.month ? value.month.toString() : '');
    const [day, setDay] = useState(value?.day ? value.day.toString() : '');

    const validateYear = (value: string) => {
        const yearNum = parseInt(value);
        const currentYear = new Date().getFullYear();
        // Only validate if we have a complete year
        if (value.length >= 4) {
            if (yearNum > currentYear + 1 || yearNum < 1000) {
                return '';
            }
        }
        return value;
    };

    const validateDay = (value: string) => {
        const dayNum = parseInt(value);
        if (dayNum < 1 || dayNum > 31 || isNaN(dayNum)) {
            return '';
        }
        return value;
    };

    const handleChange = (field: 'year' | 'month' | 'day', newValue: string) => {
        let validatedValue = newValue;

        if (field === 'year') {
            validatedValue = validateYear(newValue);
            setYear(validatedValue);
        }
        else if (field === 'month') {
            setMonth(newValue);
        }
        else if (field === 'day') {
            validatedValue = validateDay(newValue);
            setDay(validatedValue);
        }

        const updatedValue: Partial<Date> = {};
        const yearVal = field === 'year' ? parseInt(validatedValue) || 0 : parseInt(year) || 0;
        const monthVal = field === 'month' ? parseInt(newValue) || 0 : parseInt(month) || 0;
        const dayVal = field === 'day' ? parseInt(validatedValue) || 0 : parseInt(day) || 0;

        if (yearVal > 0) updatedValue.year = yearVal;
        if (monthVal > 0) updatedValue.month = monthVal;
        if (dayVal > 0) updatedValue.day = dayVal;

        onChange(updatedValue as Date);
    };

    return (
        <div className="grid grid-cols-[130px_1fr] items-center gap-4">
            <span className="flex flex-col leading-4 text-sm">
                Publication Date
                {isRequired && <span className="text-xs text-muted-foreground">Required</span>}
                {isRecommended && <span className="text-xs text-muted-foreground">Recommended</span>}
            </span>
            <div className="grid grid-cols-[1fr_1fr_1fr] items-center gap-4">
                <Input
                    placeholder="Year"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={year}
                    onChange={(e) => handleChange('year', e.target.value.replace(/\D/g, ''))}
                />
                <SimpleDropdown
                    options={months}
                    value={month ? months[parseInt(month) - 1] : undefined}
                    onChange={(option) => handleChange('month', option.value)}
                    placeholder="Month"
                    className="min-w-[7rem]"
                />
                <Input
                    placeholder="Day"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={day}
                    onChange={(e) => handleChange('day', e.target.value.replace(/\D/g, ''))}
                />
            </div>
        </div>
    );
};

/**
 * Access Date component
 * @param value - The date to display
 * @param onChange - The function to call when the value changes
 * @param isRequired - Whether the field is required
 * @param isRecommended - Whether the field is recommended
 */
export const AccessDate = ({ value, onChange, isRequired, isRecommended }: DateComponentProps) => {
    const [year, setYear] = useState(value?.year ? value.year.toString() : '');
    const [month, setMonth] = useState(value?.month ? value.month.toString() : '');
    const [day, setDay] = useState(value?.day ? value.day.toString() : '');

    const validateYear = (value: string) => {
        const yearNum = parseInt(value);
        const currentYear = new Date().getFullYear();
        // Only validate if we have a complete year
        if (value.length >= 4) {
            if (yearNum > currentYear + 1 || yearNum < 1000) {
                return '';
            }
        }
        return value;
    };

    const validateDay = (value: string) => {
        const dayNum = parseInt(value);
        if (dayNum < 1 || dayNum > 31 || isNaN(dayNum)) {
            return '';
        }
        return value;
    };

    const handleChange = (field: 'year' | 'month' | 'day', newValue: string) => {
        let validatedValue = newValue;

        if (field === 'year') {
            validatedValue = validateYear(newValue);
            setYear(validatedValue);
        }
        else if (field === 'month') {
            setMonth(newValue);
        }
        else if (field === 'day') {
            validatedValue = validateDay(newValue);
            setDay(validatedValue);
        }

        const updatedValue: Partial<Date> = {};
        const yearVal = field === 'year' ? parseInt(validatedValue) || 0 : parseInt(year) || 0;
        const monthVal = field === 'month' ? parseInt(newValue) || 0 : parseInt(month) || 0;
        const dayVal = field === 'day' ? parseInt(validatedValue) || 0 : parseInt(day) || 0;

        if (yearVal > 0) updatedValue.year = yearVal;
        if (monthVal > 0) updatedValue.month = monthVal;
        if (dayVal > 0) updatedValue.day = dayVal;

        onChange(updatedValue as Date);
    };

    const handleSetToToday = () => {
        const today = new Date();

        const year = today.getFullYear();
        const month = today.getMonth() + 1;
        const day = today.getDate();

        handleChange('year', year.toString());
        handleChange('month', month.toString());
        handleChange('day', day.toString());
    };

    return (
        <div className="grid grid-cols-[130px_1fr] gap-4">
            <span className="flex flex-col leading-4 text-sm h-9 justify-center">
                Access Date
                {isRequired && <span className="text-xs text-muted-foreground">Required</span>}
                {isRecommended && <span className="text-xs text-muted-foreground">Recommended</span>}
            </span>
            <div className="">
                <div className="grid grid-cols-[1fr_1fr_1fr] items-center gap-4">
                    <Input
                        placeholder="Year"
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={year}
                        onChange={(e) => handleChange('year', e.target.value.replace(/\D/g, ''))}
                    />
                    <SimpleDropdown
                        options={months}
                        value={month ? months[parseInt(month) - 1] : undefined}
                        onChange={(option) => handleChange('month', option.value)}
                        placeholder="Month"
                        className="min-w-[7rem]"
                    />
                    <Input
                        placeholder="Day"
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={day}
                        onChange={(e) => handleChange('day', e.target.value.replace(/\D/g, ''))}
                    />
                </div>
                <Button variant="secondary" className="gap-2 mt-4" onClick={handleSetToToday}>
                    <Calendar size={17} strokeWidth={1.5} />
                    <span className="leading-none">Set to Today</span>
                </Button>
            </div>
        </div>
    );
};