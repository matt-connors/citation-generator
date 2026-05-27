# Citation Generator Overhaul — Design Spec

**Date:** 2026-05-26
**Status:** Approved by user, awaiting implementation plan
**Production target:** https://mlagenerator.com (auto-deploys from `main` via Cloudflare Pages)

## Goal

Make mlagenerator.com **measurably more accurate and reliable** by replacing fragile
hand-written extraction and citation-formatting code with proven OSS building blocks,
and lock the result in place with a **fixture-based, grounded test suite**.

The end-state is that adding a citation produces a citation string that matches the
official style guide for the chosen format on at least 95% of inputs, and we can prove
it with golden tests.

## Non-goals

- Redesigning the UI.
- Adding new client-facing features (in-text citations, group/bundle export, account
  sync, etc.).
- Replacing Cloudflare Pages as the host.
- Adding LLM-based extraction (explicitly ruled out due to ongoing cost).

## Background

The current implementation has several systemic problems:

- **Extraction is regex-driven and thin.** `cite-website` only reads `meta[name=author]`
  and a small set of date patterns; the date regexes for `MM/DD/YYYY` and `DD/MM/YYYY`
  are byte-identical (only the parse format differs), so the format that wins is
  whichever appears first in the array. The text is lowercased before matching but one
  regex expects uppercase month abbreviations. Authors are split as "word 0 = first
  name, word 1 = last name", which fails on names like "John von Neumann" or
  single-word names. JSON-LD, OpenGraph, schema.org microdata, and Twitter card meta
  are all ignored.
- **Citation formatting is hand-written per style and is wrong in ways that real users
  notice.** MLA author lists are joined with `", and "` between every author rather
  than MLA's actual rule (commas + "and" before last for two authors, "et al." for
  three or more). APA 7 uses "and" instead of "&". The `trimResult` URL detector
  matches any text containing `.com`/`.org`, which catches false positives.
- **Type definitions are internally inconsistent.** `definitions.ts` declares
  `PublicationDate` as a single object; `baseCitation.ts` types the same field as an
  array; the API actually returns an array. The code "works" because of structural
  typing and runtime forgiveness.
- **No tests.** `vitest` is in `devDependencies` but there are zero test files.
- **No caching.** Every `/api/cite-website` call re-fetches the page and re-runs the
  extractor, even for popular URLs cited by many users.
- **No observability.** Cloudflare Web Analytics gives pageview counts only. There is
  no way to measure extraction accuracy, which fields are most often wrong, or what
  fraction of users edit fields after extraction.

## Decisions

These were settled during brainstorming and constrain the design:

1. **Source-type scope:** website, book, journal article. No PDF, video, social, etc.
   in this round.
2. **Style scope:** MLA (especially 9th), APA 7, Chicago 17 held to handbook-level
   rigor. AMA, Harvard, IEEE, Vancouver tested for shape but not held to the same bar.
3. **Tests:** fixture-based with golden outputs, deterministic, run in CI on every
   commit. Live-URL evaluation may be added later as a separate manual script.
4. **Extraction backend:** in-house multi-signal extractor using cheerio. Firecrawl
   `/scrape` reserved as a fallback for hard pages, gated behind low-confidence
   detection (Phase 3, only if needed). No LLM use.
5. **Formatting engine:** citeproc-js + bundled official CSL XML style files, run
   server-side. API returns formatted strings on demand. Client bundle stays thin.
6. **Storage:** break the existing localStorage shape. Bump key to `sources_v2`.
   Anyone with saved citations from the old version loses them.
7. **Cache:** Cloudflare Cache API on `/api/cite-*` responses; 24h for websites, 30d
   for books and journals; `?nocache=1` query param bypasses.
8. **Observability:** Cloudflare Analytics Engine added in Phase 3 — per-extraction
   telemetry (domain, fields missing, signals used, latency, fallback used).
9. **Rollout:** three sequential phases, each independently mergeable. Each phase is
   gated by green fixture tests and verified on a preview deploy before merging to
   `main` (which auto-deploys to production).
10. **No Claude attribution in git commits for this project.**

## Architecture

```
Browser (Astro + React islands)
    │  GET  /api/cite-website?url=...        (cacheable)
    │  GET  /api/cite-book?isbn=...          (cacheable)
    │  GET  /api/cite-journal?doi=... | ?url=...   (cacheable)
    │      ↓ returns CSL-JSON
    │  POST /api/format  body={ csl, style }  (not cached)
    │      ↓ returns RichText[]
    ▼
Cloudflare Pages Functions (Workers runtime)
    ├── extract/  cheerio multi-signal pipeline + Cache API
    ├── book/     OpenLibrary → Google Books normalization
    ├── journal/  Crossref → OpenAlex normalization
    └── format/   citeproc-js + bundled CSL XML files
    │
    ▼  Phase 3 only
Cloudflare Analytics Engine
    domain, fields_missing, signals_used, latency_ms, fallback_used
```

Two contract shifts from today:

- **CSL-JSON is the lingua franca.** All source-type endpoints emit CSL-JSON. The
  client doesn't need source-type-specific code to render or store citations once it
  has CSL-JSON.
- **Formatting is server-side and stateless.** The client posts `(csl, style)` to
  `/api/format` and gets back `RichText[]`. Server runs citeproc-js with cached `Cite`
  instances per style.

## Components

### Server (Cloudflare Functions)

```
functions/api/
  cite-website/index.ts        — thin handler, calls extract pipeline
  cite-book/index.ts            — thin handler, calls book lookup
  cite-journal/index.ts         — NEW handler, journal lookup
  format/index.ts               — NEW handler, runs citeproc-js

functions/lib/
  extract/
    pipeline.ts                 — orchestrator: run signals, merge by confidence
    signals/jsonld.ts           — <script type="application/ld+json">
    signals/microdata.ts        — schema.org itemprop attributes
    signals/opengraph.ts        — <meta property="og:*">
    signals/twitter.ts          — <meta name="twitter:*">
    signals/meta.ts             — <meta name="author|description|...">
    signals/heuristic.ts        — rel=author, byline classes, last-resort text mining
    fetch.ts                    — fetch with proper UA, timeout, redirect handling
    normalize.ts                — signal outputs → CSL-JSON
  book/
    openlibrary.ts              — OpenLibrary Books API
    googlebooks.ts              — Google Books fallback
    normalize.ts                — API response → CSL-JSON
  journal/
    crossref.ts                 — Crossref REST API (DOI lookup)
    openalex.ts                 — OpenAlex fallback
    doi-detect.ts               — extract DOI from URL/HTML/meta
    normalize.ts                — API response → CSL-JSON
  format/
    citeproc.ts                 — citeproc-js wrapper, caches Cite instances
    styles/mla-9.csl            — bundled CSL XML, vendored at build time
    styles/apa-7.csl
    styles/chicago-17.csl
    styles/ama-11.csl
    styles/harvard.csl
    styles/ieee.csl
    styles/vancouver.csl
  cache.ts                      — Cache API wrapper (get/put with TTLs)
  csl-types.ts                  — CSL-JSON TypeScript definitions
  analytics.ts                  — Phase 3 only: write to Analytics Engine
```

### Client (React + Astro)

```
src/lib/citations/
  csl-types.ts                  — CSL-JSON types (same shape as server)
  useFormattedCitation.ts       — NEW hook: calls /api/format, caches by (uuid, style)

src/lib/references/
  useReferences.ts              — updated for CSL-JSON shape
  storage.ts                    — NEW localStorage wrapper, key "sources_v2"

src/components/react/
  References.tsx, ReferenceItem.tsx, EditCitationForm*.tsx, CitationSearch.tsx
                                — updated to read/write CSL-JSON fields
                                  and render RichText from useFormattedCitation

DELETED:
  src/lib/citations/formatSource.ts
  src/lib/citations/types/{baseCitation,book,website}.ts
  src/components/citationStyles.ts (if redundant after migration)
  functions/api/cite-website/{author-utils,date-utils,publisher-utils,
                              title-utils,consts,rewriter,fetch-data}.ts
```

## Data flow

### Website citation

1. Client `GET /api/cite-website?url=https://nytimes.com/...`.
2. Normalize the URL for caching: lowercase scheme + host, strip common tracking
   params (`utm_*`, `fbclid`, `gclid`, `ref`, `mc_cid`, `mc_eid`), strip fragments,
   keep path + remaining query in stable order. Use the normalized URL as both the
   fetch target and the cache key.
3. Function checks Cloudflare Cache API for the normalized URL. On hit, return cached
   response immediately. Optionally trigger async revalidation if the cached entry is
   older than half the TTL.
4. On miss: validate URL. `fetch.ts` retrieves HTML with a modern User-Agent, 10s
   timeout, follows redirects, accepts only `text/html` (rejects with `415` otherwise).
5. Load HTML into cheerio once. Run all six signal extractors in parallel against the
   same `$` instance.
6. Each signal returns a partial CSL-JSON plus per-field confidence (0–1). Confidences
   are tuned per signal: JSON-LD ≈ 0.95, OpenGraph ≈ 0.75, meta tags ≈ 0.55,
   heuristics ≈ 0.35.
7. `merge.ts` picks the highest-confidence value per field. Records `_signals` (which
   signal won for which field) for analytics/debug.
8. Response body: `{ uuid, type: "webpage", csl, _signals, _cached: false }`.
9. Cache the response with `Cache-Control: public, max-age=86400` and the normalized
   URL as the cache key.
10. Client persists `{ uuid, csl }` to localStorage `sources_v2`. The `_signals` field
    is debug-only and discarded client-side.

### Book citation

1. Client `GET /api/cite-book?isbn=...`.
2. Validate ISBN-10 or ISBN-13. On invalid format, `400`.
3. Cache lookup. On miss: query OpenLibrary by ISBN. If miss or 5xx, fall through to
   Google Books.
4. Normalize the response to CSL-JSON with `type: "book"`.
5. Cache for 30 days. Return same envelope as website.

### Journal citation

1. Client `GET /api/cite-journal?doi=...` or `?url=...`.
2. If URL given: detect DOI in the page (regex `/10\.\d{4,}\/[-._;()/:A-Z0-9]+/i`
   plus `meta name="citation_doi"`, `dc.identifier`, etc.). If no DOI found, fall back
   to the website pipeline with `type: "article-journal"` if signals suggest it.
3. With a DOI: cache lookup. On miss: query Crossref. On miss/error, fall through to
   OpenAlex.
4. Normalize the response to CSL-JSON with `type: "article-journal"`.
5. Cache for 30 days.

### Author name parsing

Within `normalize.ts` (extraction side) and within citeproc-js's CSL-JSON consumer
(formatting side), author names follow CSL-JSON's structured shape: `{ family, given,
"non-dropping-particle"? , "dropping-particle"?, suffix? }`. Normalization rules:

- If a signal yields a structured shape (JSON-LD with `{ "@type": "Person", givenName,
  familyName }`), use it verbatim.
- For free-form strings:
  - "Last, First" → `{ family: Last, given: First }`.
  - "First Last" → split on whitespace; treat last token as family, rest as given.
  - "First Middle Last" → family = last token, given = rest joined.
  - Particles ("von", "de", "del", "van", "la") between given and family go in
    `non-dropping-particle`.
  - Suffixes ("Jr.", "Sr.", "III", "PhD") go in `suffix`.
  - Single token → `{ family: token }` (no given).
- A corporate author is detected when the string contains a known org suffix ("Inc.",
  "LLC", "Ltd.", "Corporation", "Foundation", "Press", "University", etc.) or the
  source explicitly marks `@type: Organization`. CSL-JSON represents it as a single
  `family` field with `"literal": <name>` so citeproc renders it untouched.

The brittle "< 3 words required" check in today's `author-utils.ts` is dropped.

### Formatting

1. Client `POST /api/format` with body `{ csl, style: "mla-9" }`.
2. Server loads cached `Cite` instance for that style (created lazily on first use,
   kept in the Worker isolate's memory).
3. citeproc-js renders the citation. Server returns `{ formatted: RichText[] }` —
   text segments with optional `italic` flags.
4. Client renders to HTML in the existing `ReferenceItem`. Caches by `(uuid, style)`
   in a `Map` for the session, so toggling between styles in the dropdown is instant
   after the first fetch.

## Error handling

- **Partial extraction is success.** Missing fields are surfaced to the user via the
  edit form, not as errors. The API always returns the CSL-JSON it managed to build.
- **Fetch errors** (network, timeout, non-200, non-HTML content): `400` with
  `{ error: <human readable>, code: <machine readable>, retryable: <bool> }`.
- **Invalid input** (malformed URL/ISBN/DOI): `400` with specific code
  (`invalid_url` / `invalid_isbn` / `invalid_doi`) for field-specific UI.
- **citeproc errors** (malformed CSL-JSON, unknown style): `500` with logged details.
  Should be unreachable in production if the client uses the agreed style set; if it
  happens, treat as a server bug.
- **Outbound API down** (OpenLibrary, Crossref, etc.): per-provider 5s timeout, fall
  through to the next provider. If all providers fail, `503` with
  `{ retryable: true }`.
- **Middleware** wraps everything: any uncaught exception logged with stack and a
  masked URL (no query strings in error responses; could contain PII or tokens).

## Testing

All tests are pure functions over fixtures. **No live network in CI.**

```
tests/
  extract/
    fixtures/
      <test-name>/
        input.html              ← saved HTML from a real page (gzipped if large)
        input.url               ← the URL it was scraped from
        expected.csl.json       ← hand-verified expected metadata
    extract.test.ts             ← load fixture, run pipeline, diff
    signals.test.ts             ← per-signal unit tests

  format/
    fixtures/
      <test-name>/
        csl.json
        mla-9.txt               ← expected output, one per style
        apa-7.txt
        chicago-17.txt
        ...
    format.test.ts              ← run citeproc per style, compare

  book/
    fixtures/openlibrary/*.json
    fixtures/googlebooks/*.json
    book.test.ts                ← mock fetch, verify normalization

  journal/
    fixtures/crossref/*.json
    fixtures/openalex/*.json
    journal.test.ts

  e2e/
    pipeline.test.ts            ← HTML fixture → CSL → MLA-9 string

scripts/
  eval.ts                       ← optional: live-URL accuracy run, manual only
```

**Initial corpus**

- Extraction: ~20 HTML fixtures across well-marked-up news, poorly-marked-up blogs,
  .gov pages, academic landing pages, social posts, paywalled pages, hard cases.
- Formatting: ~10 CSL-JSON fixtures covering typical edge cases (1, 2, 3, 4+ authors;
  with/without date; with/without DOI; corporate authors; missing fields).
- MLA 9 specifically: every example from the MLA Handbook's webpage and journal
  sections as a fixture. We are literally tested against the handbook.
- Per-API fixtures: 5 each for OpenLibrary, Google Books, Crossref, OpenAlex saved
  responses.

**CI gate**

Add `npm test` to `package.json` scripts. CI runs `npm test`. All tests must pass
before merging any phase to `main`.

## Phased rollout

### Phase 1 — Backend foundation + minimum-viable client

**Scope (server)**

- New extraction pipeline: cheerio-based multi-signal with confidence scoring.
- Replace `cite-website` internals; preserve the route URL.
- Replace `cite-book` internals; OpenLibrary primary + Google Books fallback.
- Add `cite-journal` endpoint.
- Add `/api/format` server-side formatter (citeproc-js + bundled CSL XML for at least
  MLA 9, APA 7, Chicago 17 in this phase; other styles can have placeholder CSL files
  expanded in Phase 2).
- Cloudflare Cache API wrapping all three `cite-*` endpoints; URL normalization for
  the cache key.

**Scope (client — minimum to keep the app working)**

- localStorage key bumped to `sources_v2`. Old entries silently abandoned: on read,
  if the stored shape doesn't match CSL-JSON, return empty.
- `useReferences` reworked to store/load CSL-JSON.
- New `useFormattedCitation` hook calls `/api/format` and caches by `(uuid, style)`.
- `ReferenceItem` updated to render `RichText[]` from the hook.
- Edit form (`EditCitationForm*`) updated to read/write CSL-JSON fields (title,
  author array, issued date-parts, container-title, URL, etc.).

**Scope (testing)**

- vitest config, `tests/` directory, `npm test` script, CI gate.
- Fixture corpus minimum:
  - 10 extraction fixtures across the major shape categories.
  - MLA 9 formatting fixtures based on handbook examples.
  - 5 each: OpenLibrary, Google Books, Crossref, OpenAlex saved responses.

**Acceptance criteria**

- All Phase 1 fixture tests pass.
- Preview deploy verified: adding a citation from each of {nytimes, wikipedia, a .gov
  page, an academic landing page, a book ISBN, a DOI} produces correct CSL-JSON and a
  correct MLA 9 citation.
- No regression in existing UI flows (manually verified on preview).
- Existing localStorage entries from the old shape do not crash the app (defensive
  read; on shape mismatch, ignore and start fresh).

### Phase 2 — Style coverage + cleanup

**Scope**

- Delete now-unused hand-written formatters (`formatSource.ts`, `baseCitation.ts`,
  `types/{website,book}.ts`, `components/citationStyles.ts` if redundant).
- Add bundled CSL XML for the remaining styles (AMA 11, Harvard, IEEE, Vancouver).
- Expand formatting fixture corpus to cover all 7 styles.
- Polish any places skipped in Phase 1 for time (e.g., journal-specific UI hints in
  the edit form, citation-search auto-suggesting `cite-journal` for DOI input).
- Refactor pass: anything in the React components that still carries old-shape
  artifacts.

**Acceptance criteria**

- Formatting tests pass for all 7 styles.
- MLA 9, APA 7, Chicago 17 outputs match handbook examples byte-for-byte.
- Other styles match published examples in shape (verified visually, not byte-for-byte).
- Preview deploy: switch between styles in the dropdown for a saved citation — output
  updates correctly and is cached client-side.
- No references to the deleted modules remain in the codebase.

### Phase 3 — Observability + Firecrawl fallback (conditional)

**Trigger:** only if Phase 1+2 accuracy is below the 95% target on the eval corpus, or
if specific high-traffic domains are showing systematic failures.

**Scope**

- Add Cloudflare Analytics Engine binding.
- `analytics.ts` writes `(domain, fields_missing, signals_used, latency_ms,
  fallback_used)` per extraction. No PII (domain only, no path).
- Firecrawl `/scrape` integration as a fallback fetcher. Triggers when the in-house
  extractor produces a result with no title OR no date OR confidence below threshold.
- `FIRECRAWL_API_KEY` added to Cloudflare Function env.
- Per-extraction cost tracking via Analytics Engine.

**Acceptance criteria**

- Analytics Engine queries show baseline extraction accuracy and a measurable lift
  from Firecrawl fallback usage.
- Firecrawl is called on no more than ~10% of total extractions (i.e. it's truly a
  fallback, not the default).

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| citeproc-js bundle exceeds Worker size limit | Spike during Phase 2; if needed, lazy-load styles, drop less-used ones, or run citeproc-js client-side as originally proposed. |
| Cloudflare Cache API has per-Worker-isolate quirks (some regions don't cache POST) | Use `GET` on cite endpoints (URL query params), not POST. Verify with a preview deploy. |
| Sites block our User-Agent | Use a realistic modern UA; respect `robots.txt` directive at the page level if present. |
| OpenLibrary / Crossref outage | Each provider gets a 5s timeout and falls through to the next. Cache absorbs repeat lookups. |
| Existing users complain about lost localStorage data | Phase 1 ships a note on the page first deploy: "We updated how citations are stored; you may need to re-add saved references." User has chosen to accept this. |
| Firecrawl spend creeps up | Budget alert on the Firecrawl account; rate-limit our calls. Skip Phase 3 entirely if not needed. |
| Auto-deploy from `main` ships a regression to prod | Every phase lands via PR, verified on preview, with passing tests. No direct pushes to `main`. |

## What's explicitly NOT in this overhaul

- Account/auth or cross-device sync.
- In-text citation generation (`(Smith 2023, 42)` etc.).
- BibTeX / RIS / EndNote XML export.
- Library / collection management (folders, tags).
- Plagiarism check or paraphrase tools.
- Mobile app.
- Any LLM-based extraction or formatting.

## Open questions

None blocking implementation. The following are nice-to-haves for follow-up specs:

- Should we publish the eval-corpus + accuracy numbers publicly as a credibility
  signal? (Marketing decision, not technical.)
- Should we offer a one-page "your old citations" recovery flow that lets users paste
  their old `sources` JSON and migrates it client-side? (Could be added in a small
  follow-up PR if user feedback warrants it.)
