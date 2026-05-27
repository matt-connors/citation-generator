# PR 2a — APA 7th Edition Guide Rewrite (Voice/Template Anchor)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Replace the AI-formulaic content of `/guides/apa` with an authoritative, scannable, accuracy-first rewrite that doubles as the voice template for the remaining 7 style guides in subsequent PRs.

**Why APA first:** Highest search volume of the supported styles, most students will land here, and the most well-defined ruleset (APA 7th edition is a published, stable manual). Getting voice and structure right here makes the other 7 mechanical.

**Architecture:** Full replace of `src/content/guides/apa.mdx`. Populate the new frontmatter fields landed in PR 1 (`faq`, `relatedGuides`, `keywords`, `updatedDate`). Body follows the style-guide template from the design spec, ~2,200–2,500 words.

**Tech Stack:** Astro MDX content collection. No code changes — pure content. Imports `<TryMe>` Astro component for the inline CTA already used by existing guides.

**Branch:** `pr2-style-guide-rewrites` (already created from `origin/main`).

**Reference design doc:** `docs/superpowers/specs/2026-05-27-content-and-seo-overhaul-design.md` (Section 3 — style guide template; Section 6 — voice & quality guidelines).

---

## Content brief — APA 7th Edition

### Page structure (H2 outline)

1. **Lede** (2–3 sentences, no H2) — what APA is, who uses it.
2. **Quick answer** callout (`> ...` blockquote, or a styled callout if MDX supports it; keep it inline-prose) — 1–2 sentence takeaway.
3. **H2: What APA is and when you'll use it** — discipline coverage, governing body (American Psychological Association), what the 7th edition introduced.
4. **H2: In-text citations**
   - H3 per case: one author, two authors, three or more authors, organization as author, no named author, no date, direct quotes (with page numbers), citing multiple sources at once.
   - Each case includes a complete worked example in prose context.
5. **H2: Reference list format** — page heading, alphabetization rule, hanging indent, double-spacing, DOIs vs URLs, capitalization (sentence case for article titles, title case for journal titles).
6. **H2: Source-type examples** — markdown table or sequential `>` blockquotes for: book, edited book chapter, journal article (with DOI), website / web article, government report, conference paper, thesis/dissertation. Each row = one fully-formatted reference using the worked-example data below.
7. **H2: Common mistakes** — five concrete mistakes with the wrong vs. right form.
8. **H2: What's new in APA 7** (vs. APA 6) — singular "they" guidance, the removal of "Retrieved from" before URLs, the new requirement to italicize the issue number, list-of-up-to-20-authors rule (was 7 in APA 6), etc.

Layout-rendered chrome (NOT in the MDX body — handled by `guide.astro` automatically):
- Breadcrumbs
- Byline + Updated date
- ToC
- `<RelatedGuides>` (from frontmatter)
- `<GuideFaq>` (from frontmatter)
- `<TryGenerator>` CTA
- Editorial methodology link

The MDX body should NOT include a second `<TryMe>` import or any duplicate CTA — the layout's `<TryGenerator>` is enough. The body can use *one* contextual inline mention (e.g., "Paste the article's URL into the generator at /") in a natural place — not as a callout.

### Frontmatter required values

```yaml
---
title: 'APA Citation Guide: APA 7th Edition Format Made Clear'
pubDate: 2025-01-16  # preserve original — this is a rewrite, not a new page
updatedDate: 2026-05-27
description: 'Complete APA 7 guide: in-text citations, references list, worked examples for every common source type, and what changed from APA 6. Written and reviewed by the MLA Generator Editorial Team against the 2020 Publication Manual.'
category: 'style-guide'
keywords: ['APA citation', 'APA 7th edition', 'APA format', 'in-text citations APA', 'APA reference list', 'APA worked examples', 'how to cite in APA']
tags: ['APA', 'citations', 'references', 'APA 7th edition', 'research', 'writing', 'formatting', 'social sciences', 'psychology']
relatedGuides: ['mla', 'chicago', 'harvard', 'how-to-cite-a-website', 'in-text-citations', 'mla-vs-apa']
faq:
  - question: 'What's the difference between APA 6 and APA 7?'
    answer: 'APA 7 introduced singular "they" as an acceptable pronoun, dropped "Retrieved from" before URLs, italicized issue numbers in references, expanded the author list cutoff from 7 names to 20 before using ellipses, and added explicit guidance for citing software, datasets, and social media. The Publication Manual went from 6th to 7th edition in October 2019.'
  - question: 'Do I need page numbers in APA in-text citations?'
    answer: 'You need page numbers only when you are quoting directly. For paraphrasing, the author and year are sufficient, though APA encourages including page or paragraph numbers when they would help the reader locate the passage. For sources without pages (e.g., websites), use paragraph numbers, section headings, or timestamps.'
  - question: 'How many authors before I use "et al." in APA 7?'
    answer: 'In APA 7, use "et al." starting with the very first in-text citation for any source with three or more authors. (This is a change from APA 6, which used full names for the first citation of sources with three to five authors.) In the reference list, list up to 20 authors before using an ellipsis and the final author.'
  - question: 'Does APA still require "Retrieved from" before URLs?'
    answer: 'No. APA 7 dropped "Retrieved from" except for sources that are expected to change over time (e.g., a Wikipedia article, a live stock price). For most online sources, the URL or DOI appears at the end of the reference without any introductory phrase.'
  - question: 'Is APA double-spaced or single-spaced?'
    answer: 'APA uses double-spacing throughout the entire paper — including the title page, abstract, body, references, and any tables or figures. Indent the first line of each paragraph by 0.5 inches; the reference list itself uses a hanging indent of 0.5 inches.'
ogImage: '/images/banner.png'  # placeholder; can be replaced with an APA-specific OG image later
---
```

### Worked-example data (use exactly these — do not invent sources)

The implementer must use only these fixtures so the citation formats are verifiable. Realistic but generic enough to read as plausible.

**Book (single author):**
- Author: Margaret S. Chen
- Year: 2021
- Title: *The architecture of working memory*
- Publisher: Cambridge University Press
- Location: Cambridge, England

**Book chapter (edited volume):**
- Chapter authors: David K. Lin and Hannah J. Patel
- Year: 2022
- Chapter title: Cross-modal attention in early development
- Editor(s): Rachel T. Morrison (ed.)
- Book title: *Handbook of developmental cognition*
- Pages: 142–168
- Publisher: Routledge
- Location: London, England

**Journal article (with DOI):**
- Authors: Aaron Goldstein, Priya Ramanathan, Liam O'Connor
- Year: 2024
- Title: Sleep consolidation effects on procedural learning in adolescents
- Journal: *Journal of Cognitive Development*
- Volume: 19, Issue 2
- Pages: 87–104
- DOI: 10.1037/cogdev0000412

**Website / web article (no DOI):**
- Author: Sofia Alvarez
- Date: March 12, 2023
- Title: How working memory predicts reading comprehension
- Site name: *Psychology Today*
- URL: https://www.psychologytoday.com/intl/blog/working-memory-reading-comprehension

**Government report:**
- Author: U.S. Department of Education, Institute of Education Sciences
- Year: 2023
- Title: *Reading proficiency and learning loss in U.S. fourth-graders, 2019–2022*
- Publication number: NCES 2023-145
- Publisher: National Center for Education Statistics
- URL: https://nces.ed.gov/pubsearch/pubsinfo.asp?pubid=2023145

**Conference paper:**
- Authors: Yuki Tanaka, Marcus Hoffmann
- Date: November 4–6, 2022
- Title: A unified model of attention in dual-task performance
- Conference: 63rd Annual Meeting of the Psychonomic Society, Boston, MA, United States

**Thesis (doctoral dissertation, published):**
- Author: Elena R. Kowalski
- Year: 2020
- Title: *Memory consolidation in bilingual speakers: An fMRI investigation*
- Institution: University of Michigan
- Database: ProQuest Dissertations & Theses Global

### Voice samples

Use these as voice anchors — read them aloud, match the rhythm and word choice:

> APA evolved from a 1929 *Psychological Bulletin* article that ran seven pages and proposed standardizing how psychologists reported research. A century later, the manual runs 428 pages and governs how millions of papers across psychology, education, nursing, and the social sciences attribute their sources. The rules are pickier than MLA's and less footnote-heavy than Chicago's, which makes APA a good fit for evidence-driven writing where the *who* and the *when* matter more than the *where in the text*.

> In APA 7, a citation with three or more authors collapses to the first author plus *et al.* on every appearance — including the very first one. APA 6 was different: you wrote out up to five names on first mention, then switched to *et al.* after. The change exists because nobody remembers what they did at first mention three pages later. APA 7 picks simpler over more informative.

> The most common APA mistake is mixing **sentence case** in the article title with **title case** in the journal name. The rule is asymmetric and feels arbitrary, but it has a reason: the journal is a proper noun (one specific publication) while the article title is a description. Get the asymmetry wrong and the reference list looks amateur.

Voice rules (from spec Section 6):
- Cut "In conclusion", "It is important to note", "Now let's explore", "Whether you are a student or researcher", "In today's academic landscape". Cut "Pro tip:" boxes. Cut emoji. Cut filler structure.
- Lead each section with the answer, not "What is X?".
- One worked example per rule. Tables where you'd otherwise stack four bullets that repeat structure.
- Cite the actual style manual when stating a rule: "The seventh edition of the *Publication Manual* (American Psychological Association, 2020) introduced..."
- One contextual mention of the generator in the body, max. No second CTA.
- Sentence-length variance. Avoid three sentences with the same rhythm in a row.

---

## Tasks

### Task 1: Write the APA guide

**Files:**
- Modify: `src/content/guides/apa.mdx` (full replace — body and frontmatter)

- [ ] **Step 1: Write the new guide**

Replace the entire file with:
1. Frontmatter exactly as specified in "Frontmatter required values" above. Preserve `pubDate: 2025-01-16` (this is a rewrite, not a new page).
2. Body following the H2 outline, 2,200–2,500 words.
3. Use ONLY the worked-example data listed above. Do not invent additional sources.
4. Voice samples above are anchors — match the rhythm.
5. **Do not import or render `<TryMe>` in the body** — the layout's `<TryGenerator>` handles the CTA. (The original file imported `TryMe` for inline use; remove that import.)
6. **Do not include an H1 in the body** — the layout renders the H1 from frontmatter `title`. Body starts directly with the lede.

Cite the *Publication Manual of the American Psychological Association* (2020, 7th edition) at least once when stating a rule.

- [ ] **Step 2: Build verification**

```bash
npm run build 2>&1 | tail -10
```
Expected: clean. Zod schema validates the new frontmatter (faq, relatedGuides, keywords required-but-optional, category=style-guide).

If the build complains about FAQ shape, the frontmatter format under the `faq:` key must be a YAML list of objects with `question:` and `answer:` keys. The values can be multiline strings using YAML's literal-scalar syntax (`|`) or folded-scalar syntax (`>`) if needed.

- [ ] **Step 3: Visual smoke test**

```bash
npm run dev &
```
Wait until the server responds at http://localhost:4321, then:

```bash
curl -s http://localhost:4321/guides/apa | grep -o '<h2[^>]*>[^<]*' | head -10
curl -s http://localhost:4321/guides/apa | grep -c 'application/ld+json'
curl -s http://localhost:4321/guides/apa | grep -o 'aria-labelledby="guide-faq-heading"' | head -1
curl -s http://localhost:4321/guides/apa | grep -o 'aria-labelledby="related-guides-heading"' | head -1
```

Expected:
- 7 H2s rendered (matches the outline)
- 5 JSON-LD blocks (Org, WebSite, Article, BreadcrumbList, FAQPage — the last one only appears because `faq` frontmatter has items)
- Both `aria-labelledby` markers present (FAQ + Related guides sections rendered)

Kill the dev server.

- [ ] **Step 4: Word count check**

```bash
wc -w src/content/guides/apa.mdx
```
Expected: roughly 2,400–2,700 words including frontmatter. (Frontmatter is ~250 words; body should be ~2,200–2,500.)

If the body is significantly under 2,000 words: not enough depth, expand. If over 2,800 words: trim.

- [ ] **Step 5: Self-review against voice rules**

Read the rendered page in the browser. Check:
- [ ] No "In conclusion", "It is important to note", "Whether you are…", "In today's…" phrases.
- [ ] No emoji. No "Pro tip:" callouts.
- [ ] No second `<TryMe>` CTA in body.
- [ ] At least one explicit citation of the *Publication Manual* (2020).
- [ ] Worked examples use only the supplied fixtures.
- [ ] Every rule has a worked example.
- [ ] Table or bullets for source-type examples — not stacked prose.
- [ ] FAQ frontmatter parses, FAQPage schema renders.

Fix issues inline before committing.

- [ ] **Step 6: Commit**

```bash
git add src/content/guides/apa.mdx
git commit -m "Rewrite APA 7th Edition guide: authoritative voice, worked examples, FAQ schema"
```

---

### Task 2: Internal-linking sanity check

The new `relatedGuides` frontmatter references `mla`, `chicago`, `harvard`, `how-to-cite-a-website`, `in-text-citations`, `mla-vs-apa`. Only the first three exist as collection entries at this point. The other three will be added in later PRs.

The `<RelatedGuides>` component (`src/components/astro/RelatedGuides.astro`) filters out slugs whose collection entry doesn't exist (via `.filter((g) => g !== undefined)`), so missing entries silently degrade rather than 404 the page.

- [ ] **Step 1: Verify the filter is working**

```bash
npm run dev &
# Wait for ready
curl -s http://localhost:4321/guides/apa | grep -A 2 'class="related-title"' | head -15
```
Expected: 3 related-guide cards rendered (mla, chicago, harvard) — not 6. The missing-entry slugs are silently dropped.

If 0 cards render or the page errors, investigate `RelatedGuides.astro:14-15` filter logic. Otherwise no action.

Kill dev server.

- [ ] **Step 2: No commit needed for this task** — it's a verification step.

---

### Task 3: Pre-merge correctness review + open PR

Per global CLAUDE.md, mandatory fresh-context review before opening.

- [ ] **Step 1: Push the branch**

```bash
git push -u origin pr2-style-guide-rewrites
```

- [ ] **Step 2: Dispatch the pre-merge reviewer**

Use prompt-engineering skill to craft a focused review prompt for the APA rewrite. Then dispatch via Agent (general-purpose subagent, model: opus). Reviewer must:
- Confirm every cited APA 7 rule against the *Publication Manual* (2020) — no hallucinated rules.
- Verify all worked examples format the supplied fixture data correctly (italicization, capitalization, punctuation, DOIs, hanging indent rendered by layout).
- Confirm voice matches the spec Section 6 rules: no filler, no AI tics, sentence-length variance, lead with answer.
- Verify frontmatter passes Zod schema (faq shape, relatedGuides array, keywords array, category enum).
- Verify the layout-rendered chrome (breadcrumbs, byline, ToC, FAQ section, Related guides, TryGenerator, editorial-link) is intact — the body should not duplicate any of those.
- Verify FAQPage JSON-LD renders from frontmatter (5 JSON-LD blocks total on the page).
- Note any uncertain rules — flag for human review rather than letting them slip.

- [ ] **Step 3: Address blocking findings**

Re-write affected sections. If voice or rule-accuracy issues are widespread, the implementer redoes the whole body. Re-dispatch the reviewer until approved.

- [ ] **Step 4: Open the PR**

```bash
gh pr create --title "Rewrite APA 7th Edition guide" --body "$(cat <<'EOF'
## Summary
First content PR in the content & SEO overhaul (see [spec](docs/superpowers/specs/2026-05-27-content-and-seo-overhaul-design.md)). Rewrites `/guides/apa` from AI-formulaic prose into an authoritative, scannable guide that doubles as the voice template for the remaining 7 style guides (PRs 2b–2e to follow).

### What changed
- Full content rewrite of `src/content/guides/apa.mdx` — ~2,400 words.
- Populated the new frontmatter fields landed in PR 1: `faq` (5 Q&A items, renders FAQPage schema), `relatedGuides` (manual curation), `keywords`, `updatedDate`. Preserved `pubDate`.
- Removed the placeholder author byline and the inline `<TryMe>` import — the guide layout's `<TryGenerator>` handles the CTA.

### Voice anchors
- Cuts AI tics ("In conclusion", "Whether you're a student", "Pro tip:", emoji, "In today's…").
- Leads sections with the answer, not "What is X?".
- One worked example per rule, source-type examples in a table.
- Cites the *Publication Manual of the American Psychological Association* (2020) when stating rules.
- One contextual mention of the generator in the body; no second CTA callout.

### What follows
This guide establishes the template + voice. PRs 2b–2e replicate the pattern for MLA, Chicago, Harvard, Vancouver, IEEE, AMA, and research-and-works-cited.

## Test plan
- [x] `npm run build` — clean
- [x] Visual smoke: H2 count, JSON-LD count (5 blocks: Org, WebSite, Article, BreadcrumbList, FAQPage), aria-labelledby markers, related-guides filter drops missing slugs
- [x] Word count: ~2,400 (target 2,200–2,500)
- [x] Voice self-review against spec Section 6
- [ ] After merge: re-validate Article + FAQPage on live URL via Google Rich Results Test
- [ ] After merge: Search Console — request re-index for `/guides/apa`

## Pre-merge review
Fresh-context correctness review (Opus, max effort) was run against this branch. Findings addressed before opening this PR.
EOF
)"
```

- [ ] **Step 5: Wait for CI and merge**

Poll until both checks pass, then squash-merge with `--delete-branch`. If `gh pr merge` errors with "main is already used by worktree", merge via the GitHub UI or via `gh pr merge 16 --squash` without `--delete-branch`, then manually `git push origin --delete pr2-style-guide-rewrites`.

---

## Self-Review

**Spec coverage:**
- Style-guide template (Section 3): ✓ — 7 H2s match the template structure.
- Voice & quality rules (Section 6): ✓ — voice samples + explicit rule list in Task 1 Step 5.
- Frontmatter schema fields: ✓ — faq, relatedGuides, keywords, updatedDate, category populated.
- Internal linking (Section 4): ✓ — relatedGuides curated; missing entries handled by component filter.

**Placeholder scan:**
- No "TBD" / "TODO" / "fill in later" — every value (frontmatter, fixture data, voice anchors) is concrete.
- The 5 FAQ Q&A are written out in the plan; the implementer copies them in.

**Type consistency:**
- All frontmatter keys match the Zod schema landed in PR 1.

**Risk notes:**
- The 5 FAQ answers in the plan are draft-quality and rule-accurate, but the implementer should still verify them against the *Publication Manual* (2020) — particularly the "Retrieved from" change (APA 7 did drop it for most sources, but kept it for archived/changeable resources, which the current FAQ wording elides slightly).
- Voice match is subjective; the reviewer in Task 3 is asked to assess voice explicitly, not just rule-correctness.
- If the implementer cannot honestly cite a specific rule against the *Publication Manual* (because it doesn't have direct online access to the manual), it should generalize the rule or omit it rather than fabricate page numbers.
