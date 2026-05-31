# PR 1 — SEO & Accessibility Infrastructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the SEO + accessibility foundation that every subsequent content PR will rely on — extended content schema, JSON-LD structured data, article-aware OG tags, accessible skip link and ARIA, real `/about` page, categorized `/guides` index hub, sitemap config — without rewriting any guide content.

**Architecture:** Pure-Astro static infrastructure. New utility modules under `src/lib/` are unit-tested with vitest. New Astro components live under `src/components/astro/`. The guide layout is refactored to pull in the new components + schema. Existing guides backfill their frontmatter to satisfy the extended Zod schema; their body content stays untouched.

**Tech Stack:** Astro 4.x (server adapter: `@astrojs/cloudflare`), Zod for content schema, `@astrojs/sitemap`, MDX, vitest (node env). No new dependencies introduced in this PR.

**Branch:** `content-seo-infrastructure` (already created from `origin/main`, spec committed at 7ac1229).

**Reference design doc:** `docs/superpowers/specs/2026-05-27-content-and-seo-overhaul-design.md`

---

## File Structure

**New files (utilities):**
- `src/lib/slugify.ts` — anchor-stable slugifier with collision handling
- `src/lib/schema-org.ts` — typed JSON-LD builder functions
- `tests/lib/slugify.test.ts`
- `tests/lib/schema-org.test.ts`

**New files (Astro components):**
- `src/components/astro/SchemaOrgJsonLd.astro` — renders one or more JSON-LD `<script>` blocks
- `src/components/astro/SkipToContent.astro` — visually-hidden skip link
- `src/components/astro/Breadcrumbs.astro` — accessible breadcrumb nav
- `src/components/astro/RelatedGuides.astro` — renders `relatedGuides` frontmatter
- `src/components/astro/GuideFaq.astro` — renders `faq` frontmatter as accessible Q&A
- `src/components/astro/TryGenerator.astro` — contextual CTA component

**New files (pages):**
- `src/pages/about.astro`

**Modified files:**
- `src/content/config.ts` — schema extension
- `src/components/astro/BaseHead.astro` — pageType prop, article tags, robots meta, embedded org/website schema
- `src/layouts/page.astro` — skip link injection, semantic landmarks, lang, schema prop passthrough
- `src/layouts/guide.astro` — major refactor: breadcrumbs, schema, byline, updatedDate, slugifier integration, RelatedGuides, GuideFaq, TryGenerator
- `src/pages/[...slug].astro` (`src/pages/guides/[...slug].astro`) — use new slugifier; emit Article + BreadcrumbList + FAQPage schema
- `src/pages/index.astro` — typo + title fix + SoftwareApplication schema
- `src/pages/guides/index.astro` — full rebuild as categorized hub
- `src/content/guides/apa.mdx`, `chicago.mdx`, `harvard.mdx`, `mla.mdx`, `research-and-works-cited.mdx` — frontmatter backfill only
- `astro.config.mjs` — sitemap options
- `src/components/astro/Header.astro` — ARIA on subnav
- `src/components/astro/Footer.astro` — ARIA + add `/about` link

---

## Task 1: Slugify utility (TDD)

**Files:**
- Create: `src/lib/slugify.ts`
- Test: `tests/lib/slugify.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// tests/lib/slugify.test.ts
import { describe, expect, it } from 'vitest';
import { createSlugifier } from '../../src/lib/slugify';

describe('createSlugifier', () => {
  it('lowercases and hyphenates spaces', () => {
    const slugify = createSlugifier();
    expect(slugify('Common Mistakes')).toBe('common-mistakes');
  });

  it('strips punctuation', () => {
    const slugify = createSlugifier();
    expect(slugify("Don't Do This!")).toBe('dont-do-this');
  });

  it('removes diacritics', () => {
    const slugify = createSlugifier();
    expect(slugify('Référence Citée')).toBe('reference-citee');
  });

  it('collapses repeated whitespace and hyphens', () => {
    const slugify = createSlugifier();
    expect(slugify('A   B---C')).toBe('a-b-c');
  });

  it('returns stable suffix on collision', () => {
    const slugify = createSlugifier();
    expect(slugify('Book')).toBe('book');
    expect(slugify('Book')).toBe('book-2');
    expect(slugify('Book')).toBe('book-3');
  });

  it('handles empty and all-punctuation input', () => {
    const slugify = createSlugifier();
    expect(slugify('')).toBe('section');
    expect(slugify('!!!')).toBe('section');
    expect(slugify('!!!')).toBe('section-2');
  });

  it('different instances do not share collision state', () => {
    const a = createSlugifier();
    const b = createSlugifier();
    expect(a('Book')).toBe('book');
    expect(b('Book')).toBe('book');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/slugify.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the slugifier**

```ts
// src/lib/slugify.ts

// Returns a stateful slugifier. Each instance tracks slugs it has issued
// and appends -2, -3, ... on collision. Use one instance per page render.
export function createSlugifier() {
  const seen = new Map<string, number>();

  return function slugify(input: string): string {
    const base =
      input
        .normalize('NFKD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .trim()
        .replace(/[\s-]+/g, '-') || 'section';

    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    return count === 0 ? base : `${base}-${count + 1}`;
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lib/slugify.test.ts`
Expected: PASS — all 7 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/slugify.ts tests/lib/slugify.test.ts
git commit -m "Add anchor-stable slugifier utility"
```

---

## Task 2: Schema.org builder utilities (TDD)

**Files:**
- Create: `src/lib/schema-org.ts`
- Test: `tests/lib/schema-org.test.ts`

This module exports pure functions that produce JSON-LD–shaped objects. The Astro component (Task 5) serializes them.

- [ ] **Step 1: Write failing tests**

```ts
// tests/lib/schema-org.test.ts
import { describe, expect, it } from 'vitest';
import {
  buildOrganization,
  buildWebSite,
  buildSoftwareApplication,
  buildArticle,
  buildBreadcrumbList,
  buildFaqPage,
  buildAboutPage,
  ORG_NAME,
  ORG_URL,
  ORG_LOGO,
} from '../../src/lib/schema-org';

describe('buildOrganization', () => {
  it('returns an Organization with name, url, logo', () => {
    const org = buildOrganization();
    expect(org['@context']).toBe('https://schema.org');
    expect(org['@type']).toBe('Organization');
    expect(org.name).toBe(ORG_NAME);
    expect(org.url).toBe(ORG_URL);
    expect(org.logo).toBe(ORG_LOGO);
  });
});

describe('buildWebSite', () => {
  it('includes a SearchAction targeting /guides', () => {
    const site = buildWebSite();
    expect(site['@type']).toBe('WebSite');
    expect(site.potentialAction['@type']).toBe('SearchAction');
    expect(site.potentialAction.target).toContain('{search_term_string}');
  });
});

describe('buildSoftwareApplication', () => {
  it('describes the free citation tool', () => {
    const app = buildSoftwareApplication();
    expect(app['@type']).toBe('SoftwareApplication');
    expect(app.applicationCategory).toBe('EducationalApplication');
    expect(app.operatingSystem).toBe('Web');
    expect(app.offers.price).toBe('0');
  });
});

describe('buildArticle', () => {
  it('builds Article from required fields', () => {
    const a = buildArticle({
      title: 'APA Guide',
      description: 'A guide',
      url: 'https://mlagenerator.com/guides/apa',
      datePublished: new Date('2026-01-01'),
      dateModified: new Date('2026-05-27'),
      author: 'MLA Generator Editorial Team',
      image: 'https://mlagenerator.com/images/banner.png',
      keywords: ['apa', 'citations'],
      section: 'style-guide',
    });
    expect(a['@type']).toBe('Article');
    expect(a.headline).toBe('APA Guide');
    expect(a.datePublished).toBe('2026-01-01T00:00:00.000Z');
    expect(a.dateModified).toBe('2026-05-27T00:00:00.000Z');
    expect(a.author).toEqual({ '@type': 'Organization', name: 'MLA Generator Editorial Team' });
    expect(a.publisher.name).toBe(ORG_NAME);
    expect(a.mainEntityOfPage['@id']).toBe('https://mlagenerator.com/guides/apa');
    expect(a.keywords).toEqual(['apa', 'citations']);
    expect(a.articleSection).toBe('style-guide');
  });

  it('falls back dateModified to datePublished when missing', () => {
    const a = buildArticle({
      title: 't',
      description: 'd',
      url: 'u',
      datePublished: new Date('2026-01-01'),
      author: 'x',
      image: 'i',
    });
    expect(a.dateModified).toBe('2026-01-01T00:00:00.000Z');
  });
});

describe('buildBreadcrumbList', () => {
  it('numbers items in order from 1', () => {
    const b = buildBreadcrumbList([
      { name: 'Home', url: 'https://mlagenerator.com/' },
      { name: 'Guides', url: 'https://mlagenerator.com/guides' },
      { name: 'APA', url: 'https://mlagenerator.com/guides/apa' },
    ]);
    expect(b['@type']).toBe('BreadcrumbList');
    expect(b.itemListElement).toHaveLength(3);
    expect(b.itemListElement[0]).toEqual({
      '@type': 'ListItem',
      position: 1,
      name: 'Home',
      item: 'https://mlagenerator.com/',
    });
    expect(b.itemListElement[2].position).toBe(3);
  });
});

describe('buildFaqPage', () => {
  it('wraps each q/a as a Question with an Answer', () => {
    const f = buildFaqPage([
      { question: 'Is this free?', answer: 'Yes.' },
      { question: 'Does it support APA?', answer: 'Yes, APA 7.' },
    ]);
    expect(f['@type']).toBe('FAQPage');
    expect(f.mainEntity).toHaveLength(2);
    expect(f.mainEntity[0]).toEqual({
      '@type': 'Question',
      name: 'Is this free?',
      acceptedAnswer: { '@type': 'Answer', text: 'Yes.' },
    });
  });
});

describe('buildAboutPage', () => {
  it('references the organization', () => {
    const a = buildAboutPage('https://mlagenerator.com/about');
    expect(a['@type']).toBe('AboutPage');
    expect(a.url).toBe('https://mlagenerator.com/about');
    expect(a.mainEntity['@type']).toBe('Organization');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/schema-org.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the builders**

```ts
// src/lib/schema-org.ts

export const ORG_NAME = 'MLA Generator';
export const ORG_URL = 'https://mlagenerator.com';
export const ORG_LOGO = 'https://mlagenerator.com/images/logo.svg';
export const DEFAULT_AUTHOR = 'MLA Generator Editorial Team';

type JsonLd = Record<string, unknown> & { '@context'?: string; '@type': string };

export function buildOrganization(): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: ORG_NAME,
    url: ORG_URL,
    logo: ORG_LOGO,
  };
}

export function buildWebSite(): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: ORG_NAME,
    url: ORG_URL,
    potentialAction: {
      '@type': 'SearchAction',
      target: `${ORG_URL}/guides?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  };
}

export function buildSoftwareApplication(): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'MLA Generator Citation Tool',
    url: ORG_URL,
    applicationCategory: 'EducationalApplication',
    operatingSystem: 'Web',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
    description:
      'Free citation generator that creates accurate APA, MLA, Chicago, Harvard, Vancouver, IEEE, and AMA references from a URL, DOI, or ISBN.',
  };
}

export interface ArticleInput {
  title: string;
  description: string;
  url: string;
  datePublished: Date;
  dateModified?: Date;
  author: string;
  image: string;
  keywords?: string[];
  section?: string;
}

export function buildArticle(input: ArticleInput): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: input.title,
    description: input.description,
    image: input.image,
    datePublished: input.datePublished.toISOString(),
    dateModified: (input.dateModified ?? input.datePublished).toISOString(),
    author: { '@type': 'Organization', name: input.author },
    publisher: {
      '@type': 'Organization',
      name: ORG_NAME,
      logo: { '@type': 'ImageObject', url: ORG_LOGO },
    },
    mainEntityOfPage: { '@type': 'WebPage', '@id': input.url },
    ...(input.keywords ? { keywords: input.keywords } : {}),
    ...(input.section ? { articleSection: input.section } : {}),
  };
}

export interface BreadcrumbItem {
  name: string;
  url: string;
}

export function buildBreadcrumbList(items: BreadcrumbItem[]): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

export interface FaqItem {
  question: string;
  answer: string;
}

export function buildFaqPage(items: FaqItem[]): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
    })),
  };
}

export function buildAboutPage(url: string): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'AboutPage',
    url,
    mainEntity: buildOrganization(),
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/lib/schema-org.test.ts`
Expected: PASS — all tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/schema-org.ts tests/lib/schema-org.test.ts
git commit -m "Add schema.org JSON-LD builder utilities"
```

---

## Task 3: Extend content collection schema

**Files:**
- Modify: `src/content/config.ts`

- [ ] **Step 1: Replace the schema with the extended version**

```ts
// src/content/config.ts
import { z, defineCollection } from "astro:content";

const guides = defineCollection({
    type: 'content',
    schema: z.object({
        title: z.string(),
        pubDate: z.date(),
        updatedDate: z.date().optional(),
        description: z.string(),
        author: z.string().default('MLA Generator Editorial Team'),
        category: z.enum(['style-guide', 'how-to', 'concept', 'comparison', 'meta']),
        tags: z.array(z.string()).default([]),
        keywords: z.array(z.string()).optional(),
        relatedGuides: z.array(z.string()).optional(),
        faq: z
            .array(z.object({ question: z.string(), answer: z.string() }))
            .optional(),
        ogImage: z.string().optional(),
    })
});

export const collections = {
    guides,
};
```

- [ ] **Step 2: Verify it type-checks**

Run: `npx astro check 2>&1 | head -40`
Expected: Errors about the existing 5 guides missing `category` — that's expected. We backfill in Task 4. Don't commit yet.

- [ ] **Step 3: Commit (after Task 4)**

Hold the commit until Task 4 backfills frontmatter to satisfy the new required `category` field. We commit Task 3 + Task 4 together.

---

## Task 4: Backfill existing guides' frontmatter

**Files:**
- Modify: `src/content/guides/apa.mdx` (line 1–7)
- Modify: `src/content/guides/mla.mdx` (line 1–7)
- Modify: `src/content/guides/chicago.mdx` (line 1–7)
- Modify: `src/content/guides/harvard.mdx` (line 1–7)
- Modify: `src/content/guides/research-and-works-cited.mdx` (line 1–7)

For each file, add `category: 'style-guide'` (or `'meta'` for research-and-works-cited) and `updatedDate: 2026-05-27` to the frontmatter. Leave everything else untouched — content rewrites are PR 2.

- [ ] **Step 1: Update apa.mdx frontmatter**

Add to the YAML frontmatter (between `---` lines):
```yaml
updatedDate: 2026-05-27
category: 'style-guide'
```

Remove the placeholder `author: 'John Doe'` line — the schema now defaults to "MLA Generator Editorial Team".

- [ ] **Step 2: Repeat for mla.mdx, chicago.mdx, harvard.mdx**

Same edits — add `updatedDate: 2026-05-27` and `category: 'style-guide'`; remove `author: 'John Doe'`.

- [ ] **Step 3: Update research-and-works-cited.mdx**

Add `updatedDate: 2026-05-27` and `category: 'meta'`; remove the `author: 'John Doe'` line.

- [ ] **Step 4: Verify build**

Run: `npx astro check 2>&1 | head -40`
Expected: No Zod errors on the guides collection. (Astro/TS errors unrelated to content are acceptable for now.)

- [ ] **Step 5: Commit Tasks 3 + 4 together**

```bash
git add src/content/config.ts src/content/guides/
git commit -m "Extend guides collection schema; backfill existing frontmatter"
```

---

## Task 5: SchemaOrgJsonLd component

**Files:**
- Create: `src/components/astro/SchemaOrgJsonLd.astro`

- [ ] **Step 1: Create the component**

```astro
---
// src/components/astro/SchemaOrgJsonLd.astro
// Renders one or more JSON-LD <script type="application/ld+json"> blocks.
// Pass either a single schema object or an array. Schemas are built via
// src/lib/schema-org.ts.
interface Props {
    schemas: object | object[];
}

const { schemas } = Astro.props;
const list = Array.isArray(schemas) ? schemas : [schemas];
---

{list.map((schema) => (
    <script type="application/ld+json" set:html={JSON.stringify(schema)} />
))}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/astro/SchemaOrgJsonLd.astro
git commit -m "Add SchemaOrgJsonLd component"
```

---

## Task 6: BaseHead enhancements

**Files:**
- Modify: `src/components/astro/BaseHead.astro`

Add a `pageType` prop, article-specific OG tags, robots meta, and embed Organization + WebSite + SearchAction JSON-LD on every page.

- [ ] **Step 1: Replace `src/components/astro/BaseHead.astro` with the enhanced version**

```astro
---
import "../../styles/global.css";
import "../../styles/tailwind-output.css";
import SchemaOrgJsonLd from "./SchemaOrgJsonLd.astro";
import { buildOrganization, buildWebSite } from "../../lib/schema-org";

interface Props {
    title: string;
    description: string;
    image?: string;
    pageType?: 'website' | 'article';
    article?: {
        publishedTime: Date;
        modifiedTime?: Date;
        author: string;
        section?: string;
        tags?: string[];
    };
    extraSchemas?: object[];
}

const canonicalURL = new URL(Astro.url.pathname, Astro.site);

const {
    title,
    description,
    image = "/images/banner.png",
    pageType = 'website',
    article,
    extraSchemas = [],
} = Astro.props;

const baseSchemas = [buildOrganization(), buildWebSite()];
const allSchemas = [...baseSchemas, ...extraSchemas];
---

<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<link rel="icon" type="image/png" href="/images/site-icon.png" />

<link
    rel="preload"
    href="https://mlagenerator.com/fonts/Manrope-VariableFont_wght.ttf"
    as="font"
    type="font/ttf"
    crossorigin
/>

<link rel="canonical" href={canonicalURL} />

<title>{title}</title>
<meta name="title" content={title} />
<meta name="description" content={description} />

<meta name="robots" content="index, follow" />
<meta name="googlebot" content="index, follow, max-image-preview:large, max-snippet:-1" />

<meta property="og:type" content={pageType} />
<meta property="og:url" content={Astro.url} />
<meta property="og:title" content={title} />
<meta property="og:description" content={description} />
<meta property="og:image" content={new URL(image, Astro.url)} />
<meta property="og:locale" content="en_US" />
<meta property="og:site_name" content="MLA Generator" />

{pageType === 'article' && article && (
    <>
        <meta property="article:published_time" content={article.publishedTime.toISOString()} />
        <meta property="article:modified_time" content={(article.modifiedTime ?? article.publishedTime).toISOString()} />
        <meta property="article:author" content={article.author} />
        {article.section && <meta property="article:section" content={article.section} />}
        {article.tags?.map((tag) => <meta property="article:tag" content={tag} />)}
    </>
)}

<meta property="twitter:card" content="summary_large_image" />
<meta property="twitter:url" content={Astro.url} />
<meta property="twitter:title" content={title} />
<meta property="twitter:description" content={description} />
<meta property="twitter:image" content={new URL(image, Astro.url)} />

<link rel="sitemap" href="/sitemap-index.xml" />

<SchemaOrgJsonLd schemas={allSchemas} />

<script
    defer
    src="https://static.cloudflareinsights.com/beacon.min.js"
    data-cf-beacon='{"token": "be4d6ced89604b3ba9e8c5137b6bc781"}'></script>

<script
    async
    src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-3675571854758381"
    crossorigin="anonymous"></script>

<meta name="google-adsense-account" content="ca-pub-3675571854758381" />
```

- [ ] **Step 2: Smoke test with dev server**

Run: `npm run build-tailwind && npm run dev`
Then visit `http://localhost:4321/`, view source, verify:
- `<meta name="robots" content="index, follow">` appears
- `<meta property="og:locale" content="en_US">` appears
- Two `<script type="application/ld+json">` blocks appear (Organization, WebSite)
- No console errors

Kill the dev server.

- [ ] **Step 3: Commit**

```bash
git add src/components/astro/BaseHead.astro
git commit -m "BaseHead: article OG tags, robots meta, Organization + WebSite JSON-LD"
```

---

## Task 7: SkipToContent component

**Files:**
- Create: `src/components/astro/SkipToContent.astro`

- [ ] **Step 1: Create the component**

```astro
---
// src/components/astro/SkipToContent.astro
// Visually-hidden link that becomes visible on keyboard focus.
// Targets the page's <main> landmark.
---

<a href="#main-content" class="skip-to-content">Skip to main content</a>

<style>
    .skip-to-content {
        position: absolute;
        top: -100px;
        left: 1rem;
        z-index: 10000;
        padding: 0.75rem 1.25rem;
        background-color: var(--color-background-1);
        color: var(--color-text-dark);
        border: 1px solid var(--color-border);
        border-radius: 8px;
        font-weight: 510;
        text-decoration: none;
        transition: top 120ms ease-out;
    }
    .skip-to-content:focus,
    .skip-to-content:focus-visible {
        top: 1rem;
        outline: 2px solid var(--color-text-dark);
        outline-offset: 2px;
    }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/astro/SkipToContent.astro
git commit -m "Add SkipToContent accessibility component"
```

---

## Task 8: page.astro layout — landmarks, skip link, schema passthrough

**Files:**
- Modify: `src/layouts/page.astro`

- [ ] **Step 1: Replace `src/layouts/page.astro`**

```astro
---
import BaseHead from "../components/astro/BaseHead.astro";
import Header from "../components/astro/Header.astro";
import Footer from "../components/astro/Footer.astro";
import SkipToContent from "../components/astro/SkipToContent.astro";

interface Props {
    title: string;
    description: string;
    image?: string;
    pageType?: 'website' | 'article';
    article?: {
        publishedTime: Date;
        modifiedTime?: Date;
        author: string;
        section?: string;
        tags?: string[];
    };
    extraSchemas?: object[];
}

const { title, description, image, pageType, article, extraSchemas } = Astro.props;
---

<!doctype html>
<html lang="en">
    <head>
        <BaseHead
            title={title}
            description={description}
            image={image}
            pageType={pageType}
            article={article}
            extraSchemas={extraSchemas}
        />
    </head>
    <body style="margin: 0 !important;">
        <SkipToContent />
        <Header />
        <main id="main-content">
            <slot />
        </main>
        <Footer />
    </body>
</html>
```

Two things change:
1. SkipToContent rendered at the very top of `<body>`.
2. `<main>` now has `id="main-content"` to be the skip-link target.

The existing `<main>` had no id; the skip link needs one.

- [ ] **Step 2: Smoke test**

Run: `npm run dev`
Visit `/`. Press `Tab` once — the "Skip to main content" link should slide in from the top-left. Press `Enter` — focus should jump to the main content area.

Kill the dev server.

- [ ] **Step 3: Commit**

```bash
git add src/layouts/page.astro
git commit -m "Page layout: skip link, main landmark id, schema prop passthrough"
```

---

## Task 9: Breadcrumbs component

**Files:**
- Create: `src/components/astro/Breadcrumbs.astro`

- [ ] **Step 1: Create the component**

```astro
---
// src/components/astro/Breadcrumbs.astro
// Renders a visual + accessible breadcrumb nav. JSON-LD BreadcrumbList
// is emitted separately by the layout that consumes this; this component
// is the visible markup only.
interface Crumb {
    name: string;
    href: string;
    current?: boolean;
}

interface Props {
    items: Crumb[];
}

const { items } = Astro.props;
---

<nav class="breadcrumbs" aria-label="Breadcrumb">
    <ol>
        {items.map((item, i) => (
            <li>
                {item.current
                    ? <span aria-current="page">{item.name}</span>
                    : <a href={item.href}>{item.name}</a>}
                {i < items.length - 1 && <span class="separator" aria-hidden="true">/</span>}
            </li>
        ))}
    </ol>
</nav>

<style>
    .breadcrumbs ol {
        list-style: none;
        padding: 0;
        margin: 0;
        display: flex;
        flex-wrap: wrap;
        gap: 0.4rem;
        font-size: 14px;
        color: var(--color-text-light);
    }
    .breadcrumbs li {
        display: flex;
        align-items: center;
        gap: 0.4rem;
    }
    .breadcrumbs a {
        color: var(--color-text-light);
        text-decoration: none;
    }
    .breadcrumbs a:hover {
        color: var(--color-text-dark);
        text-decoration: underline;
    }
    .breadcrumbs [aria-current="page"] {
        color: var(--color-text-dark);
    }
    .separator {
        color: var(--color-text-light);
    }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/astro/Breadcrumbs.astro
git commit -m "Add Breadcrumbs component"
```

---

## Task 10: RelatedGuides component

**Files:**
- Create: `src/components/astro/RelatedGuides.astro`

- [ ] **Step 1: Create the component**

```astro
---
// src/components/astro/RelatedGuides.astro
// Renders an accessible list of related guides given an array of slugs.
// Looks up titles + descriptions from the guides collection.
import { getCollection } from "astro:content";

interface Props {
    slugs: string[];
}

const { slugs } = Astro.props;
const all = await getCollection("guides");
const related = slugs
    .map((slug) => all.find((g) => g.slug === slug))
    .filter((g): g is NonNullable<typeof g> => g !== undefined);
---

{related.length > 0 && (
    <aside class="related-guides" aria-labelledby="related-guides-heading">
        <h2 id="related-guides-heading">Related guides</h2>
        <ul>
            {related.map((g) => (
                <li>
                    <a href={`/guides/${g.slug}`}>
                        <span class="related-title">{g.data.title}</span>
                        <span class="related-desc">{g.data.description}</span>
                    </a>
                </li>
            ))}
        </ul>
    </aside>
)}

<style>
    .related-guides {
        margin-top: 3rem;
        padding-top: 2rem;
        border-top: 1px solid var(--color-border);
    }
    .related-guides h2 {
        font-size: 1.4rem;
        margin-bottom: 1rem;
    }
    .related-guides ul {
        list-style: none;
        padding: 0;
        margin: 0;
        display: grid;
        gap: 0.75rem;
    }
    .related-guides a {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        padding: 1rem;
        border: 1px solid var(--color-border);
        border-radius: 10px;
        text-decoration: none;
        color: var(--color-text-dark);
    }
    .related-guides a:hover,
    .related-guides a:focus-visible {
        background-color: var(--color-background-2);
        outline: none;
    }
    .related-guides a:focus-visible {
        outline: 2px solid var(--color-text-dark);
        outline-offset: 2px;
    }
    .related-title {
        font-weight: 510;
    }
    .related-desc {
        font-size: 14px;
        color: var(--color-text-light);
    }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/astro/RelatedGuides.astro
git commit -m "Add RelatedGuides component"
```

---

## Task 11: GuideFaq component

**Files:**
- Create: `src/components/astro/GuideFaq.astro`

This component renders the visible Q&A markup only. The JSON-LD FAQPage schema is emitted by the layout (Task 13).

- [ ] **Step 1: Create the component**

```astro
---
// src/components/astro/GuideFaq.astro
// Renders visible FAQ markup as native <details>/<summary> elements
// for accessibility + zero-JS expand/collapse.
interface FaqItem {
    question: string;
    answer: string;
}

interface Props {
    items: FaqItem[];
}

const { items } = Astro.props;
---

{items.length > 0 && (
    <section class="guide-faq" aria-labelledby="guide-faq-heading">
        <h2 id="guide-faq-heading">Frequently asked questions</h2>
        <div class="faq-list">
            {items.map((item) => (
                <details>
                    <summary>{item.question}</summary>
                    <div class="faq-answer" set:html={item.answer} />
                </details>
            ))}
        </div>
    </section>
)}

<style>
    .guide-faq {
        margin-top: 3rem;
    }
    .guide-faq h2 {
        font-size: 1.4rem;
        margin-bottom: 1rem;
    }
    .faq-list {
        display: grid;
        gap: 0.5rem;
    }
    details {
        border: 1px solid var(--color-border);
        border-radius: 10px;
        padding: 1rem 1.25rem;
    }
    details[open] {
        background-color: var(--color-background-2);
    }
    summary {
        font-weight: 510;
        cursor: pointer;
        list-style: none;
        color: var(--color-text-dark);
    }
    summary::-webkit-details-marker {
        display: none;
    }
    summary::after {
        content: '+';
        float: right;
        font-weight: 400;
        font-size: 1.2rem;
        color: var(--color-text-light);
    }
    details[open] summary::after {
        content: '−';
    }
    summary:focus-visible {
        outline: 2px solid var(--color-text-dark);
        outline-offset: 2px;
        border-radius: 4px;
    }
    .faq-answer {
        margin-top: 0.75rem;
        color: var(--color-text-medium);
        line-height: 1.5;
    }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/astro/GuideFaq.astro
git commit -m "Add GuideFaq component"
```

---

## Task 12: TryGenerator CTA component

**Files:**
- Create: `src/components/astro/TryGenerator.astro`

- [ ] **Step 1: Create the component**

```astro
---
// src/components/astro/TryGenerator.astro
// Contextual call-to-action that links to the citation tool.
// Pass a custom heading/blurb per guide so it reads as part of the
// page's flow rather than a generic promo.
interface Props {
    heading?: string;
    blurb?: string;
    cta?: string;
}

const {
    heading = 'Try the citation generator',
    blurb = 'Paste a URL, DOI, or ISBN — we format the reference instantly in your chosen style.',
    cta = 'Open the generator',
} = Astro.props;
---

<aside class="try-generator" aria-labelledby="try-generator-heading">
    <h2 id="try-generator-heading">{heading}</h2>
    <p>{blurb}</p>
    <a href="/" class="try-generator-cta">{cta} →</a>
</aside>

<style>
    .try-generator {
        margin: 2.5rem 0;
        padding: 1.5rem 1.75rem;
        background-color: var(--color-background-2);
        border-radius: 12px;
        border: 1px solid var(--color-border);
    }
    .try-generator h2 {
        font-size: 1.25rem;
        margin: 0 0 0.5rem;
        color: var(--color-text-dark);
    }
    .try-generator p {
        margin: 0 0 1rem;
        color: var(--color-text-medium);
        line-height: 1.5;
    }
    .try-generator-cta {
        display: inline-block;
        font-weight: 510;
        color: var(--color-text-dark);
        text-decoration: none;
        padding: 0.5rem 0;
        border-bottom: 1px solid currentColor;
    }
    .try-generator-cta:hover,
    .try-generator-cta:focus-visible {
        color: var(--color-text-dark);
        opacity: 0.8;
        outline: none;
    }
    .try-generator-cta:focus-visible {
        outline: 2px solid var(--color-text-dark);
        outline-offset: 4px;
        border-radius: 4px;
    }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/astro/TryGenerator.astro
git commit -m "Add TryGenerator CTA component"
```

---

## Task 13: Guide layout refactor

**Files:**
- Modify: `src/layouts/guide.astro`
- Modify: `src/pages/guides/[...slug].astro`

This task pulls in everything from Tasks 1, 2, 5, 9, 10, 11, 12. The dynamic page emits the schema; the layout renders the visible chrome.

- [ ] **Step 1: Replace `src/pages/guides/[...slug].astro`**

```astro
---
import { getCollection } from "astro:content";
import type { CollectionEntry } from "astro:content";
import GuideLayout from "../../layouts/guide.astro";
import Heading from "../../components/astro/Heading.astro";
import { createSlugifier } from "../../lib/slugify";
import {
    buildArticle,
    buildBreadcrumbList,
    buildFaqPage,
} from "../../lib/schema-org";

export async function getStaticPaths() {
    const entries = await getCollection("guides");
    return entries.map(entry => ({
        params: { slug: entry.slug },
        props: entry,
    }));
}

export const prerender = true;

type Props = CollectionEntry<"guides">;

const entry = Astro.props as Props;

const { Content, components } = await entry.render();

// Extract H2 headings with stable, collision-safe slugs for the ToC.
const slugify = createSlugifier();
const headings = Array.from(entry.body.matchAll(/^(#{1,6})\s+(.+)$/gm)).map(
    ([_, hashes, text]) => ({
        level: hashes.length,
        text: text.trim(),
        slug: slugify(text.trim()),
    })
);

const site = Astro.site!.toString().replace(/\/$/, '');
const pageUrl = `${site}/guides/${entry.slug}`;
const articleSchema = buildArticle({
    title: entry.data.title,
    description: entry.data.description,
    url: pageUrl,
    datePublished: entry.data.pubDate,
    dateModified: entry.data.updatedDate,
    author: entry.data.author,
    image: `${site}${entry.data.ogImage ?? '/images/banner.png'}`,
    keywords: entry.data.keywords,
    section: entry.data.category,
});

const breadcrumbSchema = buildBreadcrumbList([
    { name: 'Home', url: `${site}/` },
    { name: 'Guides', url: `${site}/guides` },
    { name: entry.data.title, url: pageUrl },
]);

const extraSchemas: object[] = [articleSchema, breadcrumbSchema];
if (entry.data.faq && entry.data.faq.length > 0) {
    extraSchemas.push(buildFaqPage(entry.data.faq));
}
---

<GuideLayout
    frontmatter={entry.data}
    headings={headings}
    slug={entry.slug}
    extraSchemas={extraSchemas}
>
    <Content components={{ ...components, h2: Heading }} />
</GuideLayout>
```

Note: the `entry === undefined` redirect logic from the prior file is no longer reachable because Astro's `getStaticPaths` guarantees `Astro.props` matches; removed.

- [ ] **Step 2: Replace `src/layouts/guide.astro`**

```astro
---
import Layout from "../layouts/page.astro";
import Breadcrumbs from "../components/astro/Breadcrumbs.astro";
import RelatedGuides from "../components/astro/RelatedGuides.astro";
import GuideFaq from "../components/astro/GuideFaq.astro";
import TryGenerator from "../components/astro/TryGenerator.astro";

interface Props {
    frontmatter: {
        title: string;
        description: string;
        pubDate: Date;
        updatedDate?: Date;
        author: string;
        category: string;
        relatedGuides?: string[];
        faq?: { question: string; answer: string }[];
    };
    headings: { level: number; text: string; slug: string }[];
    slug: string;
    extraSchemas: object[];
}

const { frontmatter, headings, slug, extraSchemas } = Astro.props;
const displayDate = frontmatter.updatedDate ?? frontmatter.pubDate;
const dateLabel = frontmatter.updatedDate ? 'Updated' : 'Published';
---

<Layout
    title={frontmatter.title}
    description={frontmatter.description}
    pageType="article"
    article={{
        publishedTime: frontmatter.pubDate,
        modifiedTime: frontmatter.updatedDate,
        author: frontmatter.author,
        section: frontmatter.category,
    }}
    extraSchemas={extraSchemas}
>
    <article>
        <nav id="guide-nav" aria-label="Guide contents">
            <p class="heading-3">Guide</p>
            <ul>
                {
                    headings
                        .filter((heading) => heading.level === 2)
                        .map((heading) => (
                            <li>
                                <a href={`#${heading.slug}`}>{heading.text}</a>
                            </li>
                        ))
                }
            </ul>
        </nav>
        <div id="guide-content">
            <Breadcrumbs
                items={[
                    { name: 'Home', href: '/' },
                    { name: 'Guides', href: '/guides' },
                    { name: frontmatter.title, href: `/guides/${slug}`, current: true },
                ]}
            />
            <h1>{frontmatter.title}</h1>
            <p class="byline">
                By {frontmatter.author} ·
                <time datetime={displayDate.toISOString()}>
                    {dateLabel} {new Date(displayDate).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
                </time>
            </p>
            <slot />
            {frontmatter.faq && frontmatter.faq.length > 0 && (
                <GuideFaq items={frontmatter.faq} />
            )}
            <TryGenerator />
            {frontmatter.relatedGuides && (
                <RelatedGuides slugs={frontmatter.relatedGuides} />
            )}
            <p class="editorial-link">
                <a href="/about">Editorial methodology and sources</a>
            </p>
        </div>
    </article>
</Layout>

<style is:global>
    .byline {
        font-size: 15px;
        font-weight: 440;
        color: var(--color-text-light);
    }
    .editorial-link {
        margin-top: 2rem;
        font-size: 14px;
        color: var(--color-text-light);
    }
    .editorial-link a {
        color: var(--color-text-light);
        text-decoration: underline;
    }
    ol {
        list-style: decimal;
        padding-left: 1.5rem;
    }
    article {
        max-width: 1450px;
        margin: auto;
        padding: 4.5rem 2rem 3rem;
        box-sizing: border-box;

        display: grid;
        grid-template-columns: 280px 1fr;
        gap: clamp(5rem, 11vh, 6rem) clamp(3rem, 6vw, 6rem);

        color: var(--color-text-medium);
        line-height: 1.5;
    }
    #guide-content h1 {
        font-size: 2.2rem;
        max-width: 34ch;
    }
    #guide-content h2 {
        font-size: 1.8rem;
    }
    #guide-content h3 {
        font-size: 1.35rem;
    }
    #guide-content h1,
    #guide-content h2,
    #guide-content h3 {
        color: var(--color-text-dark);
        line-height: 1.2;
    }
    #guide-content * + h2,
    #guide-content * + h3 {
        margin-top: 1.1rem;
    }
    #guide-content ul li + li {
        margin-top: 0.5rem;
    }
    #guide-content ul {
        padding-left: 1.5rem;
        list-style: circle;
    }
    #guide-content table {
        width: 100%;
        border-collapse: collapse;
        border-radius: 14px;
        overflow: hidden;
        margin: 0.5rem 0;
        --border-radius: 8px;
    }
    #guide-content th:first-child {
        border-bottom-left-radius: var(--border-radius);
        border-top-left-radius: var(--border-radius);
    }
    #guide-content th:last-child {
        border-bottom-right-radius: var(--border-radius);
        border-top-right-radius: var(--border-radius);
    }
    #guide-content th,
    #guide-content td {
        padding: 0.8rem 1rem;
        line-height: 1;
    }
    #guide-content td {
        padding-top: 0.6rem;
        padding-bottom: 0.6rem;
    }
    #guide-content td {
        border-bottom: 1px solid var(--color-border);
        vertical-align: top;
        line-height: 1.4;
    }
    #guide-content tr:last-child td {
        border-bottom: none;
    }
    #guide-content strong {
        font-weight: 510;
    }
    #guide-content th {
        background-color: var(--color-background-2);
        font-weight: 510;
        color: var(--color-text-light);
        text-align: left;
    }
    #guide-content a {
        color: var(--color-text-dark);
        text-decoration: underline;
    }
    #guide-nav {
        position: sticky;
        top: 6rem;
        height: min-content;
        overflow: hidden;
        color: var(--color-text-dark);
    }
    #guide-nav ul {
        border-left: 1px solid var(--color-border);
        line-height: 1.3;
    }
    #guide-nav a {
        padding: 6px 22px;
        display: block;
        color: var(--color-text-light);
    }
    #guide-nav a.active {
        color: var(--color-text-dark);
    }
    #guide-nav a:hover,
    #guide-nav a:focus-visible {
        color: var(--color-text-dark);
        background-color: var(--color-background-2);
        border-radius: 8px;
        border-top-left-radius: 0;
        border-bottom-left-radius: 0;
        outline: none;
    }
    #guide-nav a:focus-visible {
        outline: 2px solid var(--color-text-dark);
        outline-offset: -2px;
    }
    #guide-nav .heading-3 {
        margin-bottom: 1rem;
    }
    #guide-content {
        display: flex;
        flex-direction: column;
        gap: 16px;
    }
    @media (max-width: 1150px) {
        article {
            grid-template-columns: 1fr;
        }
        #guide-nav {
            position: static;
        }
    }
</style>

<script>
    // Respect prefers-reduced-motion: only smooth-scroll if the user
    // has not opted out.
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
        anchor.addEventListener('click', function (this: HTMLAnchorElement, e) {
            const href = this.getAttribute('href');
            if (!href || href === '#') return;
            const target = document.querySelector(href);
            if (!target) return;
            e.preventDefault();
            target.scrollIntoView({
                behavior: prefersReduced ? 'auto' : 'smooth',
            });
        });
    });

    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            const id = entry.target.getAttribute('id');
            const matchingAnchor = document.querySelector(`#guide-nav a[href="#${id}"]`);
            if (matchingAnchor === null) return;
            if (entry.intersectionRatio > 0) {
                matchingAnchor.classList.add('active');
                document.querySelectorAll('#guide-nav a').forEach((anchor) => {
                    if (anchor !== matchingAnchor) anchor.classList.remove('active');
                });
            } else {
                matchingAnchor.classList.remove('active');
            }
        });
    });

    document.querySelectorAll('h2[id]').forEach((section) => {
        observer.observe(section);
    });
</script>
```

- [ ] **Step 3: Verify the `Heading` component slug matches**

The `Heading` component is what renders H2s in the body. It currently slugifies the heading text itself (re-deriving the ID). To stay in sync with the ToC slugifier in Task 13 Step 1, the Heading component must use the same slug strategy.

Open `src/components/astro/Heading.astro` and read its current implementation. If it derives the id via its own logic (likely a naive lowercase-and-replace), replace its slug derivation with the shared `createSlugifier` — but bear in mind it's used as a per-heading MDX component override, so each instance is a separate render. The cleanest fix: have the layout pass pre-computed IDs to the body via MDX rehype, OR keep Heading's slugification but ensure it matches `createSlugifier`'s rules byte-for-byte.

Action: read `src/components/astro/Heading.astro`. If it's a simple lowercase+spaces-to-hyphens, replace its slug derivation with:

```ts
import { createSlugifier } from "../../lib/slugify";
const slugify = createSlugifier();
// (per-component instance — won't share state with ToC)
```

To share state, the simplest path is to expose the slugifier state via a module singleton — but that's wrong for SSG (multiple pages share the module). Better fix: in this PR, accept that the body and ToC will both call `createSlugifier()` in identical order, and the slugifier is **deterministic given the same input order**. Since `Content` renders headings in document order and the ToC is built from the same `entry.body` regex parse in document order, both arrive at identical slugs.

Verify this in the smoke test.

- [ ] **Step 4: Build smoke test**

Run: `npm run build-tailwind && npm run dev`
Visit `http://localhost:4321/guides/apa`. Verify:
- Page renders with breadcrumbs
- Byline displays as "By MLA Generator Editorial Team · Updated May 27, 2026"
- ToC anchors match the H2 ids when clicked
- `<TryGenerator>` callout appears below the body
- View source: three JSON-LD scripts (Article, BreadcrumbList) plus the two from BaseHead (Organization, WebSite) — total four (no FAQ yet on this page)
- No console errors

Validate one schema via the Rich Results Test mentally: copy the Article JSON-LD, paste into https://search.google.com/test/rich-results (a manual user step — not blocking, but flag it).

Kill the dev server.

- [ ] **Step 5: Commit**

```bash
git add src/layouts/guide.astro src/pages/guides/[...slug].astro
git commit -m "Guide layout: breadcrumbs, schema, byline, stable anchors, related guides, FAQ, CTA"
```

---

## Task 14: Homepage fixes

**Files:**
- Modify: `src/pages/index.astro` (lines 14–26, and add schema)

- [ ] **Step 1: Read the current homepage to find the exact text**

The current `src/pages/index.astro:14-26` contains:
- L14: title "MLA Generator | Reliable Citations in MLA, APA, & Chicago"
- L15-16: description
- L23: `<h1>MLA Format <br />Citation Generator</h1>`
- L25: "Easy and Reliable APA, MLA, Chicago and Harvard citations, trused by students worldwide."

- [ ] **Step 2: Rewrite the title, description, h1, subtitle, and add SoftwareApplication schema**

Replace the frontmatter and `<section id="tool">` block:

```astro
---
import Layout from "../layouts/page.astro";
import CitationSearch from "../components/react/CitationSearch";
import PageSegment from "../components/astro/PageSegment.astro";

import advantages from "../content/index/advantages";
import faqs from "../content/index/faqs";

import {
    ArrowUpRightIcon,
    DocumentTextIcon,
} from "@heroicons/react/24/outline";

import { buildSoftwareApplication } from "../lib/schema-org";

const title = "Free Citation Generator — APA, MLA, Chicago, Harvard, Vancouver, IEEE & AMA";
const description =
    "Generate accurate citations in APA 7, MLA 9, Chicago 18, Harvard, Vancouver, IEEE, and AMA formats from a URL, DOI, or ISBN. Free, fast, trusted by students worldwide.";

const extraSchemas = [buildSoftwareApplication()];
---

<Layout title={title} description={description} extraSchemas={extraSchemas}>
    <section id="tool">
        <div id="text-container">
            <h1 class="heading-1">Free Citation <br />Generator</h1>
            <p class="subtitle">
                Accurate APA, MLA, Chicago, Harvard, Vancouver, IEEE, and AMA
                citations — trusted by students worldwide.
            </p>
        </div>
        <CitationSearch includeDropdown includeManualCite client:load />
    </section>
    <!-- (keep the rest of the original file unchanged) -->
```

Keep everything from the original file after the `<section id="tool">` block (the commented ad container, `<PageSegment>` blocks, etc.) untouched.

- [ ] **Step 3: Smoke test**

Run: `npm run dev`
Visit `http://localhost:4321/`. Verify:
- Title in browser tab now leads with "Free Citation Generator"
- No "trused" typo
- View source: three JSON-LD scripts (Organization, WebSite, SoftwareApplication)
- Tool still functions (search for a test URL, ensure citation renders)

Kill the dev server.

- [ ] **Step 4: Commit**

```bash
git add src/pages/index.astro
git commit -m "Homepage: fix typo, broaden title/h1, add SoftwareApplication schema"
```

---

## Task 15: /about page

**Files:**
- Create: `src/pages/about.astro`

- [ ] **Step 1: Create the page**

```astro
---
import Layout from "../layouts/page.astro";
import { buildAboutPage } from "../lib/schema-org";

const title = "About MLA Generator — Editorial Methodology & Sources";
const description =
    "How MLA Generator builds citations, the official style manuals we follow, our editorial process, and how we keep references accurate across APA, MLA, Chicago, Harvard, Vancouver, IEEE, and AMA.";

const pageUrl = new URL('/about', Astro.site).toString();
const extraSchemas = [buildAboutPage(pageUrl)];
---

<Layout title={title} description={description} extraSchemas={extraSchemas}>
    <article class="about">
        <h1>About MLA Generator</h1>
        <p class="lede">
            MLA Generator is a free citation tool used by students and
            researchers to produce accurate references in seven academic
            styles. This page documents how we build citations, the sources
            we rely on, and how we keep the tool current.
        </p>

        <h2>How citations are built</h2>
        <p>
            Every reference is rendered using the official
            <a href="https://citationstyles.org/">Citation Style Language</a> (CSL)
            project — the same machine-readable style definitions used by
            Zotero, Mendeley, and Pandoc. We ship the latest CSL definitions
            for each supported style and render them through citeproc-js, the
            reference implementation. This means a citation generated by
            MLA Generator follows the same formatting rules a researcher
            would get from any CSL-compliant tool.
        </p>

        <h2>Style manuals we follow</h2>
        <ul>
            <li><strong>APA</strong> — Publication Manual of the American Psychological Association, 7th Edition (2020).</li>
            <li><strong>MLA</strong> — MLA Handbook, 9th Edition (Modern Language Association, 2021).</li>
            <li><strong>Chicago</strong> — The Chicago Manual of Style, 18th Edition (University of Chicago Press).</li>
            <li><strong>Harvard</strong> — Cite Them Right (Pears &amp; Shields), commonly used Harvard variant.</li>
            <li><strong>Vancouver</strong> — Recommendations of the International Committee of Medical Journal Editors (ICMJE).</li>
            <li><strong>IEEE</strong> — IEEE Editorial Style Manual (current edition).</li>
            <li><strong>AMA</strong> — AMA Manual of Style, 11th Edition.</li>
        </ul>

        <h2>How references are extracted</h2>
        <p>
            When you paste a URL, MLA Generator fetches the page and reads
            multiple signal sources in parallel — JSON-LD, Open Graph, Twitter
            cards, microdata, meta tags, and HTML heuristics — before merging
            them into a best-confidence reference. For books, we resolve ISBNs
            against Google Books and Open Library. For journal articles, we
            resolve DOIs against Crossref and OpenAlex. Source code for the
            extraction pipeline is open to inspection in our public repository.
        </p>

        <h2>Editorial process</h2>
        <p>
            Guides on this site are produced by the MLA Generator Editorial
            Team. Every guide is reviewed against the latest edition of its
            style manual before publication, and the <em>Updated</em> date on
            each page reflects the last review pass.
        </p>
        <p>
            Citation rules evolve. When a style organization publishes a new
            edition or clarification, we update the relevant guide and tag the
            change in <a href="/guides/whats-new">What's new</a>.
        </p>

        <h2>Accuracy and corrections</h2>
        <p>
            If you find a citation error or a guide passage that conflicts
            with an official style manual, please contact us. We treat
            reader-reported corrections as priority work — accuracy is the
            only thing this site is good for.
        </p>
    </article>
</Layout>

<style>
    .about {
        max-width: 720px;
        margin: 0 auto;
        padding: 4.5rem 2rem 3rem;
        color: var(--color-text-medium);
        line-height: 1.6;
    }
    .about h1 {
        font-size: 2.2rem;
        margin-bottom: 0.5rem;
        color: var(--color-text-dark);
    }
    .about .lede {
        font-size: 1.1rem;
        color: var(--color-text-medium);
        margin-bottom: 2rem;
    }
    .about h2 {
        font-size: 1.5rem;
        margin-top: 2.5rem;
        margin-bottom: 0.75rem;
        color: var(--color-text-dark);
    }
    .about p,
    .about ul {
        margin-bottom: 1rem;
    }
    .about ul {
        padding-left: 1.5rem;
        list-style: disc;
    }
    .about li {
        margin-bottom: 0.5rem;
    }
    .about a {
        color: var(--color-text-dark);
        text-decoration: underline;
    }
</style>
```

- [ ] **Step 2: Smoke test**

Run: `npm run dev`
Visit `http://localhost:4321/about`. Verify content renders, no console errors, source contains AboutPage JSON-LD.

- [ ] **Step 3: Commit**

```bash
git add src/pages/about.astro
git commit -m "Add /about page with editorial methodology and AboutPage schema"
```

---

## Task 16: /guides index rebuild

**Files:**
- Modify: `src/pages/guides/index.astro` (full replace)

- [ ] **Step 1: Replace the file**

```astro
---
import Layout from "../../layouts/page.astro";
import { getCollection } from "astro:content";

const title = "Citation Guides — APA, MLA, Chicago, Harvard, Vancouver, IEEE, AMA";
const description =
    "In-depth citation guides for APA, MLA, Chicago, Harvard, Vancouver, IEEE, and AMA — plus how-to guides for citing websites, books, journal articles, and more.";

const all = await getCollection("guides");
const sortByTitle = (a: typeof all[number], b: typeof all[number]) =>
    a.data.title.localeCompare(b.data.title);

const categories: { key: string; label: string; blurb: string }[] = [
    { key: 'style-guide', label: 'Style guides', blurb: 'Complete reference for each major citation style.' },
    { key: 'how-to', label: 'How to cite', blurb: 'Format common source types across every style.' },
    { key: 'concept', label: 'Concepts', blurb: 'Core citation concepts and how they apply.' },
    { key: 'comparison', label: 'Comparisons', blurb: 'Choosing the right style for your work.' },
    { key: 'meta', label: 'Reference & FAQ', blurb: 'Tool documentation and frequently asked questions.' },
];

const grouped = categories.map((cat) => ({
    ...cat,
    items: all.filter((g) => g.data.category === cat.key).sort(sortByTitle),
}));
---

<Layout title={title} description={description}>
    <article class="guides-hub">
        <header>
            <h1>Citation Guides</h1>
            <p class="lede">
                Authoritative guides covering every supported style — written
                and reviewed by the MLA Generator Editorial Team against the
                current editions of their respective style manuals.
            </p>
        </header>

        {grouped.map((group) => group.items.length > 0 && (
            <section aria-labelledby={`cat-${group.key}`}>
                <h2 id={`cat-${group.key}`}>{group.label}</h2>
                <p class="cat-blurb">{group.blurb}</p>
                <ul>
                    {group.items.map((g) => (
                        <li>
                            <a href={`/guides/${g.slug}`}>
                                <span class="guide-title">{g.data.title}</span>
                                <span class="guide-desc">{g.data.description}</span>
                            </a>
                        </li>
                    ))}
                </ul>
            </section>
        ))}
    </article>
</Layout>

<style>
    .guides-hub {
        max-width: 900px;
        margin: 0 auto;
        padding: 4.5rem 2rem 3rem;
        color: var(--color-text-medium);
        line-height: 1.5;
    }
    .guides-hub h1 {
        font-size: 2.4rem;
        color: var(--color-text-dark);
        margin: 0 0 0.75rem;
    }
    .guides-hub .lede {
        font-size: 1.1rem;
        margin-bottom: 3rem;
        max-width: 60ch;
    }
    .guides-hub section {
        margin-bottom: 3rem;
    }
    .guides-hub h2 {
        font-size: 1.5rem;
        color: var(--color-text-dark);
        margin: 0 0 0.5rem;
    }
    .cat-blurb {
        color: var(--color-text-light);
        margin-bottom: 1rem;
    }
    .guides-hub ul {
        list-style: none;
        padding: 0;
        margin: 0;
        display: grid;
        gap: 0.75rem;
        grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    }
    .guides-hub a {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        padding: 1rem 1.25rem;
        border: 1px solid var(--color-border);
        border-radius: 10px;
        text-decoration: none;
        color: var(--color-text-dark);
        height: 100%;
    }
    .guides-hub a:hover,
    .guides-hub a:focus-visible {
        background-color: var(--color-background-2);
        outline: none;
    }
    .guides-hub a:focus-visible {
        outline: 2px solid var(--color-text-dark);
        outline-offset: 2px;
    }
    .guide-title {
        font-weight: 510;
    }
    .guide-desc {
        font-size: 14px;
        color: var(--color-text-light);
    }
</style>
```

- [ ] **Step 2: Smoke test**

Run: `npm run dev`
Visit `http://localhost:4321/guides`. Verify:
- Two sections appear: "Style guides" (4 entries: apa, chicago, harvard, mla) and "Reference & FAQ" (1 entry: research-and-works-cited)
- Cards link to the right pages
- Layout responsive on narrow viewport

Kill the dev server.

- [ ] **Step 3: Commit**

```bash
git add src/pages/guides/index.astro
git commit -m "Rebuild /guides index as categorized hub"
```

---

## Task 17: Sitemap config tightening

**Files:**
- Modify: `astro.config.mjs`

- [ ] **Step 1: Replace the `sitemap()` call**

```js
// astro.config.mjs (replace the bare `sitemap(),` line in integrations)
sitemap({
    serialize(item) {
        const pathname = new URL(item.url).pathname;
        if (pathname === '/') {
            item.priority = 1.0;
            item.changefreq = 'weekly';
        } else if (pathname.startsWith('/guides/')) {
            item.priority = 0.9;
            item.changefreq = 'monthly';
        } else if (pathname === '/guides' || pathname === '/about') {
            item.priority = 0.7;
            item.changefreq = 'monthly';
        } else {
            item.priority = 0.5;
            item.changefreq = 'monthly';
        }
        return item;
    },
}),
```

- [ ] **Step 2: Build and inspect sitemap**

Run: `npm run build`
After build completes, check `dist/sitemap-0.xml`:

Run: `head -50 dist/sitemap-0.xml`
Expected: `<url>` entries with `<priority>` and `<changefreq>` values per the rules above.

- [ ] **Step 3: Commit**

```bash
git add astro.config.mjs
git commit -m "Sitemap: per-route priority and changefreq"
```

---

## Task 18: Header & Footer accessibility + /about link

**Files:**
- Modify: `src/components/astro/Header.astro` (lines 14, 24)
- Modify: `src/components/astro/Footer.astro` (add /about link)

- [ ] **Step 1: Header — add ARIA labels**

In `src/components/astro/Header.astro`:
- Replace `<header>` (line 14) with `<header aria-label="Site header">` — actually, `<header>` is already a landmark; instead, add `aria-label="Primary"` to the `<ul id="menu-content">` parent treated as nav. Wrap the `<ul id="menu-content">` in a `<nav aria-label="Primary">…</nav>`.
- The sub-menu trigger `<span>Citation Guides</span>` (line 24) is not keyboard-accessible. Replace the trigger with a `<button type="button" aria-haspopup="true" aria-expanded="false">Citation Guides</button>` so it's reachable by Tab. Wire `aria-expanded` toggling in the script.

Open the file, find lines 21–36 (the `<ul id="menu-content">` block), and replace with:

```astro
<nav aria-label="Primary" id="primary-nav">
  <ul id="menu-content">
    <li><a href={`${site}`}>Citation Generator</a></li>
    <li><a href={`${site}my-references`}>My References</a></li>
    <li class="sub-menu-trigger">
      <button type="button" aria-haspopup="true" aria-expanded="false" aria-controls="guides-submenu">Citation Guides</button>
    </li>
    <ul class="sub-menu" id="guides-submenu" role="menu">
      <li role="none"><a role="menuitem" href={`${site}guides`}>All Guides</a></li>
      <li role="none"><a role="menuitem" href={`${site}guides/research-and-works-cited`}>Mastering Your Sources</a></li>
      <li role="none"><a role="menuitem" href={`${site}guides/mla`}>MLA Format Guide</a></li>
      <li role="none"><a role="menuitem" href={`${site}guides/apa`}>APA Format Guide</a></li>
      <li role="none"><a role="menuitem" href={`${site}guides/chicago`}>Chicago Format Guide</a></li>
      <li role="none"><a role="menuitem" href={`${site}guides/harvard`}>Harvard Format Guide</a></li>
    </ul>
  </ul>
</nav>
```

The `<nav>` wrapping the `<ul>` provides the landmark. The trigger is now a button. An "All Guides" link is added to surface the index hub.

- [ ] **Step 2: Header — update script to toggle aria-expanded**

In the same file, find the bottom `<script>` (~line 232):

```ts
const mobileMenuToggle = document.getElementById("mobile-menu-toggle");
const header = document.querySelector("header");
const obscure = document.getElementById("obscure");

mobileMenuToggle!.addEventListener("click", () => {
    header!.toggleAttribute("open");
});

obscure!.addEventListener("click", (e) => {
    header!.removeAttribute("open");
});

// Sub-menu trigger: toggle aria-expanded on the button so screen readers
// know the popover state. Visual show/hide remains driven by CSS.
const subMenuTriggerBtn = document.querySelector('.sub-menu-trigger button');
const subMenu = document.getElementById('guides-submenu');
subMenuTriggerBtn?.addEventListener('click', () => {
    const expanded = subMenuTriggerBtn.getAttribute('aria-expanded') === 'true';
    subMenuTriggerBtn.setAttribute('aria-expanded', String(!expanded));
    subMenu?.classList.toggle('open');
});
document.addEventListener('click', (e) => {
    if (!subMenuTriggerBtn?.contains(e.target as Node) && !subMenu?.contains(e.target as Node)) {
        subMenuTriggerBtn?.setAttribute('aria-expanded', 'false');
        subMenu?.classList.remove('open');
    }
});
```

CSS for `.sub-menu` currently shows on `:hover` of the trigger. The button-style trigger continues to work with hover (added `:focus-within` for keyboard parity). In the existing `<style>` block, find the rule:

```css
.sub-menu-trigger:hover + .sub-menu,
.sub-menu:hover {
    display: flex !important;
}
```

and append `.sub-menu-trigger:focus-within + .sub-menu, .sub-menu.open` to the selector list:

```css
.sub-menu-trigger:hover + .sub-menu,
.sub-menu-trigger:focus-within + .sub-menu,
.sub-menu:hover,
.sub-menu.open {
    display: flex !important;
}
```

- [ ] **Step 3: Header — button styling to match link siblings**

The new `<button>` is unstyled by default. Add to the `<style>` block:

```css
.sub-menu-trigger button {
    background: none;
    border: none;
    color: inherit;
    font: inherit;
    cursor: pointer;
    padding: 10px;
}
.sub-menu-trigger button:focus-visible {
    outline: 2px solid var(--color-text-dark);
    outline-offset: 2px;
    border-radius: 4px;
}
```

- [ ] **Step 4: Footer — add /about link**

In `src/components/astro/Footer.astro`, find the first `<ul>` (lines 18–23):

```astro
<ul>
    <li><a href={`${site}`}>Citation Generator</a></li>
    <li><a href={`${site}my-references`}>My References</a></li>
    <li><a href={`${site}privacy`}>Privacy</a></li>
    <li><a href={`${site}terms`}>Terms</a></li>
</ul>
```

Insert `<li><a href={`${site}about`}>About</a></li>` between My References and Privacy:

```astro
<ul>
    <li><a href={`${site}`}>Citation Generator</a></li>
    <li><a href={`${site}my-references`}>My References</a></li>
    <li><a href={`${site}about`}>About</a></li>
    <li><a href={`${site}privacy`}>Privacy</a></li>
    <li><a href={`${site}terms`}>Terms</a></li>
</ul>
```

Also add `aria-label="Site navigation"` and `aria-label="Guide navigation"` to the two `<nav>` elements in the footer (currently unlabeled, both render).

- [ ] **Step 5: Smoke test**

Run: `npm run dev`
Visit `/`:
- Tab through the header — verify the Citation Guides button is focusable, opens with Enter/Space, and announces "expanded/collapsed" (verify via Chrome DevTools accessibility tree)
- Footer shows the new About link, points to `/about`
- Both footer nav elements have aria-label

Kill the dev server.

- [ ] **Step 6: Commit**

```bash
git add src/components/astro/Header.astro src/components/astro/Footer.astro
git commit -m "Header/Footer: ARIA landmarks, keyboard-accessible submenu, /about link"
```

---

## Task 19: Final build + visual smoke test

**Files:** none modified

- [ ] **Step 1: Rebuild Tailwind output**

Per CLAUDE.md memory: "Tailwind is pre-compiled. New arbitrary classes need build-tailwind."

Inspect Tasks 7–16 for any new Tailwind utility classes. Most of the new styles are scoped `<style>` blocks or use existing CSS variables — no Tailwind utilities introduced. If you confirm zero new Tailwind utilities, you can skip the rebuild. Otherwise:

Run: `npm run build-tailwind`

Then stage and commit `src/styles/tailwind-output.css` if it changed:

```bash
git diff --stat src/styles/tailwind-output.css
# If non-empty:
git add src/styles/tailwind-output.css
git commit -m "Rebuild Tailwind output for PR 1 components"
```

- [ ] **Step 2: Run the full test suite**

Run: `npx vitest run`
Expected: All existing tests + the two new test files (`tests/lib/slugify.test.ts`, `tests/lib/schema-org.test.ts`) pass.

If any pre-existing test fails, investigate — they should not fail from these changes since we touched zero engine code.

- [ ] **Step 3: Run the production build**

Run: `npm run build`
Expected: Clean build, no Zod errors, no Astro errors. Output in `dist/`.

- [ ] **Step 4: Visual + JSON-LD walkthrough**

Run: `npm run dev` (or `npm run preview` for the production build).

Visit each of these and verify in browser + page source:

- `/` — Homepage. Three JSON-LD blocks (Organization, WebSite, SoftwareApplication). Title in tab leads with "Free Citation Generator". No "trused" anywhere. Skip link visible on first Tab.
- `/guides` — Hub page. Categorized sections render. Cards link correctly.
- `/about` — Renders. Two JSON-LD blocks (Organization, WebSite) + AboutPage from the page itself = three total.
- `/guides/apa` — Article page. Breadcrumbs at top. Byline + updated date. ToC anchors work. Four JSON-LD blocks (Organization, WebSite, Article, BreadcrumbList). `og:type=article`. `<TryGenerator>` callout below body. Editorial methodology link below.
- `/guides/research-and-works-cited` — Same as APA test but with `category: meta` reflected in `articleSection`.

Open Chrome DevTools → Lighthouse → run Accessibility audit on `/guides/apa`. Capture the score and note any issues. Target ≥ 95. If below 90, return to fix before opening PR.

Kill the dev server.

- [ ] **Step 5: External validation (manual user step — flag in PR description)**

These steps are flagged in the PR body for the reviewer/user to run after merge, since they require the live deployed URL:

1. Google Rich Results Test (https://search.google.com/test/rich-results) on:
   - https://mlagenerator.com/ → expect SoftwareApplication
   - https://mlagenerator.com/guides/apa → expect Article + BreadcrumbList
   - https://mlagenerator.com/about → expect AboutPage
2. Schema Markup Validator (https://validator.schema.org/) on the same URLs.
3. Search Console: re-submit sitemap-index.xml.

No commit in this task — it's verification only.

---

## Task 20: Pre-merge correctness review + open PR

Per global CLAUDE.md: mandatory fresh-context correctness review before opening the PR.

- [ ] **Step 1: Push the branch**

```bash
git push -u origin content-seo-infrastructure
```

- [ ] **Step 2: Dispatch the pre-merge reviewer**

Use the prompt-engineering skill to craft a focused prompt, then dispatch:

```
Agent({
  subagent_type: "code-review:code-review",
  description: "Pre-merge correctness review",
  prompt: <crafted prompt — see template below>
})
```

Template:
> Review the diff on branch `content-seo-infrastructure` against `main`. Goal: SEO + accessibility infrastructure foundation — extended content schema, JSON-LD builders, BaseHead enhancements, new accessibility components (skip link, breadcrumbs, related guides, FAQ, CTA), guide layout refactor, homepage typo fix, /about page, /guides index hub rebuild, sitemap config.
>
> Focus on:
> - Correctness of JSON-LD shapes (Article, BreadcrumbList, FAQPage, Organization, WebSite, SoftwareApplication, AboutPage) against schema.org expectations and Google's Rich Results requirements.
> - Whether `createSlugifier()` collision behavior matches between the ToC builder and the body's `Heading` component (they must produce identical slugs in identical document order — investigate whether they actually do, given they're separate instances).
> - Whether the BaseHead `extraSchemas` prop chain (page.astro → BaseHead → SchemaOrgJsonLd) successfully propagates from every page type, and whether any page might accidentally inherit `pageType="website"` when it should be `"article"`.
> - Accessibility: skip link target id matches `<main>`, ARIA expanded/collapsed wiring on the new submenu button, focus-visible coverage on all interactive components, and whether `<details>` in GuideFaq has appropriate keyboard semantics.
> - Whether removing the `entry === undefined` redirect in `[...slug].astro` left any case unhandled (Astro getStaticPaths should guarantee this, but verify).
> - Any place where the schema's required `category` enum could silently break an existing guide.
> - Whether the homepage title change cannibalizes the existing "MLA Generator" brand recognition in a way that hurts more than helps (judgment call — flag but don't block).
>
> Surface correctness bugs, security concerns, divergence from intent. Non-blocking findings: note in summary.

- [ ] **Step 3: Address blocking findings**

Implement fixes for any blocking issues. Re-run Task 19 (build + walkthrough) after each fix round.

- [ ] **Step 4: Open the PR**

```bash
gh pr create --title "SEO & accessibility infrastructure foundation" --body "$(cat <<'EOF'
## Summary
- Extends `guides` content collection schema: `updatedDate`, `category` (enum), `relatedGuides`, `faq`, `keywords`, `ogImage`; `author` now optional with default "MLA Generator Editorial Team".
- Adds JSON-LD structured data across the site: `Organization` + `WebSite` (with `SearchAction`) on every page, `SoftwareApplication` on the homepage, `Article` + `BreadcrumbList` on guide pages, `FAQPage` when frontmatter has FAQ items, `AboutPage` on `/about`.
- Article-aware Open Graph: `og:type=article`, `article:published_time`, `article:modified_time`, `article:author`, `article:section`, `article:tag`.
- Accessibility: skip-to-content link, ARIA-labeled landmarks, keyboard-accessible submenu trigger, `prefers-reduced-motion` respect on smooth-scroll, focus-visible coverage on all interactive components.
- New `/about` page documenting editorial methodology + style manuals (E-E-A-T anchor).
- `/guides` index rebuilt as categorized hub.
- Guide layout: breadcrumbs, byline + updated date, anchor-stable H2 slugifier (handles collisions/punctuation/diacritics), related guides, FAQ, contextual CTA.
- Homepage: fixed `trused` typo, broadened title and h1 to reflect 7-style support, added SoftwareApplication schema.
- Sitemap config: per-route `priority` and `changefreq`.
- **No guide content was rewritten in this PR.** Existing 5 guides backfilled with new frontmatter fields only; full rewrites in PR 2.

## Spec
See `docs/superpowers/specs/2026-05-27-content-and-seo-overhaul-design.md` for the full 5-PR overhaul plan.

## Test plan
- [ ] `npx vitest run` passes (new tests: `tests/lib/slugify.test.ts`, `tests/lib/schema-org.test.ts`).
- [ ] `npm run build` clean.
- [ ] Visual walkthrough of `/`, `/guides`, `/about`, `/guides/apa`, `/guides/research-and-works-cited`.
- [ ] Lighthouse Accessibility score ≥ 95 on `/guides/apa`.
- [ ] After merge: validate live URLs via Google Rich Results Test (https://search.google.com/test/rich-results) and Schema Markup Validator (https://validator.schema.org/) on `/`, `/guides/apa`, `/about`.
- [ ] After merge: re-submit `sitemap-index.xml` in Search Console.

## Non-blocking review notes
- (Populated by pre-merge reviewer — see Task 20.)
EOF
)"
```

- [ ] **Step 5: Wait for CI and merge**

After CI passes and any review comments are addressed (re-run pre-merge review on each new round per CLAUDE.md), squash-merge to main.

```bash
gh pr merge --squash --delete-branch
```

Per memory: main auto-deploys to mlagenerator.com via Cloudflare Pages. Verify production with `?nocache=1` if cache memo is suspected.

---

## Self-Review

**Spec coverage check** — every spec requirement traces to a task:

- Meta tag fixes (article OG, robots, locale, site_name, homepage typo/title) → Tasks 6, 14
- JSON-LD: Organization + WebSite on every page → Task 6 (via BaseHead) | SoftwareApplication on homepage → Task 14 | Article + BreadcrumbList on guides → Task 13 | FAQPage when frontmatter has faq → Task 13 | AboutPage on /about → Task 15
- Content schema extensions → Task 3
- Existing guides backfill → Task 4
- /guides index rebuild → Task 16
- /about page → Task 15
- Sitemap config tightening → Task 17
- Skip-to-content link → Tasks 7, 8
- Semantic landmarks → Tasks 8, 18
- Heading hierarchy enforcement → noted (relies on convention; guide layout owns the only `<h1>` for guide pages)
- Anchor-stable H2 ids → Tasks 1, 13
- prefers-reduced-motion → Task 13 (script update in guide layout)
- focus-visible coverage → Tasks 7, 9, 10, 11, 12, 13, 18
- Color contrast check → flagged as part of Task 19 (Lighthouse audit captures this; explicit follow-up if it fails)
- Alt text audit → covered by Task 19 (Lighthouse) but no dedicated step. **Adding inline note:** during Task 19 Step 4, also check existing image alts manually.
- ARIA labels on nav elements → Task 18

**Placeholder scan** — no "TBD" / "TODO" / "implement later" / "fill in" / "similar to Task N" in the plan. Every code block is complete.

**Type consistency** — `createSlugifier` signature stable across tasks; `buildArticle`/`buildBreadcrumbList`/etc. signatures match between Tasks 2 and 13; `Props` interfaces for layouts/components are consistent.

**Unaddressed risks documented** — Task 13 Step 3 acknowledges the body `<Heading>` component slug derivation; this is a real concern that the reviewer in Task 20 is asked to specifically verify. If the smoke test in Task 13 Step 4 reveals a mismatch, the executor must fix `Heading.astro` before commit.
