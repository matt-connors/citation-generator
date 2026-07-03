# MLA Generator Keyword Roadmap

Date: 2026-06-29  
Scope: guide/article SEO research, existing-article triage, and slow-publish plan for mlagenerator.com.

## Research Method

I mapped the live site with Firecrawl, checked the live sitemap, inventoried the local MDX guide corpus, and searched the current SERPs for high-intent citation queries. The research focused on article opportunities that match the site's product surface: citation generation, style-specific rules, source-type examples, and student formatting tasks.

Primary live and official sources used:

- Live site map: https://mlagenerator.com and https://mlagenerator.com/sitemap-0.xml
- APA title page guidance: https://apastyle.apa.org/style-grammar-guidelines/paper-format/title-page
- APA webpage references: https://apastyle.apa.org/style-grammar-guidelines/references/examples/webpage-website-references
- MLA Works Cited quick guide: https://style.mla.org/works-cited/works-cited-a-quick-guide/
- MLA no-author guidance: https://style.mla.org/source-with-no-author/
- Purdue OWL MLA quotation guidance: https://owl.purdue.edu/owl/research_and_citation/mla_style/mla_formatting_and_style_guide/mla_formatting_quotations.html
- NLM Citing Medicine: https://www.ncbi.nlm.nih.gov/books/NBK7282/
- APA PowerPoint and lecture note references: https://apastyle.apa.org/style-grammar-guidelines/references/examples/powerpoint-references
- MLA course materials guidance: https://style.mla.org/cite-course-materials/
- MLA online lecture guidance: https://style.mla.org/citing-an-online-lecture/
- Purdue OWL Chicago miscellaneous sources: https://owl.purdue.edu/owl/research_and_citation/chicago_manual_17th_edition/cmos_formatting_and_style_guide/miscellaneous.html

Searches performed:

- `mla citation generator`
- `how to cite a website mla apa chicago`
- `how to cite a website with no author`
- `how to cite a DOI apa mla chicago`
- `APA title page format example`
- `MLA format example heading works cited page`
- `how to cite a podcast APA MLA Chicago`
- `how to cite a movie MLA APA Chicago`
- `how to cite an image MLA APA Chicago`
- `how to cite a quote MLA APA`
- `works cited page format MLA`
- `APA format example paper references title page`
- `APA cite lecture classroom PowerPoint`
- `MLA cite lecture class lecture`
- `Chicago cite lecture class lecture`

## Current Content Inventory

Local repo:

- 28 guide MDX files under `src/content/guides`.
- The seven cornerstone style guides are present: APA, MLA, Chicago, Harvard, Vancouver, IEEE, AMA.
- The six original source-type guides are present: website, book, journal article, YouTube video, PDF, interview.
- Three tactical drafts were local but not live before this work: DOI, website with no author, website with no date.

Live site:

- The sitemap includes the main generator pages, guide hubs, style guides, source-type guides, and several extra long-tail pages not present in this checkout: APA title page, APA format example, MLA format example, MLA format heading, Works Cited page, how to cite a movie, podcast, quote, and image.
- Before editing those live-only pages in this checkout, sync their source from the branch/deployment that produced production. Do not recreate them from scrape output unless the source cannot be recovered.

## SERP Pattern

The high-authority competitors repeat across queries:

- Official sources: APA Style, MLA Style Center, Purdue OWL.
- Commercial citation sites: Scribbr, EasyBib, Citation Machine, MyBib, BibGuru, Chegg.
- Library guides: university and community-college LibGuides.

The best opening for MLA Generator is not a generic encyclopedia article. It is an exact, worked-example page that connects the rule to the tool:

- "What fields do I need?"
- "What does this look like in APA, MLA, Chicago, Harvard, Vancouver, IEEE, and AMA?"
- "What should I check after the generator fills the citation?"
- "What edge case breaks automatic extraction?"

## Priority Clusters

1. Website edge cases

Queries around no author, no date, organization authors, access dates, and copyright years are fragmented. Official APA/MLA pages answer parts of the question, while commercial pages often stop at one style. MLA Generator can win long-tail intent with side-by-side seven-style examples and generator review guidance.

Actions already taken:

- Expanded `how-to-cite-a-website-with-no-author`.
- Expanded `how-to-cite-a-website-with-no-date`.
- Scheduled both behind future `pubDate` values.

2. DOI and journal metadata

The DOI SERP is weaker than website/formatting SERPs. It contains DOI tools, generic citation guides, and broad blog posts. A strong article should explain DOI normalization, DOI-vs-URL decisions, incomplete DOI metadata, and how to proofread generated journal citations.

Actions already taken:

- Expanded `how-to-cite-a-doi`.
- Added an extra FAQ and metadata-review sections.
- Scheduled it as the first release.

3. Formatting pages

APA title page, APA format example, MLA heading, MLA format example, and Works Cited page have high student intent. These pages are already visible in the live sitemap but absent locally. Treat them as sync-first enhancement candidates.

Recommended enhancements after source sync:

- Add printable/scan-friendly example blocks in real text, not screenshots.
- Add "student paper vs professional paper" for APA title page.
- Add "first page heading vs running header" for MLA heading.
- Add common formatting mistakes and Word/Google Docs instructions.

4. Source-type pages

Movie, image, podcast, and quote queries have long-tail intent and inconsistent competition. These should use the same source fixture across styles where possible and include "information to collect" checklists.

Recommended structure:

- Quick answer.
- What counts as this source type.
- Information to collect.
- Same source in seven styles.
- Edge cases.
- Generator review checklist.

5. Existing concept pages

Several existing concept guides are solid but short enough to merit later expansion:

- `hanging-indents` - add Word, Google Docs, Pages, and LaTeX exact steps plus troubleshooting.
- `works-cited-vs-bibliography` - add more cross-style examples and "what your teacher probably means" guidance.
- `annotated-bibliography` - add one complete APA, MLA, and Chicago annotated entry.
- `citation-generator-faq` - keep updated as extraction features change.

6. Report and grey-literature pages

Report citations are a strong bridge between the website, PDF, organization-author, and government-source clusters. The SERP is fragmented across APA-specific, MLA-specific, Chicago-specific, and library-guide answers. MLA Generator can do better by showing one report formatted in all seven supported styles and by explaining report numbers, parent agencies, annual reports, white papers, and technical reports in one place.

Actions already taken:

- Created `how-to-cite-a-report`.
- Generated its OG image.
- Scheduled it for 2026-08-24, after the DOI/no-author/no-date website edge-case releases.

7. Lecture and course-material pages

Lecture queries have high classroom intent and several important forks: live private lectures, LMS slides, course recordings, public online lectures, and YouTube videos. Official APA and MLA guidance both emphasize access and container decisions, which makes this a useful page for students who are unsure whether a lecture belongs in the reference list at all.

Actions already taken:

- Created `how-to-cite-a-lecture`.
- Scheduled it for 2026-09-07, after the report guide.
- Covered private communication handling, LMS slides, online lectures, timestamps, and seven-style examples.

## Slow-Publish System

The slow-publish system uses frontmatter as the source of truth:

- A guide is generated only when `pubDate <= build date`.
- Future-dated guide pages are hidden from static paths, the guides hub, category hubs, related-guide cards, and sitemap lastmod collection.
- `npm run content:schedule` reports due and future guides.
- `npm run content:publish-due` checks the live sitemap and writes `public/content-publish-trigger.json` only when a due local guide is missing from production.
- `.github/workflows/publish-scheduled-guides.yml` runs weekly on Monday. It commits the trigger file only when a due guide is not live. That commit should trigger the normal Cloudflare Pages deploy from `main`.

This means the cadence is controlled by `pubDate`, not by manual editing on release day. A weekly workflow is acceptable because off weeks are no-ops.

## First Scheduled Releases

| Publish date | Slug | Status | Primary keyword |
| --- | --- | --- | --- |
| 2026-07-13 | `how-to-cite-a-doi` | Expanded in repo | how to cite a DOI |
| 2026-07-27 | `how-to-cite-a-website-with-no-author` | Expanded in repo | how to cite a website with no author |
| 2026-08-10 | `how-to-cite-a-website-with-no-date` | Expanded in repo | how to cite a website with no date |
| 2026-08-24 | `how-to-cite-a-report` | Drafted in repo | how to cite a report |
| 2026-09-07 | `how-to-cite-a-lecture` | Drafted in repo | how to cite a lecture |

See `docs/content-research/publishing-calendar.json` for the longer calendar.

## Article Quality Checklist

Every article in the queue should pass this before its `pubDate` arrives:

- Primary keyword appears naturally in title, description, H1/frontmatter title, lede, and one H2.
- At least one official style source is used when stating a rule.
- Worked examples are complete and style-specific.
- The same example source is shown across all supported styles when the query calls for comparison.
- Edge cases are explicit: no author, no date, DOI vs URL, access date, organization author, missing metadata.
- One contextual generator mention is enough; avoid repeated sales language.
- FAQ frontmatter answers long-tail questions directly.
- Related guides point to already-published pages or future pages whose `pubDate` is no later than this page.
- No H1 in MDX body; guide layout owns the H1.
