export type CSLNamePerson = {
  family: string;
  given?: string;
  'non-dropping-particle'?: string;
  'dropping-particle'?: string;
  suffix?: string;
};

export type CSLNameLiteral = { literal: string };

export type CSLName = CSLNamePerson | CSLNameLiteral;

export type CSLDateParts =
  | [number]
  | [number, number]
  | [number, number, number];

export type CSLDate = {
  'date-parts': CSLDateParts[];
  literal?: string;
  raw?: string;
};

export type CSLType =
  | 'webpage'
  | 'book'
  | 'article-journal'
  | 'article-magazine'
  | 'article-newspaper';

export interface CSLItem {
  id: string;
  type: CSLType;
  title?: string;
  author?: CSLName[];
  editor?: CSLName[];
  issued?: CSLDate;
  accessed?: CSLDate;
  URL?: string;
  DOI?: string;
  ISBN?: string;
  'container-title'?: string;
  publisher?: string;
  'publisher-place'?: string;
  volume?: string;
  issue?: string;
  page?: string;
  edition?: string;
  abstract?: string;
}

export interface ExtractEnvelope {
  uuid: string;
  type: CSLType;
  csl: CSLItem;
  _signals?: Record<string, string>;
  _cached?: boolean;
}

export type SupportedStyle =
  | 'mla-9'
  | 'apa-7'
  | 'chicago-18'
  | 'ama-11'
  | 'harvard'
  | 'ieee'
  | 'vancouver';

export interface FormatRequest {
  csl: CSLItem;
  style: SupportedStyle;
}

export interface RichText {
  text: string;
  italic?: boolean;
}

export interface FormatResponse {
  formatted: RichText[];
}
