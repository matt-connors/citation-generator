# Content & SEO Overhaul — Design

**Date:** 2026-05-27
**Status:** Approved (ready for implementation plan)
**Related:** [2026-05-26-citation-generator-overhaul-design.md](./2026-05-26-citation-generator-overhaul-design.md) (Phase 1 — shipped)

## Goal

The site has a working citation engine but the surrounding content does not rank, convert, or read like an authority. The 5 existing guides are formulaic AI-generated prose with placeholder bylines. Three engine-supported styles (Vancouver, IEEE, AMA) have no guides at all. SEO mechanics are missing: no structured data, hardcoded `og:type=website` on article pages, no /about page for E-E-A-T signals, no internal linking, bare /guides index page.

This overhaul rewrites all existing guide content, adds the missing pages, and lands the SEO + accessibility infrastructure those pages need to actually rank.

## Scope decisions (locked in)

1. **Total page work:** 25 pages — 5 rewrites + 3 new style guides + 6 "how to cite a [X]" + 5 concept guides + 3 comparisons + 3 FAQ/meta.
2. **Voice:** Authoritative + scannable. Purdue-OWL-level accuracy, plain language, real worked examples, callouts, tables.
3. **Byline:** "MLA Generator Editorial Team", paired with a real `/about` page covering editorial process and sources.
4. **Sequencing:** Infrastructure-first, then content in waves. 5 independently-deployable PRs.

## Page inventory

### Rewrites (5)
- `/guides/apa` — APA 7th Edition Citation Guide
- `/guides/mla` — MLA 9th Edition Citation Guide
- `/guides/chicago` — Chicago Manual of Style Guide (engine targets chicago-18)
- `/guides/harvard` — Harvard Referencing Style Guide
- `/guides/research-and-works-cited` — Research & Works Cited: Complete Guide

### New style guides (3)
- `/guides/vancouver` — Vancouver Style (biomedical)
- `/guides/ieee` — IEEE Citation Style (engineering / CS)
- `/guides/ama` — AMA Manual of Style 11th Edition (medicine)

### How to cite a [source] (6)
- `/guides/how-to-cite-a-website`
- `/guides/how-to-cite-a-book`
- `/guides/how-to-cite-a-journal-article`
- `/guides/how-to-cite-a-youtube-video`
- `/guides/how-to-cite-a-pdf`
- `/guides/how-to-cite-an-interview`

### Concept guides (5)
- `/guides/in-text-citations`
- `/guides/annotated-bibliography`
- `/guides/works-cited-vs-bibliography`
- `/guides/avoiding-plagiarism`
- `/guides/hanging-indents`

### Comparison pages (3)
- `/guides/mla-vs-apa`
- `/guides/chicago-notes-vs-author-date`
- `/guides/when-to-use-each-style`

### FAQ + meta (3)
- `/guides/citation-generator-faq`
- `/about` — editorial methodology, sources, team (E-E-A-T anchor)
- `/guides/whats-new` — updates per style edition

## SEO infrastructure

### Already in place (verified — no work)
- `@astrojs/sitemap` auto-generates `/sitemap-index.xml`
- `BaseHead.astro` emits canonical, basic OG, Twitter cards
- `/robots.txt.ts` references the sitemap

### Meta tag fixes (BaseHead.astro)
- Add an optional `pageType: 'website' | 'article'` prop so guides emit `og:type=article` instead of the hardcoded `website`.
- Add `og:locale=en_US`, `og:site_name=MLA Generator`.
- When `pageType=article`, emit `article:published_time`, `article:modified_time`, `article:author`, `article:section`, `article:tag` from frontmatter.
- Add `<meta name="robots" content="index, follow">` baseline + `<meta name="googlebot" content="index, follow, max-image-preview:large, max-snippet:-1">` to allow rich-result thumbnails.
- Fix homepage `src/pages/index.astro:14-16` — title currently says "MLA Generator" only; rewrite to reflect the tool's actual capability across styles. Fix `trused` typo at line 25.

### JSON-LD structured data (new)
Centralized via a `SchemaOrgJsonLd.astro` component that takes a typed prop and emits a `<script type="application/ld+json">` block.

- **Every page** (in BaseHead): `Organization` + `WebSite` with `SearchAction` for sitelinks searchbox eligibility.
- **Homepage:** `SoftwareApplication` schema describing the citation tool itself (name, applicationCategory, operatingSystem=Web, offers=Free).
- **Style guides + how-to + concept + comparison pages:** `Article` schema with `headline`, `description`, `author`, `datePublished`, `dateModified`, `image`, `publisher` (Organization ref), `mainEntityOfPage`.
- **All guide pages:** `BreadcrumbList` schema reflecting `Home > Guides > [Page]`.
- **Any page with FAQ frontmatter:** `FAQPage` schema rendered from the frontmatter array.
- **`/about`:** `AboutPage` schema + reference to `Organization` founder/editorial.

### Content schema extensions (src/content/config.ts)
Extend the `guides` collection schema:
- `updatedDate: z.date().optional()` — drives `article:modified_time` and `dateModified`.
- `category: z.enum(['style-guide', 'how-to', 'concept', 'comparison', 'meta'])` — drives sectioning on `/guides` index and `article:section`.
- `relatedGuides: z.array(z.string()).optional()` — slugs for the related-guides component.
- `faq: z.array(z.object({question: z.string(), answer: z.string()})).optional()` — drives both the FAQ section and FAQPage schema.
- `keywords: z.array(z.string()).optional()` — distinct from human-readable `tags`; used in meta keywords and `article:tag`.
- `ogImage: z.string().optional()` — per-page social card image.
- `author: z.string().default('MLA Generator Editorial Team')` — make optional with sane default.

### Page rebuilds and new pages
- **`/guides` index** — Currently just `<h1>Posts</h1>` and a `<ul>`. Rebuild as a categorized hub with sections per `category` (Style Guides, How to Cite, Concepts, Comparisons), short blurbs from each page's `description`, and a search/filter input is **out of scope** for this overhaul (no user demand demonstrated yet).
- **`/about`** (new) — editorial methodology, the sources we cite from (official style manuals, CSL project), update cadence, who the editorial team is. Real content, not placeholder. ~600–800 words.

### Sitemap config tightening (astro.config.mjs)
Pass options to `sitemap()`:
- `lastmod`: derived per page (homepage = build date; guides = `updatedDate || pubDate`)
- `changefreq`: `'monthly'`
- `priority`: homepage 1.0, style guides 0.9, how-to/concept/comparison 0.7, FAQ/meta 0.5
- `serialize` hook to inject the per-page values

## Accessibility infrastructure

- **Skip-to-content link** rendered at the top of every page (visually hidden until focused).
- **Semantic landmarks** — verify and fix `<main>`, `<nav aria-label="...">` for Header / Footer / table-of-contents, `<article>`, `<aside>` on the ToC sidebar.
- **Heading hierarchy** — `guide.astro` emits an `<h1>` from frontmatter; MDX content must not introduce another `<h1>`. Enforce via a content-lint check or convention documented in a `CONTENT_GUIDELINES.md` snippet.
- **Anchor-stable H2 ids** — current ID generation in `[...slug].astro:34-44` is a naive lowercase+spaces-to-hyphens replace and will collide on duplicate H2s. Replace with a slugifier that handles punctuation, diacritics, and collisions (`-2`, `-3` suffix). Stable anchors matter because cross-page deep links (`/guides/apa#book`) depend on them.
- **`prefers-reduced-motion`** — gate the unconditional smooth-scroll in `guide.astro:189-200` behind a `matchMedia('(prefers-reduced-motion: no-preference)')` check.
- **Focus-visible** — audit and add `:focus-visible` outlines on all interactive elements (links, buttons, the ToC anchors).
- **Color contrast** — verify `--color-text-light` meets WCAG AA against all backgrounds it appears on. Document any failures and fix.
- **Alt text** — audit every image; explicitly use `alt=""` for decorative, descriptive for content. Currently the banner image and any guide images need review.
- **ARIA** — guide ToC nav needs `aria-label="Guide contents"`. Header/footer nav need labels.

## Content architecture

### Universal skeleton (all 25 pages)
1. `<h1>` — keyword-rich, natural-language title
2. Lede paragraph — 2–3 sentences, what + who
3. "Quick answer" callout — 1–2 sentences, the takeaway. Drives featured-snippet eligibility.
4. Auto-generated ToC from H2s
5. Body sections (H2/H3) with worked examples in `<blockquote>` or `<pre>`
6. `<TryMe>` CTA — context-relevant prompt
7. Related guides component (renders `relatedGuides` frontmatter)
8. FAQ section (renders `faq` frontmatter; also drives FAQPage schema)
9. Footer line: "Last updated [date]" + "Editorial methodology" link to /about

### Per-type templates

**Style guide** (apa, mla, chicago, harvard, vancouver, ieee, ama) — 2,000–2,800 words
- Overview / when to use it
- In-text citation rules (1 author, 2 authors, 3+, no author, organization, no date, indirect source, multiple sources at once) — each with worked example
- Reference list / bibliography rules (formatting, alphabetization, hanging indents)
- Source-type examples table (book, journal article, website, chapter, conference paper, thesis, government report) — each a complete formatted reference
- Common mistakes
- What's new in [latest edition]

**How to cite a [source]** — 1,200–1,800 words
- What counts as this source type
- Information to collect (checklist)
- Format in all 7 styles (tabbed component or comparison table — render decision deferred to PR 3)
- Edge cases (no author, no date, multiple URLs, paywalled, etc.)

**Concept guide** — 1,000–1,500 words
- Definition + when it applies
- Step-by-step or rule-by-rule body
- Visual example (rendered HTML, accessible — no screenshots of formatted text)
- Common mistakes

**Comparison page** — 1,200–1,500 words
- Side-by-side comparison table
- When to choose A vs B
- Side-by-side worked examples (same source, both styles)

## Internal linking strategy

**Hub-and-spoke:**
- `/guides` is the hub — links to all 25 pages, grouped by category.
- Each style guide is a sub-hub — links to every "how to cite a [source]" page (with anchor links into the style's own source-type section).
- Every "how to cite a [source]" page links to all 7 style guides.
- Concept pages link bidirectionally with the style guides where they apply.
- Comparison pages link to both styles being compared.
- Every page footer links to `/about`.

**Mechanism:**
- `relatedGuides: string[]` frontmatter → rendered by a `<RelatedGuides>` component below the body. Manually curated per page (not algorithmic — quality > volume; ~3–5 per page).
- Style guides emit stable anchors per source type: `/guides/apa#book`, `/guides/apa#journal-article`, etc. → these are the deep-link targets from `/guides/how-to-cite-a-book` etc.

## Voice & quality guidelines

So all 25 pages cohere across multiple PRs:

- **No filler.** Cut "In conclusion", "It is important to note", "Now let's explore", "In today's academic landscape", "Whether you're a student or researcher". Don't start sections with "What is X?" — lead with the answer.
- **Concrete > abstract.** Every rule gets a worked example. Every comparison gets a table.
- **Active voice. Second person where natural** — not corporate-passive.
- **Sentence length variance.** No run of three sentences with the same rhythm.
- **One idea per paragraph.** 2–4 sentences each.
- **Authority cues without overreach.** Cite the actual style manual when stating a rule (e.g., "The 9th edition of the *MLA Handbook* (Modern Language Association, 2021) introduced…"). Don't invent rules or "studies show" claims.
- **Don't recommend the tool in every paragraph.** One contextual `<TryMe>` CTA per page max, plus one passing mention elsewhere. Pushy reads untrusted.
- **No emoji. No "Pro tip:" boxes used as filler structure.** Callouts allowed when content is a genuine warning, note, or example.
- **Worked examples must format perfectly.** They're the page's reason to exist. Every reference example renders with proper hanging indent, italics, punctuation per the style. This requires real attention to detail — these are the artifacts readers screenshot and share.

## Sequencing — 5 PRs

Each PR is independently deployable to production. Pre-merge correctness review on every PR per global CLAUDE.md.

### PR 1 — SEO + accessibility infrastructure
- Content collection schema extension (`src/content/config.ts`)
- BaseHead enhancements (article OG tags, baseline robots meta)
- New `SchemaOrgJsonLd.astro` component
- BaseHead emits Organization + WebSite + SearchAction always; injects per-page schema via prop
- Homepage typo + title fix + SoftwareApplication schema
- `/about` page (real content)
- `/guides` index rebuild (categorized hub)
- Guide layout (`src/layouts/guide.astro`) refactor: breadcrumbs, Article + BreadcrumbList schema, updatedDate display, byline, anchor-stable H2 slugifier, `<RelatedGuides>` component, `<GuideFaq>` component (emits FAQPage schema), `<TryGenerator>` CTA component
- Accessibility sweep: skip link, ARIA labels, focus-visible, reduced-motion gate, alt audit
- Sitemap config tightening (lastmod, changefreq, priority via `serialize`)
- Existing 5 guides backfilled with new frontmatter fields (description-only updates; full rewrites in PR 2)
- **No content rewrites in this PR.** Just infrastructure. All existing pages remain functional after the upgrade.

### PR 2 — 8 style guides
5 rewrites (apa, mla, chicago, harvard, research-and-works-cited) + 3 new (vancouver, ieee, ama). All populate the new frontmatter fields (`relatedGuides`, `faq`, `category`, `updatedDate`, `keywords`).

### PR 3 — 6 "how to cite" pages
Decide and implement the per-style tabbed or table view of citation examples (deferred from spec).

### PR 4 — 5 concept guides

### PR 5 — 3 comparison pages + 3 FAQ/meta pages
Includes `/guides/citation-generator-faq` (the meta page; distinct from per-guide `faq` frontmatter) and `/guides/whats-new`.

## Non-goals (explicitly out of scope)

- Multilingual / i18n. (`astro.config.mjs` has a TODO comment about it; not for this overhaul.)
- Phase 2/3 citation engine work — tracked separately.
- Author-bio pages or real-person bylines — using editorial team byline by design.
- A `/blog` section — focusing on guides only.
- Search functionality on `/guides` index — no demand demonstrated; defer.
- Ads layout changes — existing AdSense placements untouched.
- Performance work beyond what accessibility/SEO requires (CLS already fixed in #9).

## Success criteria

Each PR independently:
- Passes existing `vitest` test suite.
- Builds cleanly (`npm run build`).
- Tailwind output rebuilt and committed if new arbitrary classes introduced (per CLAUDE.md memory).
- Pre-merge correctness review by a fresh-context subagent (per global CLAUDE.md doneMeansMerged workflow).
- After merge, manual sanity check on deployed mlagenerator.com (use `?nocache=1` if extract-cache memo applies).

Overall:
- All 25 pages live and indexed in `sitemap-index.xml`.
- Rich Results Test validates `Article`, `FAQPage`, `BreadcrumbList`, `Organization`, `SoftwareApplication` schemas.
- Lighthouse Accessibility score ≥ 95 on guide pages (currently unknown — establish baseline in PR 1).
- All content adheres to the Voice & quality guidelines section.
