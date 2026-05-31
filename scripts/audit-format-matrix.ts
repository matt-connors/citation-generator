// Audit helper (not committed to CI). Run: npx tsx scripts/audit-format-matrix.ts
// Renders a battery of CSL-JSON inputs through ALL 7 bundled styles using the
// real citeproc engine, and dumps the results as JSON to scripts/.audit-matrix.json
// so a review can verify actual engine output against official style guides.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { formatCitation, registerStyle, registerLocale } from '../functions/lib/format/citeproc';
import type { CSLItem, SupportedStyle } from '../functions/lib/csl-types';

const ROOT = join(__dirname, '..');
const STYLES: SupportedStyle[] = ['mla-9', 'apa-7', 'chicago-18', 'ama-11', 'harvard', 'ieee', 'vancouver'];

registerLocale('en-US', readFileSync(join(ROOT, 'functions/lib/format/locales/locales-en-US.xml'), 'utf-8'));
registerLocale('en-GB', readFileSync(join(ROOT, 'functions/lib/format/locales/locales-en-GB.xml'), 'utf-8'));
for (const s of STYLES) {
  registerStyle(s, readFileSync(join(ROOT, `functions/lib/format/styles/${s}.csl`), 'utf-8'));
}

const cases: { name: string; desc: string; csl: CSLItem }[] = [
  {
    name: 'webpage-1author', desc: 'Webpage, single author, with date + accessed',
    csl: { id: 'c', type: 'webpage', title: 'How Vaccines Work', author: [{ family: 'Doe', given: 'Jane' }], issued: { 'date-parts': [[2024, 3, 14]] }, accessed: { 'date-parts': [[2026, 5, 31]] }, 'container-title': 'HealthLine', URL: 'https://example.com/vaccines' },
  },
  {
    name: 'webpage-2authors', desc: 'Webpage, two authors',
    csl: { id: 'c', type: 'webpage', title: 'Climate Change Update', author: [{ family: 'Doe', given: 'Jane' }, { family: 'Smith', given: 'John' }], issued: { 'date-parts': [[2024, 11, 5]] }, accessed: { 'date-parts': [[2026, 5, 31]] }, 'container-title': 'Science Daily', URL: 'https://example.com/climate' },
  },
  {
    name: 'webpage-3authors', desc: 'Webpage, three authors (MLA et al. threshold)',
    csl: { id: 'c', type: 'webpage', title: 'AI Breakthrough Discovery', author: [{ family: 'Doe', given: 'Jane' }, { family: 'Smith', given: 'John' }, { family: 'Lee', given: 'Anna' }], issued: { 'date-parts': [[2025, 1, 20]] }, accessed: { 'date-parts': [[2026, 5, 31]] }, 'container-title': 'TechCrunch', URL: 'https://example.com/ai' },
  },
  {
    name: 'webpage-5authors', desc: 'Webpage, five authors (IEEE/Vancouver/AMA truncation, APA <=20 lists all)',
    csl: { id: 'c', type: 'webpage', title: 'Genome Study Results', author: [{ family: 'Adams', given: 'Amy' }, { family: 'Brown', given: 'Bob' }, { family: 'Clark', given: 'Cara' }, { family: 'Davis', given: 'Dan' }, { family: 'Evans', given: 'Eve' }], issued: { 'date-parts': [[2023, 6, 1]] }, accessed: { 'date-parts': [[2026, 5, 31]] }, 'container-title': 'Genomics Today', URL: 'https://example.com/genome' },
  },
  {
    name: 'journal-22authors', desc: 'Journal, 22 authors (APA 7: first 19 … last; AMA: first 3 et al.; Vancouver: 6 et al.)',
    csl: { id: 'c', type: 'article-journal', title: 'Large Collaboration Trial', author: Array.from({ length: 22 }, (_, i) => ({ family: `Author${i + 1}`, given: `G${i + 1}` })), 'container-title': 'Nature', volume: '600', issue: '7', page: '100-110', issued: { 'date-parts': [[2022, 4, 2]] }, DOI: '10.1000/example.2022' },
  },
  {
    name: 'webpage-corporate', desc: 'Webpage, corporate/literal author',
    csl: { id: 'c', type: 'webpage', title: 'Official Statement on Privacy', author: [{ literal: 'Wikimedia Foundation' }], issued: { 'date-parts': [[2025, 8, 1]] }, accessed: { 'date-parts': [[2026, 5, 31]] }, 'container-title': 'Wikimedia', URL: 'https://example.org/privacy' },
  },
  {
    name: 'webpage-noauthor', desc: 'Webpage, no author (title leads)',
    csl: { id: 'c', type: 'webpage', title: 'Understanding Inflation', issued: { 'date-parts': [[2023, 2, 9]] }, accessed: { 'date-parts': [[2026, 5, 31]] }, 'container-title': 'Investopedia', URL: 'https://example.com/inflation' },
  },
  {
    name: 'webpage-nodate', desc: 'Webpage, no date (n.d.) with accessed',
    csl: { id: 'c', type: 'webpage', title: 'Style Reference Page', author: [{ family: 'Doe', given: 'Jane' }], accessed: { 'date-parts': [[2026, 5, 31]] }, 'container-title': 'Reference Hub', URL: 'https://example.com/ref' },
  },
  {
    name: 'book-1author', desc: 'Book, single author, publisher + place',
    csl: { id: 'c', type: 'book', title: 'A Brief History of Time', author: [{ family: 'Hawking', given: 'Stephen' }], issued: { 'date-parts': [[1998, 9, 1]] }, publisher: 'Bantam', 'publisher-place': 'New York', ISBN: '9780553418811' },
  },
  {
    name: 'book-edition', desc: 'Book with edition + 2 authors',
    csl: { id: 'c', type: 'book', title: 'Introduction to Algorithms', author: [{ family: 'Cormen', given: 'Thomas H.' }, { family: 'Leiserson', given: 'Charles E.' }], edition: '3', issued: { 'date-parts': [[2009]] }, publisher: 'MIT Press', 'publisher-place': 'Cambridge, MA', ISBN: '9780262033848' },
  },
  {
    name: 'book-editor', desc: 'Book with editor instead of author',
    csl: { id: 'c', type: 'book', title: 'The Oxford Handbook of Philosophy', editor: [{ family: 'Jones', given: 'Mary' }], issued: { 'date-parts': [[2015]] }, publisher: 'Oxford University Press', 'publisher-place': 'Oxford' },
  },
  {
    name: 'book-suffix', desc: 'Book, author with suffix (Jr.)',
    csl: { id: 'c', type: 'book', title: 'Why We Cant Wait', author: [{ family: 'King', given: 'Martin Luther', suffix: 'Jr.' }], issued: { 'date-parts': [[2000]] }, publisher: 'Signet Classics', 'publisher-place': 'New York' },
  },
  {
    name: 'book-particle', desc: 'Book, author with non-dropping particle (van)',
    csl: { id: 'c', type: 'book', title: 'The Body Keeps the Score', author: [{ family: 'Kolk', given: 'Bessel', 'non-dropping-particle': 'van der' }], issued: { 'date-parts': [[2014]] }, publisher: 'Viking', 'publisher-place': 'New York' },
  },
  {
    name: 'journal-with-doi', desc: 'Journal article with DOI, vol/issue/pages',
    csl: { id: 'c', type: 'article-journal', title: 'Effects of Sleep on Memory Consolidation', author: [{ family: 'Patel', given: 'Priya' }, { family: 'Garcia', given: 'Carlos' }], 'container-title': 'Journal of Neuroscience', volume: '45', issue: '12', page: '1234-1245', issued: { 'date-parts': [[2024, 12, 1]] }, DOI: '10.1234/jneuro.2024.045' },
  },
  {
    name: 'journal-no-doi', desc: 'Journal article without DOI',
    csl: { id: 'c', type: 'article-journal', title: 'Urban Heat Islands', author: [{ family: 'Nguyen', given: 'Linh' }], 'container-title': 'Environmental Science', volume: '12', issue: '3', page: '45-60', issued: { 'date-parts': [[2021]] } },
  },
  {
    name: 'newspaper', desc: 'Newspaper article',
    csl: { id: 'c', type: 'article-newspaper', title: 'City Council Approves Budget', author: [{ family: 'Reporter', given: 'Rita' }], 'container-title': 'The New York Times', issued: { 'date-parts': [[2025, 4, 18]] }, URL: 'https://example.com/budget', accessed: { 'date-parts': [[2026, 5, 31]] } },
  },
  {
    name: 'magazine', desc: 'Magazine article',
    csl: { id: 'c', type: 'article-magazine', title: 'The Future of Work', author: [{ family: 'Writer', given: 'Will' }], 'container-title': 'The Atlantic', issued: { 'date-parts': [[2024, 7]] }, page: '30-38', URL: 'https://example.com/work' },
  },
];

const matrix: Record<string, { desc: string; csl: CSLItem; outputs: Record<string, string> }> = {};
for (const c of cases) {
  const outputs: Record<string, string> = {};
  for (const style of STYLES) {
    try {
      const rt = formatCitation({ ...c.csl }, style);
      outputs[style] = rt.map((seg) => (seg.italic ? `<i>${seg.text}</i>` : seg.text)).join('');
    } catch (e) {
      outputs[style] = `__ERROR__: ${(e as Error).message}`;
    }
  }
  matrix[c.name] = { desc: c.desc, csl: c.csl, outputs };
}

const outPath = join(ROOT, 'scripts/.audit-matrix.json');
writeFileSync(outPath, JSON.stringify(matrix, null, 2));
console.log(`Wrote ${Object.keys(matrix).length} cases x ${STYLES.length} styles to ${outPath}`);

// Also print a human-readable table to stdout for quick inspection.
for (const [name, { desc, outputs }] of Object.entries(matrix)) {
  console.log(`\n## ${name} — ${desc}`);
  for (const style of STYLES) console.log(`  [${style}] ${outputs[style]}`);
}
