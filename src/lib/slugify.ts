// Returns a stateful slugifier. Each instance tracks slugs it has issued
// and appends -2, -3, ... on collision. Use one instance per page render.
export function createSlugifier() {
  const seen = new Map<string, number>();

  return function slugify(input: string): string {
    const rawBase = input
      .normalize('NFKD')
      .replace(/[\u0300-\u036F]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/[\s-]+/g, '-');

    // For empty-normalizing inputs (empty string, all-punctuation, etc.),
    // use the original input as the collision key so distinct empty inputs
    // don't count against each other; their output slug is 'section'.
    const key = rawBase !== '' ? rawBase : input;
    const base = rawBase !== '' ? rawBase : 'section';

    const count = seen.get(key) ?? 0;
    seen.set(key, count + 1);
    return count === 0 ? base : `${base}-${count + 1}`;
  };
}
