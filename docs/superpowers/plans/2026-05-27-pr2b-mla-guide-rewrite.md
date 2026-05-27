# PR 2b — MLA 9th Edition Guide Rewrite

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development.

**Goal:** Rewrite `/guides/mla` to match the voice/structure template established by [PR 2a's APA guide](./2026-05-27-pr2a-apa-guide-rewrite.md). Authoritative voice, ~2,200–2,500 words, real worked examples, FAQ schema.

**Template reference:** The APA plan at `2026-05-27-pr2a-apa-guide-rewrite.md` documents the full template (structure, voice rules, frontmatter requirements, fixture-data conventions). This plan ONLY documents MLA-specific differences from that template — the implementer should read both files.

**Architecture:** Full replace of `src/content/guides/mla.mdx`. Body and frontmatter only — no code changes.

**Branch:** `pr2b-mla-guide-rewrite` (already created from `origin/main`).

---

## MLA-specific content brief

### Page structure (H2 outline)

Same skeleton as APA, MLA-specific section names:

1. (No H2) Lede — 2–3 sentences.
2. (No H2) Quick-answer callout — `> ...` blockquote, one or two sentences capturing the essential takeaway.
3. **H2: What MLA is and when you'll use it** — disciplines (literature, humanities, languages), governing body (Modern Language Association), the 9th edition's date (April 2021) and what changed at a high level.
4. **H2: In-text citations** — with H3 subsections:
   - One author
   - Two authors
   - Three or more authors
   - Organization as author
   - No named author
   - Multiple works by the same author
   - Direct quotes (block quote threshold = 4 lines for prose, 3+ for poetry)
   - Citing multiple sources at once
   - Sources without page numbers (use paragraph numbers, timestamps, etc.)
5. **H2: Works Cited page format** — page title ("Works Cited"), alphabetization, hanging indent, double-spacing, the *core elements* approach (Author, Title of source, Title of container, Other contributors, Version, Number, Publisher, Publication date, Location).
6. **H2: Source-type examples** — table with one row per fixture source type. Use the MLA-specific fixture data below.
7. **H2: Common mistakes** — five concrete wrong/right pairs.
8. **H2: What's new in MLA 9** — vs. MLA 8: clarified the *core elements* approach, added more guidance on annotated bibliographies + inclusive language, expanded examples for digital sources (DOIs preferred), gave explicit treatment for in-class lectures, social media, and emerging genres.

### Frontmatter required values

```yaml
---
title: 'MLA Citation Guide: MLA 9th Edition Format Made Clear'
pubDate: <preserve whatever pubDate is in the current file>
updatedDate: 2026-05-27
description: 'Complete MLA 9 guide: in-text citations, Works Cited page, the core elements approach, and worked examples for every common source type. Written and reviewed by the MLA Generator Editorial Team against the 2021 MLA Handbook.'
category: 'style-guide'
keywords: ['MLA citation', 'MLA 9th edition', 'MLA format', 'in-text citations MLA', 'works cited page', 'MLA worked examples', 'how to cite in MLA', 'MLA core elements']
tags: ['MLA', 'citations', 'works cited', 'MLA 9th edition', 'literature', 'humanities', 'writing', 'formatting']
relatedGuides: ['apa', 'chicago', 'harvard', 'how-to-cite-a-website', 'works-cited-vs-bibliography', 'mla-vs-apa']
faq:
  - question: 'What changed between MLA 8 and MLA 9?'
    answer: 'MLA 9 clarified and expanded the *core elements* approach that MLA 8 introduced, added detailed guidance on annotated bibliographies, inclusive language, and the formatting of new digital and emerging source types. MLA 9 also expanded the worked-example library — particularly for online sources, social media, and academic genres MLA 8 hadn''t addressed explicitly. The MLA Handbook moved from the 8th edition to the 9th edition in April 2021.'
  - question: 'Do MLA in-text citations include the year of publication?'
    answer: 'No. MLA in-text citations use the author''s surname and a page number ("Smith 42"), not the year. The year appears in the Works Cited entry but not in the body of the paper. This is the most visible difference between MLA and APA — if your professor asks for "Author Year" inside parentheses, they want APA, not MLA.'
  - question: 'What is the "core elements" approach in MLA 9?'
    answer: 'Rather than offering a separate template for every source type, MLA 9 asks you to assemble each Works Cited entry from nine core elements, in order: Author. Title of source. Title of container, Other contributors, Version, Number, Publisher, Publication date, Location. Each element ends with the punctuation shown. If an element doesn''t apply to your source, you skip it. The approach works for any source — print, digital, hybrid, or emerging genre — without needing a new template every time.'
  - question: 'When do I use a block quote in MLA?'
    answer: 'Prose quotations of more than four lines become block quotes — indented half an inch from the left margin, with no quotation marks, double-spaced like the rest of the paper. For poetry, three or more lines of verse become a block quote. Place the in-text citation after the closing punctuation of the block quote, with no period following the parenthetical citation.'
  - question: 'Do I include the URL in MLA Works Cited entries?'
    answer: 'Yes — include URLs (without the "https://" prefix and the protocol-leading "www.") for online sources. MLA 9 prefers DOIs when they exist (formatted as full URLs like "https://doi.org/10.xxxx/..."), but a plain URL is acceptable when no DOI is available. Add an access date for sources that may change after retrieval (live web pages, social media); access dates are optional but recommended for any source that lacks a stable publication date.'
ogImage: '/images/banner.png'
---
```

**Note:** Read the current `src/content/guides/mla.mdx` to find the original `pubDate` value (don't change it — this is a rewrite, not a new page).

### Worked-example data — use ONLY these fixtures

To keep voice consistent across guides and make formatting verifiable, every guide uses the same source fixtures but formatted in the style-appropriate way. Reuse these from the APA guide.

**Book (single author):**
- Author: Margaret S. Chen
- Year: 2021
- Title: The Architecture of Working Memory
- Publisher: Cambridge University Press

**Book chapter (edited volume):**
- Chapter authors: David K. Lin and Hannah J. Patel
- Year: 2022
- Chapter title: Cross-Modal Attention in Early Development
- Editor: Rachel T. Morrison
- Book title: Handbook of Developmental Cognition
- Pages: 142–168
- Publisher: Routledge

**Journal article (with DOI):**
- Authors: Aaron Goldstein, Priya Ramanathan, Liam O'Connor
- Year: 2024
- Title: Sleep Consolidation Effects on Procedural Learning in Adolescents
- Journal: Journal of Cognitive Development
- Volume: 19, Issue 2
- Pages: 87–104
- DOI: 10.1037/cogdev0000412

**Website / web article (no DOI):**
- Author: Sofia Alvarez
- Date: 12 Mar. 2023
- Title: How Working Memory Predicts Reading Comprehension
- Site name: Psychology Today
- URL: https://www.psychologytoday.com/intl/blog/working-memory-reading-comprehension
- Access date (where appropriate): 20 May 2026

**Government report:**
- Author: United States Department of Education, Institute of Education Sciences
- Year: 2023
- Title: Reading Proficiency and Learning Loss in U.S. Fourth-Graders, 2019–2022
- Publication number: NCES 2023-145
- Publisher: National Center for Education Statistics
- URL: https://nces.ed.gov/pubsearch/pubsinfo.asp?pubid=2023145

**Conference paper (in proceedings):**
- Authors: Yuki Tanaka, Marcus Hoffmann
- Year: 2022
- Title: A Unified Model of Attention in Dual-Task Performance
- Conference proceedings title: Proceedings of the 63rd Annual Meeting of the Psychonomic Society
- Conference dates: 4–6 November 2022
- Pages: 412–419

**Thesis (doctoral dissertation):**
- Author: Elena R. Kowalski
- Year: 2020
- Title: Memory Consolidation in Bilingual Speakers: An fMRI Investigation
- Institution: University of Michigan
- Type: PhD dissertation

Note: MLA uses title case for ALL titles (article, journal, book — all title case). This differs from APA's sentence/title case asymmetry.

### Voice rules

Identical to PR 2a. See the design spec Section 6 and the PR 2a plan's voice samples for the rhythm. The MLA-specific equivalent of the APA voice samples could be:

> MLA was the dominant style of the American humanities classroom for sixty years before it absorbed the rest of the modern languages and named itself after them. The Modern Language Association published the first MLA Style Sheet in 1951. The current edition is the ninth, released April 2021, and the underlying logic has shifted in a meaningful way since the eighth: instead of cataloguing rules per source type, MLA 9 hands you nine *core elements* and asks you to assemble each entry from those.

> Author. Title of source. Title of container, Other contributors, Version, Number, Publisher, Publication date, Location. Read the punctuation marks at the end of each element as carefully as the words — the period after Author and Title of source is mandatory; the commas after Title of container through Publication date are mandatory; the period after Location is mandatory. The pattern looks fussy until you realize it's the same pattern for a book, a journal article, a tweet, and a video game. MLA built one shape and asked you to fold each source into it.

> MLA's most common mistake is forgetting the second container. A journal article in JSTOR sits inside two containers: the journal that originally published it (container 1) and the database that holds the digitized version (container 2). The Works Cited entry names both. Drop container 2 and you've half-cited the source.

### Style-specific rules to highlight

- In-text format: `(Author Page)` — no comma, no year, no `p.` abbreviation. Example: `(Chen 47)`.
- For sources without pages, omit page numbers; use paragraph numbers (`par. 4`), timestamps for video (`02:14:55`), or section headings only when the source is divided into named sections.
- Works Cited capitalization: title case for everything.
- Block quote threshold: more than 4 lines of prose (NOT 4 lines, MORE than 4); for poetry, 3+ lines of verse.
- Containers: a single Works Cited entry can have one container (a book) or two containers (a journal article in a database).
- DOIs preferred over URLs when both exist. URLs are written without `https://` in some style guides but MLA 9 specifically accepts the full URL including protocol. Confirm against the 9th edition's §5.93.
- The Works Cited page heading is "Works Cited" (centered, not bolded — different from APA's bold "References").
- Author element: surname first for the first author only. Subsequent authors in normal order. For 3+ authors, use first author's surname-then-given-name followed by `et al.`.

---

## Tasks

### Task 1: Write the MLA guide

**File:** `src/content/guides/mla.mdx` (full replace)

- [ ] **Step 1: Read the PR 2a APA plan + the existing mla.mdx**

Read both files to understand the template + the preserved `pubDate`.

- [ ] **Step 2: Write the guide**

Match the structure, voice, and quality bar of the APA guide. Use ONLY the MLA-specific fixture data above. Cite the *MLA Handbook* (Modern Language Association, 2021, 9th edition) explicitly when stating a rule.

Do NOT include an H1 in the body. Do NOT import or render `<TryMe>`. One contextual mention of the generator at `/` in natural prose is the maximum.

- [ ] **Step 3: Build + smoke test**

```bash
npm run build 2>&1 | tail -10
npm run dev &
# wait for ready
curl -s http://localhost:4321/guides/mla | grep -o '<h2[^>]*>[^<]*' | head -10
curl -s http://localhost:4321/guides/mla | grep -c 'application/ld+json'
curl -s http://localhost:4321/guides/mla | grep -o '"@type":"Question"' | wc -l
wc -w src/content/guides/mla.mdx
```

Expected: 6 body H2s, 5 JSON-LD blocks, 5 Question entries, ~2,400 body words.

Kill dev server.

- [ ] **Step 4: Self-review against voice rules**

Same rules as the APA guide. Specifically check for:
- No "In conclusion", "It is important to note", "Whether you're", "In today's", "Pro tip:", emoji.
- No second `<TryMe>` CTA in body.
- At least one explicit citation of the *MLA Handbook* (Modern Language Association, 2021).
- Worked examples use only the supplied fixtures.
- Author element formatting matches MLA 9 (surname first for first author only, normal order for subsequent).

Fix issues inline.

- [ ] **Step 5: Commit**

```bash
git add src/content/guides/mla.mdx
git commit -m "Rewrite MLA 9th Edition guide: core elements approach, worked examples, FAQ schema"
```

---

### Task 2: Pre-merge correctness review + open PR

- [ ] **Step 1: Push the branch**

```bash
git push -u origin pr2b-mla-guide-rewrite
```

- [ ] **Step 2: Dispatch the pre-merge reviewer**

Use an Opus subagent for a fresh-context correctness review. Focus areas:
- Every cited MLA 9 rule must be verifiable against the *MLA Handbook* (2021). Specifically: the 9 core elements, the (Author Page) format, container concept, block-quote thresholds (4+ lines prose, 3+ lines poetry), works-cited page heading, capitalization (title case throughout), URL/DOI handling.
- All worked examples use the supplied fixture data verbatim and format correctly per MLA 9.
- Voice matches the spec Section 6 rules — no AI tics, no filler.
- Frontmatter: faq, relatedGuides, keywords, updatedDate populated; pubDate preserved; category='style-guide'.
- 5 JSON-LD blocks render (Organization, WebSite, Article, BreadcrumbList, FAQPage).
- Word count 2,200–2,500 body.

- [ ] **Step 3: Address blocking findings**

Implement fixes inline. Re-dispatch reviewer if substantial.

- [ ] **Step 4: Open PR + wait + merge**

```bash
gh pr create --title "Rewrite MLA 9th Edition guide" --body "<see PR 2a body for template; adapt for MLA>"
```

Then poll CI, squash-merge with `--delete-branch`, push delete the remote branch via `git push origin --delete pr2b-mla-guide-rewrite` if `gh pr merge --delete-branch` errors with the worktree issue.

---

## Self-Review

Same coverage checks as PR 2a: spec coverage, placeholder scan, type consistency. Risk notes:
- The MLA fixtures use title case (different from APA's sentence case for article titles). Cross-reference the worked examples — they must NOT carry over the APA sentence-case rendering from when the implementer wrote the previous guide.
- MLA 9 (April 2021) is the current edition; do not cite MLA 8 rules as if they were current.
- The "containers" concept is the heart of MLA 9 — verify the implementer explains it clearly, not as an afterthought.
