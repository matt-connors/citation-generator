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

// Platform metadata for social/video posts (TikTok, YouTube, Instagram, X).
// The styles disagree about how to present handles and descriptors — MLA wants
// "Cook, Phil [@chemteacherphil]" while APA wants "Cook, P. [@chemteacherphil]"
// plus a bracketed [Video] — so extraction records the raw facts here and the
// format layer shapes them per style at render time.
export interface SocialMeta {
  platform: 'tiktok' | 'youtube' | 'instagram' | 'x';
  /** Account handle without the @ sign, e.g. "chemteacherphil". */
  handle?: string;
  /** Display name as shown on the account, e.g. "Phillip Cook". */
  displayName?: string;
  /** What the post is, for styles that add a bracketed descriptor. */
  kind: 'video' | 'post' | 'photo';
}

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
  /** CSL genre (e.g. "Video" for APA YouTube [Video] descriptors). */
  genre?: string;
  /** CSL medium of publication when a style uses medium instead of genre. */
  medium?: string;
  abstract?: string;
  // CSL-JSON reserves `custom` for processor-ignored extension data; citeproc
  // passes it through untouched and it round-trips localStorage → /api/format.
  custom?: { social?: SocialMeta };
}

export type AcquisitionSource =
  | 'fetch'
  | 'render'
  | 'ai'
  | 'authority'
  | 'extension'
  | 'paste'
  | 'input'
  | 'user';

export type EvidenceSource =
  | 'input'
  | 'jsonld'
  | 'microdata'
  | 'opengraph'
  | 'twitter'
  | 'meta'
  | 'heuristic'
  | 'platform'
  | 'oembed'
  | 'fetch-html'
  | 'rendered-html'
  | 'browser-extension'
  | 'pasted-text'
  | 'crossref'
  | 'openalex'
  | 'openlibrary'
  | 'google-books'
  | 'ai-extract'
  | 'type-inference'
  | 'user-edit';

export interface FieldEvidence {
  field: keyof CSLItem;
  normalizedValue: unknown;
  rawValue?: string;
  source: EvidenceSource;
  acquisition?: AcquisitionSource;
  locator?: string;
  snippet?: string;
  confidence: number;
  acquiredAt?: string;
}

export interface FieldProvenance {
  winner?: FieldEvidence;
  candidates: FieldEvidence[];
  conflicts: FieldEvidence[];
}

export type AcquisitionStatus =
  | 'success'
  | 'partial'
  | 'blocked'
  | 'timeout'
  | 'error'
  | 'skipped';

export interface AcquisitionAttempt {
  source: AcquisitionSource;
  status: AcquisitionStatus;
  reason?: string;
  url?: string;
  finalUrl?: string;
  durationMs?: number;
  htmlSizeKb?: number;
  browserMs?: number;
  fieldsFound?: string[];
}

export interface CitationQualityWarning {
  code: string;
  field?: keyof CSLItem;
  severity: 'info' | 'review' | 'warning' | 'error';
  message: string;
  action:
    | 'none'
    | 'review-field'
    | 'choose-source-type'
    | 'confirm-no-listed-author'
    | 'try-rendered-page'
    | 'use-extension'
    | 'paste-text'
    | 'enter-manually';
  evidence?: FieldEvidence[];
}

export interface ExtractQuality {
  score: number;
  warnings: CitationQualityWarning[];
  acquisition?: Partial<Record<AcquisitionSource, AcquisitionAttempt>>;
}

export interface ExtractEnvelope {
  uuid: string;
  type: CSLType;
  csl: CSLItem;
  _signals?: Record<string, string>;
  _provenance?: Partial<Record<keyof CSLItem, FieldProvenance>>;
  _quality?: ExtractQuality;
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
