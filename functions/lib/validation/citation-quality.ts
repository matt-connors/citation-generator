import type {
  AcquisitionAttempt,
  AcquisitionSource,
  CitationQualityWarning,
  CSLItem,
  FieldEvidence,
  FieldProvenance,
  SupportedStyle,
  ExtractQuality,
} from '../csl-types';

export interface ValidateCitationOptions {
  style?: SupportedStyle;
  provenance?: Partial<Record<keyof CSLItem, FieldProvenance>>;
  acquisition?: Partial<Record<AcquisitionSource, AcquisitionAttempt>>;
}

export function validateCitationQuality(csl: CSLItem, options: ValidateCitationOptions = {}): ExtractQuality {
  const warnings: CitationQualityWarning[] = [];
  const provenance = options.provenance ?? {};

  if (!hasText(csl.title)) {
    warnings.push({
      code: 'title_missing',
      field: 'title',
      severity: 'error',
      message: 'No title was found. A citation usually needs a source title before it is ready to use.',
      action: 'review-field',
    });
  }

  if (!hasAuthors(csl)) {
    warnings.push({
      code: 'author_not_found',
      field: 'author',
      severity: 'review',
      message: 'No author was found. If this source lists a person or organization, add it. If the page has no listed author, this may be correct.',
      action: 'confirm-no-listed-author',
    });
  }

  if (!hasIssuedDate(csl)) {
    warnings.push({
      code: 'date_not_found',
      field: 'issued',
      severity: 'review',
      message: 'No publication date was found. Review the source for a posted or updated date; otherwise the citation will use the style\'s no-date fallback.',
      action: 'review-field',
    });
  }

  if (csl.type === 'webpage' && !hasText(csl.URL)) {
    warnings.push({
      code: 'url_missing',
      field: 'URL',
      severity: 'error',
      message: 'No URL was found for this web source. Add the source URL before using the citation.',
      action: 'review-field',
    });
  }

  if (csl.type === 'article-journal') {
    if (!hasText(csl['container-title'])) {
      warnings.push({
        code: 'journal_title_missing',
        field: 'container-title',
        severity: 'warning',
        message: 'No journal name was found. Journal articles usually need the journal title for an accurate citation.',
        action: 'review-field',
      });
    }
    if (!hasText(csl.volume)) {
      warnings.push({
        code: 'journal_volume_missing',
        field: 'volume',
        severity: 'review',
        message: 'No volume number was found. Add it if the article page or DOI record lists one.',
        action: 'review-field',
      });
    }
    if (!hasText(csl.page) && !hasText(csl.DOI) && !hasText(csl.URL)) {
      warnings.push({
        code: 'journal_locator_missing',
        field: 'page',
        severity: 'warning',
        message: 'No page range, DOI, or URL was found. Add at least one stable locator if the source provides it.',
        action: 'review-field',
      });
    }
  }

  for (const [field, item] of Object.entries(provenance) as Array<[keyof CSLItem, FieldProvenance]>) {
    if (item.conflicts.length > 0) {
      warnings.push({
        code: `${String(field)}_conflict`,
        field,
        severity: field === 'DOI' ? 'warning' : 'review',
        message: conflictMessage(field),
        action: 'review-field',
        evidence: compactEvidence([item.winner, ...item.conflicts]),
      });
    }
  }

  for (const attempt of Object.values(options.acquisition ?? {})) {
    if (!attempt) continue;
    if (attempt.status === 'blocked') {
      warnings.push({
        code: `${attempt.source}_blocked`,
        severity: 'warning',
        message: 'This site blocked automated access. Use the browser extension, paste page text, or enter the citation details manually.',
        action: 'use-extension',
      });
    } else if (attempt.status === 'partial') {
      warnings.push({
        code: `${attempt.source}_partial`,
        severity: 'review',
        message: 'The page appeared to load only partially. Review the citation fields before using the result.',
        action: attempt.source === 'fetch' ? 'try-rendered-page' : 'review-field',
      });
    }
  }

  return {
    score: scoreWarnings(warnings),
    warnings: dedupeWarnings(warnings),
    acquisition: options.acquisition,
  };
}

function hasText(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

function hasAuthors(csl: CSLItem): boolean {
  return Array.isArray(csl.author) && csl.author.some((name) => {
    if ('literal' in name) return hasText(name.literal);
    return hasText(name.family) || hasText(name.given);
  });
}

function hasIssuedDate(csl: CSLItem): boolean {
  return !!csl.issued?.['date-parts']?.[0]?.[0] || hasText(csl.issued?.literal) || hasText(csl.issued?.raw);
}

function conflictMessage(field: keyof CSLItem): string {
  if (field === 'issued') return 'We found more than one publication date. Review the date field before using this citation.';
  if (field === 'author') return 'We found conflicting author information. Review the author field before using this citation.';
  if (field === 'DOI') return 'We found conflicting DOI information. Review the DOI before using this citation.';
  return `We found conflicting ${String(field)} information. Review this field before using the citation.`;
}

function compactEvidence(items: Array<FieldEvidence | undefined>): FieldEvidence[] {
  return items
    .filter((item): item is FieldEvidence => !!item)
    .slice(0, 4)
    .map((item) => ({
      field: item.field,
      normalizedValue: item.normalizedValue,
      rawValue: item.rawValue,
      source: item.source,
      acquisition: item.acquisition,
      confidence: item.confidence,
      snippet: item.snippet,
      locator: item.locator,
    }));
}

function scoreWarnings(warnings: CitationQualityWarning[]): number {
  const penalty = warnings.reduce((sum, warning) => {
    if (warning.severity === 'error') return sum + 35;
    if (warning.severity === 'warning') return sum + 20;
    if (warning.severity === 'review') return sum + 10;
    return sum + 3;
  }, 0);
  return Math.max(0, 100 - penalty);
}

function dedupeWarnings(warnings: CitationQualityWarning[]): CitationQualityWarning[] {
  const seen = new Set<string>();
  const out: CitationQualityWarning[] = [];
  for (const warning of warnings) {
    const key = `${warning.code}:${String(warning.field ?? '')}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(warning);
  }
  return out;
}
