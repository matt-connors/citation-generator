import React, { useState, useEffect, useRef } from 'react';
import { ChevronDownIcon, CheckIcon } from '@heroicons/react/24/outline';
import { cn } from './utils';
import type { Option } from './Dropdown';

interface SimpleDropdownProps {
    options: Option[];
    value?: Option;
    onChange?: (option: Option) => void;
    className?: string;
    placeholder?: string;
}

export default function SimpleDropdown({ 
    options, 
    value, 
    onChange, 
    className,
    placeholder = "Select..." 
}: SimpleDropdownProps) {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className={cn("relative", className)} ref={dropdownRef}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={cn(
                    "flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 border-solid",
                    className
                )}
            >
                <span className="truncate leading-none">{value?.label || placeholder}</span>
                <ChevronDownIcon className="h-4 w-4 opacity-50" />
            </button>
            {isOpen && (
                <div className="absolute z-50 mt-1 max-h-[200px] w-full overflow-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md">
                    {options.map((option, index) => (
                        <button
                            key={index}
                            className={cn(
                                "relative flex w-full cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground",
                                value?.value === option.value && "bg-accent text-accent-foreground"
                            )}
                            onClick={() => {
                                onChange?.(option);
                                setIsOpen(false);
                            }}
                        >
                            <span className="flex-grow truncate text-left leading-none py-1">{option.label}</span>
                            {value?.value === option.value && (
                                <CheckIcon className="ml-2 h-4 w-4" />
                            )}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}