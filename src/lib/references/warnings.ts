import type { CitationQualityWarning } from '../citations/csl-types';

const NON_DISMISSIBLE_CODES = new Set([
  'author_not_found',
  'date_not_found',
  'journal_volume_missing',
  'title_missing',
  'url_missing',
  'journal_title_missing',
  'journal_locator_missing',
]);

export function warningDismissalKey(warning: CitationQualityWarning): string {
  return `${String(warning.field ?? 'global')}:${warning.code}`;
}

export function isDismissibleCitationWarning(warning: CitationQualityWarning): boolean {
  if (warning.severity === 'error') return false;
  if (NON_DISMISSIBLE_CODES.has(warning.code)) return false;
  if (warning.code.endsWith('_conflict')) return true;
  return false;
}

export function isCitationWarningDismissed(
  warning: CitationQualityWarning,
  dismissedWarningKeys: readonly string[] | undefined,
): boolean {
  return dismissedWarningKeys?.includes(warningDismissalKey(warning)) ?? false;
}

export function visibleCitationWarnings(
  warnings: readonly CitationQualityWarning[] | undefined,
  dismissedWarningKeys: readonly string[] | undefined,
): CitationQualityWarning[] {
  return (warnings ?? []).filter((warning) => !isCitationWarningDismissed(warning, dismissedWarningKeys));
}
