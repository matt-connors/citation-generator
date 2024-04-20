import React, { useState, useEffect } from "react";
import clsx from 'clsx';

import { ChevronDownIcon, CheckIcon } from '@heroicons/react/24/outline';

import styles from '../../styles/dropdown.module.css';
import parentStyles from '../../styles/citation-search.module.css';

export interface Option {
    label: string;
    value: string;
}

interface DropdownProps {
    options: Option[];
    defaultOption: Option;
    className: string;
    onChange?: (value: Option) => void;
}

export default function Dropdown({ options, defaultOption, className, onChange }: DropdownProps) {

    const [open, setOpen] = useState(false);
    const [matchingOptions, setMatchingOptions] = useState(options);
    const [selectedOption, setSelectedOption] = useState(defaultOption);


    // Handle opening/closing dropdown
    const handleOpen = (event: any) => {
        if (event.target.closest(`.${styles.dropdownBtn}`)) {
            setOpen(!open);
        }
    }

    // Handle clicks outside the dropdown
    const handleClickOutside = (event: any) => {
        if (event.target.closest(`.${styles.dropdown}`)) return;
        setOpen(false);
    }

    // Handle search filtering
    const handleSearch = (event: any) => {
        const searchValue = event.target.value.toLowerCase();
        const matching = options.filter((option) =>
            option.label.toLowerCase().includes(searchValue)
        );
        setMatchingOptions(matching.length > 0 ? matching : options);
    }

    // Handle option selection
    const handleDropdownClick = (event: any) => {
        setOpen(false);

        const buttonElement = event.currentTarget;
        const optionData = buttonElement.dataset.option;

        // If no option data found, log an error and return
        if (!optionData) {
            console.error('No option data found in the clicked button');
            return;
        }

        // Parse the option data
        let parsedOption: Option;
        try {
            parsedOption = JSON.parse(optionData);
        }
        catch (error) {
            console.error('Failed to parse option data', error);
            return;
        }

        // Set the selected option
        setSelectedOption(parsedOption);

        // Call the onChange callback
        if (onChange) {
            onChange(parsedOption);
        }
    }

    // Effect for adding/removing click event listener for outside clicks
    useEffect(() => {
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, []);

    return (
        <div className={`${styles.dropdown} ${className} ${clsx(open && styles.open)}`} onClick={handleOpen}>
            <input type="hidden" name="citationStyle" value={selectedOption.value} />
            <button className={styles.dropdownBtn} type="button">
                <span className={parentStyles.inputLabel}>Citation Style</span>
                <div className={styles.dropdownValue}>
                    <span>{selectedOption.label}</span>
                    <ChevronDownIcon className={styles.dropdownIcon} />
                </div>
            </button>
            <div className={styles.dropdownList}>
                <div className={styles.dropdownSearch}>
                    <input type="text" placeholder="Search" onChange={handleSearch} />
                </div>
                <ul>
                    {matchingOptions
                    // sort alphabetically
                    .sort((a, b) => a.label.localeCompare(b.label))
                    .map((option, index) => (
                        <li key={index}>
                            <button
                                type="button"
                                className={clsx(styles.dropdownOption, option.label === selectedOption.label && styles.selected)}
                                onClick={handleDropdownClick}
                                value={option.value}
                                data-option={JSON.stringify(option)}
                            >
                                <span>{option.label}</span>
                                <CheckIcon className={styles.dropdownCheck} />
                            </button>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
}