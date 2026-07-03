export type PublishDateInput = Date | string | number;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function parseDateOnly(value: PublishDateInput): Date {
    if (value instanceof Date) return value;
    if (typeof value === 'number') return new Date(value);

    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
        const [, y, m, d] = match;
        return new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
    }

    return new Date(value);
}

export function utcDay(value: PublishDateInput): number {
    const date = parseDateOnly(value);
    if (Number.isNaN(date.getTime())) {
        throw new Error(`Invalid publication date: ${String(value)}`);
    }
    return Math.floor(Date.UTC(
        date.getUTCFullYear(),
        date.getUTCMonth(),
        date.getUTCDate(),
    ) / MS_PER_DAY);
}

export function isPublishedDate(pubDate: PublishDateInput, now: PublishDateInput = new Date()): boolean {
    return utcDay(pubDate) <= utcDay(now);
}

export function publicationCutoff(): PublishDateInput {
    const maybeProcess = globalThis as typeof globalThis & {
        process?: { env?: Record<string, string | undefined> };
    };
    return maybeProcess.process?.env?.CONTENT_PUBLISH_AT ?? new Date();
}

export function filterPublishedGuides<T extends { data: { pubDate: PublishDateInput } }>(
    entries: T[],
    now: PublishDateInput = publicationCutoff(),
): T[] {
    return entries.filter((entry) => isPublishedDate(entry.data.pubDate, now));
}
