import type { SupportedStyle } from '../lib/citations/csl-types';

export interface CitationStyleOption {
  label: string;
  value: SupportedStyle;
  default?: boolean;
}

const citationStyles: CitationStyleOption[] = [
  { label: 'MLA 9th edition', value: 'mla-9', default: true },
  { label: 'APA 7th edition', value: 'apa-7' },
  { label: 'Chicago 18th edition', value: 'chicago-18' },
  { label: 'AMA 11th edition', value: 'ama-11' },
  { label: 'Harvard', value: 'harvard' },
  { label: 'IEEE', value: 'ieee' },
  { label: 'Vancouver', value: 'vancouver' },
].sort((a, b) => a.label.localeCompare(b.label));

export default citationStyles;
