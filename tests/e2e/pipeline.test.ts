import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runExtractionPipeline } from '../../functions/lib/extract/pipeline';
import { formatCitation, registerStyle, registerLocale } from '../../functions/lib/format/citeproc';
import { validateCitationQuality } from '../../functions/lib/validation/citation-quality';
import type { CSLItem, CSLName, SupportedStyle } from '../../functions/lib/csl-types';

const ROOT = join(__dirname, '..', '..');
const STYLES = ['mla-9', 'apa-7', 'chicago-18', 'ama-11', 'harvard', 'ieee', 'vancouver'] as const;
const ACQUIRED_AT = '2026-06-30T00:00:00.000Z';

interface SmokeCase {
  name: string;
  url?: string;
  html?: string;
  fixture?: string;
  type: CSLItem['type'];
  title: string;
  firstAuthor?: CSLName;
  authorCount?: number;
  containerTitle?: string;
  publisher?: string;
  DOI?: string;
  issuedYear?: number;
  expectedWarningCodes: string[];
  absentWarningCodes?: string[];
  styleTokens?: Partial<Record<SupportedStyle, string[]>>;
}

beforeAll(() => {
  registerLocale('en-US', readFileSync(join(ROOT, 'functions/lib/format/locales/locales-en-US.xml'), 'utf-8'));
  registerLocale('en-GB', readFileSync(join(ROOT, 'functions/lib/format/locales/locales-en-GB.xml'), 'utf-8'));
  for (const style of STYLES) {
    registerStyle(style, readFileSync(join(ROOT, `functions/lib/format/styles/${style}.csl`), 'utf-8'));
  }
});

const CASES: SmokeCase[] = [
  {
    name: 'scholarly article with citation meta and DOI',
    fixture: 'academic-meta-rich',
    type: 'article-journal',
    title: 'A Reliable Metadata Extraction Study',
    firstAuthor: { family: 'Smith', given: 'John' },
    authorCount: 2,
    containerTitle: 'Journal of Citation Testing',
    publisher: 'Example University Press',
    DOI: '10.5555/jct.2026.001',
    issuedYear: 2026,
    expectedWarningCodes: ['title_conflict'],
    absentWarningCodes: ['author_not_found', 'date_not_found', 'journal_title_missing', 'journal_locator_missing'],
    styleTokens: {
      'mla-9': ['Smith, John, and Jane Doe.', '<i>Journal of Citation Testing</i>', 'https://doi.org/10.5555/jct.2026.001'],
      'apa-7': ['Smith, J., & Doe, J. (2026).', '<i>Journal of Citation Testing</i>', 'https://doi.org/10.5555/jct.2026.001'],
      'ama-11': ['Smith J, Doe J.', 'doi:10.5555/jct.2026.001'],
      ieee: ['[1] J. Smith and J. Doe', 'doi: 10.5555/jct.2026.001'],
      vancouver: ['Smith J, Doe J.', 'doi:10.5555/jct.2026.001'],
    },
  },
  {
    name: 'large-author scholarly article from Nature',
    fixture: 'nature-paper',
    type: 'article-journal',
    title: 'Scalable watermarking for identifying large language model outputs',
    firstAuthor: { family: 'Dathathri', given: 'Sumanth' },
    authorCount: 24,
    containerTitle: 'Nature',
    DOI: '10.1038/s41586-024-08025-4',
    issuedYear: 2024,
    // No issued_conflict: the only differing date candidate is the meta
    // citation_publication_date "2024/10" (month precision), which agrees with the
    // JSON-LD "2024-10-23" winner on every shared part. author_conflict remains —
    // the heuristic byline reads the on-page author list (with ORCID text), which
    // is a genuinely different value, not just a reshaped copy of the 24 authors.
    expectedWarningCodes: ['title_conflict', 'author_conflict', 'publisher_conflict'],
    absentWarningCodes: ['author_not_found', 'date_not_found', 'journal_title_missing', 'journal_locator_missing'],
    styleTokens: {
      'mla-9': ['Dathathri, Sumanth, et al.', '<i>Nature</i>', 'https://doi.org/10.1038/s41586-024-08025-4'],
      'apa-7': ['Dathathri, S.', '… Kohli, P. (2024).', 'https://doi.org/10.1038/s41586-024-08025-4'],
      'chicago-18': ['Dathathri, Sumanth, Abigail See, Sumedh Ghaisas, et al.', '<i>Nature</i> 634'],
      'ama-11': ['Dathathri S, See A, Ghaisas S, et al.', 'doi:10.1038/s41586-024-08025-4'],
      harvard: ['Dathathri, S. <i>et al.</i> (2024)', '<i>Nature</i>'],
      ieee: ['[1] S. Dathathri <i>et al.</i>', 'doi: 10.1038/s41586-024-08025-4'],
      vancouver: ['Dathathri S, See A, Ghaisas S, Huang PS, McAdam R, Welbl J, et al.', 'doi:10.1038/s41586-024-08025-4'],
    },
  },
  {
    name: 'news article with two reporters',
    fixture: 'apnews-news',
    type: 'webpage',
    title: '1 dead and 9 missing after chemical tank implosion at Washington mill',
    firstAuthor: { family: 'Rush', given: 'Claire' },
    authorCount: 2,
    containerTitle: 'AP News',
    issuedYear: 2026,
    // No author_conflict: the only differing author candidate is the heuristic
    // byline "By CLAIRE RUSH and REBECCA BOONE", which matches the JSON-LD authors
    // once name comparison is case-insensitive.
    expectedWarningCodes: ['title_conflict'],
    absentWarningCodes: ['author_not_found', 'date_not_found', 'url_missing'],
    styleTokens: {
      'mla-9': ['Rush, Claire, and Rebecca Boone.', '<i>AP News</i>', '26 May 2026'],
      'apa-7': ['Rush, C., & Boone, R. (2026, May 26).', 'AP News.'],
      'chicago-18': ['AP News, May 26, 2026.'],
      ieee: ['[1] C. Rush and R. Boone', '[Online]. Available:'],
      vancouver: ['Rush C, Boone R.', 'Available from:'],
    },
  },
  {
    name: 'government page with corporate author',
    fixture: 'cdc-gov-page',
    type: 'webpage',
    title: 'Diabetes Basics',
    firstAuthor: { literal: 'CDC' },
    authorCount: 1,
    containerTitle: 'Diabetes',
    issuedYear: 2026,
    expectedWarningCodes: ['issued_conflict'],
    absentWarningCodes: ['author_not_found', 'date_not_found', 'url_missing'],
    styleTokens: {
      'mla-9': ['CDC.', '<i>Diabetes</i>'],
      'apa-7': ['CDC. (2026, January 26).'],
      'ama-11': ['CDC. Diabetes Basics.'],
      vancouver: ['CDC. Diabetes [Internet].'],
    },
  },
  {
    name: 'blog post with author inferred from page text',
    fixture: 'blog-cloudflare',
    type: 'webpage',
    title: 'Announcing Claude Managed Agents on Cloudflare',
    firstAuthor: { family: 'Nomitch', given: 'Mike' },
    authorCount: 1,
    containerTitle: 'The Cloudflare Blog',
    issuedYear: 2026,
    expectedWarningCodes: [],
    absentWarningCodes: ['author_not_found', 'date_not_found', 'url_missing'],
    styleTokens: {
      'mla-9': ['Nomitch, Mike.', '<i>The Cloudflare Blog</i>'],
      'apa-7': ['Nomitch, M. (2026, May 19).'],
      'chicago-18': ['The Cloudflare Blog, May 19, 2026.'],
      ieee: ['[1] M. Nomitch'],
      vancouver: ['Nomitch M. The Cloudflare Blog [Internet].'],
    },
  },
  {
    name: 'encyclopedia page with host-specific title correction',
    fixture: 'wikipedia-article',
    type: 'webpage',
    title: 'Citation',
    firstAuthor: { literal: 'Contributors to Wikimedia projects' },
    authorCount: 1,
    publisher: 'Wikimedia Foundation, Inc.',
    issuedYear: 2002,
    expectedWarningCodes: ['title_conflict', 'author_conflict'],
    absentWarningCodes: ['author_not_found', 'date_not_found', 'url_missing'],
    styleTokens: {
      'mla-9': ['Contributors to Wikimedia projects.', '<i>Citation</i>.'],
      'apa-7': ['Contributors to Wikimedia projects. (2002, October 1).'],
      ieee: ['[1] Contributors to Wikimedia projects'],
      vancouver: ['Citation [Internet]. Wikimedia Foundation, Inc.; 2002.'],
    },
  },
  {
    name: 'bare static page with missing author and date',
    fixture: 'bare-html',
    type: 'webpage',
    title: 'Example Domain',
    authorCount: 0,
    expectedWarningCodes: ['author_not_found', 'date_not_found'],
    absentWarningCodes: ['title_missing', 'url_missing'],
    styleTokens: {
      'mla-9': ['<i>Example Domain</i>.'],
      'apa-7': ['<i>Example Domain</i>. (n.d.).'],
      harvard: ['<i>Example Domain</i> (no date).'],
      ieee: ['[1] “Example Domain.”'],
      vancouver: ['Example Domain [Internet].'],
    },
  },
  {
    name: 'fake DOI-only early-view scholarly article',
    url: 'https://journal.example.test/articles/early-view-reliability',
    html: `<!doctype html><html><head>
      <title>Early View Reliability Study</title>
      <link rel="canonical" href="/articles/early-view-reliability" />
      <meta name="citation_title" content="Early View Reliability Study" />
      <meta name="citation_author" content="Patel, Mira" />
      <meta name="citation_publication_date" content="2026-06-15" />
      <meta name="citation_journal_title" content="Journal of Citation Reliability" />
      <meta name="citation_doi" content="https://doi.org/10.5555/jcr.2026.015" />
    </head><body><article><h1>Early View Reliability Study</h1></article></body></html>`,
    type: 'article-journal',
    title: 'Early View Reliability Study',
    firstAuthor: { family: 'Patel', given: 'Mira' },
    authorCount: 1,
    containerTitle: 'Journal of Citation Reliability',
    DOI: '10.5555/jcr.2026.015',
    issuedYear: 2026,
    expectedWarningCodes: ['journal_volume_missing'],
    absentWarningCodes: ['author_not_found', 'date_not_found', 'journal_title_missing', 'journal_locator_missing'],
    styleTokens: {
      'mla-9': ['Patel, Mira.', '<i>Journal of Citation Reliability</i>', 'June 2026', 'https://doi.org/10.5555/jcr.2026.015'],
      'apa-7': ['Patel, M. (2026).', 'https://doi.org/10.5555/jcr.2026.015'],
      'chicago-18': ['ahead of print, June 15, 2026'],
      'ama-11': ['Patel M.', 'Published online June 15, 2026.', 'doi:10.5555/jcr.2026.015'],
      ieee: ['[1] M. Patel', 'Jun. 2026', 'doi: 10.5555/jcr.2026.015'],
      vancouver: ['Patel M.', '2026 Jun 15.', 'doi:10.5555/jcr.2026.015'],
    },
  },
  {
    name: 'fake news article with conflicting fallback metadata',
    url: 'https://news.example.test/city/council-vote',
    html: `<!doctype html><html><head>
      <title>Fallback Title - Example Daily</title>
      <meta property="og:title" content="Council vote draws regional attention" />
      <meta property="og:site_name" content="Example Daily" />
      <script type="application/ld+json">${JSON.stringify({
        '@type': 'NewsArticle',
        headline: 'Council Approves Transit Plan After Marathon Meeting',
        author: [{ '@type': 'Person', givenName: 'Jordan', familyName: 'Lee' }],
        datePublished: '2026-02-04T09:30:00-05:00',
        publisher: { '@type': 'NewsMediaOrganization', name: 'Example Daily' },
        mainEntityOfPage: 'https://news.example.test/city/council-vote',
      })}</script>
    </head><body><article><h1>Council Approves Transit Plan After Marathon Meeting</h1></article></body></html>`,
    type: 'webpage',
    title: 'Council Approves Transit Plan After Marathon Meeting',
    firstAuthor: { family: 'Lee', given: 'Jordan' },
    authorCount: 1,
    containerTitle: 'Example Daily',
    issuedYear: 2026,
    expectedWarningCodes: ['title_conflict'],
    absentWarningCodes: ['author_not_found', 'date_not_found', 'url_missing'],
    styleTokens: {
      'mla-9': ['Lee, Jordan.', '<i>Example Daily</i>', '4 Feb. 2026'],
      'apa-7': ['Lee, J. (2026, February 4).'],
      'chicago-18': ['Example Daily, February 4, 2026.'],
      ieee: ['[1] J. Lee'],
      vancouver: ['Lee J. Example Daily [Internet]. 2026.'],
    },
  },
  {
    name: 'fake government page with corporate author and no date',
    url: 'https://agency.example.test/reports/water-safety',
    html: `<!doctype html><html><head>
      <title>Water Safety Field Guide</title>
      <meta property="og:title" content="Water Safety Field Guide" />
      <meta property="og:site_name" content="Public Health Notes" />
      <script type="application/ld+json">${JSON.stringify({
        '@type': 'WebPage',
        name: 'Water Safety Field Guide',
        author: { '@type': 'Organization', name: 'Office of Public Water Safety' },
        publisher: { '@type': 'Organization', name: 'Office of Public Water Safety' },
        url: 'https://agency.example.test/reports/water-safety',
      })}</script>
    </head><body><h1>Water Safety Field Guide</h1></body></html>`,
    type: 'webpage',
    title: 'Water Safety Field Guide',
    firstAuthor: { literal: 'Office of Public Water Safety' },
    authorCount: 1,
    containerTitle: 'Public Health Notes',
    publisher: 'Office of Public Water Safety',
    expectedWarningCodes: ['date_not_found'],
    absentWarningCodes: ['author_not_found', 'title_missing', 'url_missing'],
    styleTokens: {
      'mla-9': ['Office of Public Water Safety.', '<i>Public Health Notes</i>'],
      'apa-7': ['Office of Public Water Safety. (n.d.).'],
      harvard: ['Office of Public Water Safety (no date)'],
      vancouver: ['Office of Public Water Safety. Public Health Notes [Internet].'],
    },
  },
];

describe('end-to-end citation smoke matrix', () => {
  for (const item of CASES) {
    it(`${item.name}: extracts fields, quality warnings, and all supported formats`, () => {
      const { html, url } = loadCaseInput(item);
      const result = runExtractionPipeline(html, url, { acquisition: 'fetch', acquiredAt: ACQUIRED_AT });
      const quality = validateCitationQuality(result.csl, { provenance: result.provenance });
      const warningCodes = quality.warnings.map((warning) => warning.code);

      expect(result.csl.type).toBe(item.type);
      expect(result.csl.title).toBe(item.title);
      expect(result.csl.author?.length ?? 0).toBe(item.authorCount ?? 0);
      if (item.firstAuthor) expect(result.csl.author?.[0]).toEqual(item.firstAuthor);
      if (item.containerTitle) expect(result.csl['container-title']).toBe(item.containerTitle);
      if (item.publisher) expect(result.csl.publisher).toBe(item.publisher);
      if (item.DOI) expect(result.csl.DOI).toBe(item.DOI);
      if (item.issuedYear) expect(result.csl.issued?.['date-parts']?.[0]?.[0]).toBe(item.issuedYear);

      expect(warningCodes).toEqual(item.expectedWarningCodes);
      for (const absent of item.absentWarningCodes ?? []) {
        expect(warningCodes, `${item.name} should not warn ${absent}`).not.toContain(absent);
      }

      for (const style of STYLES) {
        const actual = renderStyle(result.csl, style);
        expect(actual.length, `${item.name} ${style}`).toBeGreaterThan(20);
        expect(actual, `${item.name} ${style}`).toContain(styleLocatorToken(result.csl, style));
        for (const token of item.styleTokens?.[style] ?? []) {
          expect(actual, `${item.name} ${style}`).toContain(token);
        }
      }
    });
  }
});

function loadCaseInput(item: SmokeCase): { html: string; url: string } {
  if (item.fixture) {
    const dir = join(ROOT, 'tests/extract/fixtures', item.fixture);
    return {
      html: readFileSync(join(dir, 'input.html'), 'utf-8'),
      url: readFileSync(join(dir, 'input.url'), 'utf-8').trim(),
    };
  }
  if (!item.html || !item.url) throw new Error(`Smoke case ${item.name} is missing html or url`);
  return { html: item.html, url: item.url };
}

function renderStyle(csl: CSLItem, style: SupportedStyle): string {
  return formatCitation(csl, style)
    .map((segment) => (segment.italic ? `<i>${segment.text}</i>` : segment.text))
    .join('');
}

function styleLocatorToken(csl: CSLItem, style: SupportedStyle): string {
  if (csl.DOI) {
    return style === 'ieee' ? `doi: ${csl.DOI}` : style === 'mla-9' || style === 'apa-7' || style === 'chicago-18' || style === 'harvard'
      ? `https://doi.org/${csl.DOI}`
      : `doi:${csl.DOI}`;
  }
  if (style === 'ieee') return '[Online]. Available:';
  if (style === 'vancouver') return 'Available from:';
  return csl.URL ?? '';
}
