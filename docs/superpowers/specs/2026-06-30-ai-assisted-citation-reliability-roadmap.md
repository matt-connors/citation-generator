# AI-Assisted Citation Reliability Roadmap

**Date:** 2026-06-30
**Status:** Baseline implementation completed in code; later phases remain gated
**Production target:** https://mlagenerator.com, deployed through Cloudflare Pages
**Supersedes in part:** The "No LLM use" constraint in
`2026-05-26-citation-generator-overhaul-design.md`. The CSL/citeproc direction,
fixture testing, cache strategy, and Cloudflare hosting target remain intact.

## Goal

Make MLA Generator the citation tool that combines structured citation rules with
bounded AI assistance:

- Use the existing deterministic CSL pipeline as the source of truth for citation
  structure and final formatting.
- Replace brittle server-side browser work with a fetch-then-render acquisition
  pipeline built on Cloudflare Browser Run.
- Use AI only where it can reduce user grunt work or flag review-worthy issues,
  and only when it is grounded in fetched, rendered, pasted, or authority-source
  evidence.
- Add conservative citation-quality warnings that help users review missing,
  ambiguous, conflicting, or style-specific fields without creating false
  alarms.
- Define explicit cost, latency, reliability, UX, rollout, and eval gates before
  implementing runtime changes.

The product promise is:

> We help you create citations from real source evidence, format them with a
> structured citation engine, and warn you when something deserves review.

## Current State

The current production architecture is already much stronger than the original
May baseline:

- `/api/cite-website` normalizes the URL, checks cache, fetches HTML, runs a
  deterministic extraction pipeline, adds an access date, writes Analytics
  Engine events, and caches the result.
- `functions/lib/extract/fetch.ts` has SSRF-oriented blocked-host checks,
  redirect validation, content-type checks, a 10s timeout, and a 5 MB body cap.
- `functions/lib/extract/pipeline.ts` runs JSON-LD, microdata, OpenGraph,
  Twitter, meta, and heuristic signals through `mergeSignals`.
- `functions/lib/extract/merge.ts` picks the highest-confidence signal per CSL
  field and emits `_signals`, but not full field provenance.
- `functions/lib/csl-types.ts` defines CSL data and the public
  `ExtractEnvelope`.
- `/api/format` formats CSL through citeproc and bundled style files.

This roadmap keeps that foundation. The primary gap is that the acquisition and
review layers are still too binary:

- Server fetch may receive incomplete static shells, anti-bot pages, partial
  metadata, or content that only appears after JS execution.
- `_signals` records only the winning signal name, not evidence, raw values,
  alternatives, or conflicts.
- The system does not distinguish "missing but acceptable" from "missing and
  likely harmful."
- AI is not yet available as an evidence-grounded extraction or sanity-check
  assistant.

## Product Principles

1. **Accuracy outranks completeness.**
   It is better to leave a field blank with a useful review warning than to fill
   it with unsupported or fabricated information.

2. **Populate aggressively, verify conservatively.**
   Use fetch, rendered HTML, DOI/ISBN authority APIs, page metadata, visible
   text, extension capture, and AI assist to do the grunt work. Save or display
   only values with evidence.

3. **AI is an assistant, not an authority.**
   AI can propose fields, identify conflicts, classify source type, and explain
   review issues. It must not invent missing author/date/publisher data, replace
   citeproc, or decide citation style rules from memory.

4. **Warnings must be humble and style-aware.**
   A blank author is not always wrong. A blank date is often acceptable with
   `n.d.` or an access date. Warnings should help the user inspect the source,
   not accuse the citation of being invalid unless the rule matrix proves it.

5. **Blocked pages are a normal state.**
   Some sites will block automated access. The product should identify that
   state clearly and offer recovery paths: browser extension capture, paste page
   text, DOI/ISBN lookup, or manual entry.

6. **Latency is a UX budget, not a backend detail.**
   Fetch should produce a fast first answer. Render and AI should enrich or
   review that answer progressively unless the fetch result is unusable.

7. **Costs must be governed by trigger rate.**
   Token costs are low enough for bounded checks, but not low enough to call
   large models for every citation without a reason. Browser rendering is cheap
   by the hour but expensive in latency if used for every request.

## Non-Goals

- Do not turn the citation generator into an open-ended chatbot.
- Do not replace citeproc formatting with model-generated formatted citations.
- Do not build stealth CAPTCHA or anti-bot evasion as a product feature.
- Do not promise that every source can be automatically fetched.
- Do not add account sync, paid plans, or document upload in this roadmap.
- Do not broaden source-type scope until websites, books, and journal articles
  have reliable quality checks.

## Core Architecture

```
User input
  | URL / DOI / ISBN / extension capture / pasted page text
  v
Citation acquisition orchestrator
  |-- Fast fetch path
  |     fetch HTML -> deterministic extraction -> field provenance
  |
  |-- Authority path
  |     DOI -> Crossref/OpenAlex
  |     ISBN -> OpenLibrary/Google Books
  |
  |-- Render path
  |     Browser Run content/markdown/html -> deterministic extraction
  |
  |-- AI assist path
  |     strict JSON extraction/check using evidence snippets
  v
Evidence merge
  | strongest source wins per field
  | conflicts retained
  | no-evidence AI proposals discarded or downgraded
  v
CSL item + provenance + quality warnings
  v
citeproc format endpoint
  v
User review UI
```

The runtime split should be:

- `functions/lib/acquisition/`: orchestrates fetch, render, AI, and authority
  lookups.
- `functions/lib/extract/`: remains responsible for deterministic extraction
  from HTML/markdown/text.
- `functions/lib/provenance/`: normalizes field-level evidence and merge inputs.
- `functions/lib/validation/`: style/source-type warning rules.
- `functions/lib/ai/`: provider-agnostic AI calls through Workers AI or AI
  Gateway.

## Fetch-Then-Render Strategy

### Why not render-only?

Render-only is simpler but gives up the best properties of the current system:
low latency, low cost, predictable cache behavior, and deterministic HTML
inspection. Rendering every URL also increases exposure to blocked pages and
page-load variance.

### Why not render only on "low confidence"?

Low-confidence detection is useful but not sufficient. A static page can expose
a title and URL while hiding article body, author, date, or publisher in
JS-rendered components. A naive threshold will misclassify these pages as good
enough.

### Decision

Use progressive acquisition:

1. Run normal fetch first.
2. Run deterministic extraction immediately.
3. If the result is good enough for an initial answer, return it quickly.
4. Decide whether to render using concrete page-state signals, not a single
   confidence score.
5. If rendering runs, merge rendered evidence into the existing result.
6. If rendered evidence conflicts with fetched evidence, surface a review
   warning unless one evidence source is clearly authoritative.

### First-response policy

The endpoint can evolve in stages:

1. **Phase A:** keep one synchronous `/api/cite-website` response and keep
   acquisition policy server-side. Internal evals may use a secret token to
   force fetch/render modes, but public clients cannot.
2. **Phase B:** return fast fetch result plus `_quality.enrichmentAvailable`
   hints. The client can request rendered enrichment.
3. **Phase C:** provide async background enrichment through a second endpoint or
   queue if Cloudflare Pages constraints make long synchronous work brittle.

The first implementation should not require a queue. It should prove the
rendered acquisition and merge rules before adding async state.

## Render Trigger Signals

Rendering should run when any hard trigger is present, or when enough soft
signals accumulate.

### Hard triggers

- Fetch returns timeout, 403/429, 5xx, network failure, or not-HTML.
- Title or body contains blocker strings such as `just a moment`,
  `access denied`, `captcha`, `enable javascript`, `checking your browser`, or
  `unusual traffic`.
- Body text is extremely small after removing script/style/nav-like content.
- The page has a meaningful URL but no usable title.
- The user explicitly clicks "try rendered page" or extension/client asks for it.

### Soft triggers

- No author, issued date, publisher/container, DOI, or article text was found.
- Script bytes greatly exceed visible body text bytes.
- The title is generic or host-only.
- The page has application framework markers but little readable content.
- OpenGraph/Twitter fields exist but JSON-LD/citation/meta fields are absent.
- The source type is ambiguous between webpage, article-journal, report, or news
  article.
- The host is on an empirical "render often helps" list from analytics.

### Do not render when

- The source is already resolved through DOI/Crossref or ISBN authority data and
  the user did not ask for page verification.
- The host is rate-limited or blocked for render due to prior failures.
- Cache already has a fresh high-quality result.
- The user is editing an existing local citation and only needs formatting.

## Page Readiness Detection

Browser Run should be asked for rendered content, but the system still needs to
judge whether the page actually loaded. Do not trust one `networkidle`-style
condition. Compute a readiness report from snapshots.

Suggested `PageReadiness` shape:

```ts
export interface PageReadiness {
  status: 'ready' | 'partial' | 'blocked' | 'timeout' | 'empty';
  title: string;
  canonicalUrl?: string;
  textLength: number;
  metadataFieldCount: number;
  articleLikeTextLength: number;
  blockerSignals: string[];
  stableSignals: string[];
  reason: string;
}
```

Signals:

- Title changed from loading/blocker/generic to meaningful.
- Canonical URL is present and public.
- Main text length crosses minimum threshold.
- Article-like text appears near title/byline/date clusters.
- Metadata field count increases after rendering.
- Snapshot N and N+1 are stable enough to avoid capturing a loading shell.
- Blocker phrases disappear or remain present.

If readiness is `partial`, use the evidence but retain a quality warning. If it
is `blocked`, do not retry repeatedly. Return a blocked-source UX path.

## Bot Blockers and Anti-Scrape Systems

The product is trying to cite user-requested sources, not bulk-scrape the web.
Still, many sites do not distinguish those cases.

### Allowed compatibility work

- Clear user agent that identifies MLA Generator.
- Host-level rate limits.
- Cache successful source metadata aggressively.
- Respect HTTP failures and repeated blocker states.
- Use Browser Run for ordinary JS rendering.
- Let the browser extension capture from a page the user has already opened.
- Let users paste page text or metadata when automated access is blocked.

### Avoid

- CAPTCHA solving.
- Credential sharing.
- Proxy rotation for stealth.
- Fingerprint spoofing arms races.
- Ignoring robots/terms signals when a site explicitly denies automated access.

### UX states

Blocked copy should be direct:

> This site blocked automated access. You can still cite it by using the browser
> extension, pasting page text, entering a DOI/ISBN, or filling the fields
> manually.

The recovery UI should offer:

- "Use browser extension"
- "Paste page text"
- "Search by DOI"
- "Search by ISBN"
- "Enter manually"

## Field Provenance

The next foundational implementation step is field provenance. `_signals` is not
enough for AI, warnings, or conflict resolution.

Suggested shape:

```ts
export type EvidenceSource =
  | 'jsonld'
  | 'microdata'
  | 'opengraph'
  | 'twitter'
  | 'meta'
  | 'heuristic'
  | 'fetch-html'
  | 'rendered-html'
  | 'browser-extension'
  | 'pasted-text'
  | 'crossref'
  | 'openalex'
  | 'openlibrary'
  | 'google-books'
  | 'ai-extract'
  | 'user-edit';

export interface FieldEvidence {
  field: keyof CSLItem;
  normalizedValue: unknown;
  rawValue?: string;
  source: EvidenceSource;
  locator?: string;
  snippet?: string;
  confidence: number;
  acquiredAt: string;
}

export interface FieldProvenance {
  winner?: FieldEvidence;
  candidates: FieldEvidence[];
  conflicts: FieldEvidence[];
}
```

Merge rules:

- Authority sources beat page metadata for DOI/ISBN-resolved bibliographic
  fields unless the authority result is incomplete or obviously for a different
  work.
- User edits beat all automated fields.
- Browser extension capture beats server fetch/render for content visible to the
  user, but should still be validated for shape.
- JSON-LD/citation meta usually beat OpenGraph/Twitter.
- AI proposals can fill an empty field only with a snippet/locator and a
  confidence threshold. AI proposals should not silently overwrite a
  deterministic or authority field.
- Conflicts should survive into `_quality`, even if the merge chooses a winner.

## AI Assistance

### AI assist 1: missing-field extraction

Trigger when deterministic extraction has empty or ambiguous fields and there is
text evidence to inspect.

Input:

- URL, canonical URL, host.
- Existing CSL item.
- Existing field provenance.
- Cleaned snippets from fetched and/or rendered page content.
- Source-type candidates.
- Strict JSON schema.

Output:

```ts
export interface AiFieldProposal {
  field: keyof CSLItem;
  value: unknown;
  evidenceSnippet: string;
  evidenceSource: 'fetched' | 'rendered' | 'pasted' | 'extension';
  rationale: string;
  confidence: number;
}
```

Rules:

- No evidence snippet, no auto-fill.
- If the evidence snippet is not present in the supplied content, discard.
- If the model proposes formatted citation text instead of fields, discard.
- If the model proposes an author/date/publisher absent from evidence, discard.
- If the model changes source type, require either metadata evidence or a strong
  text signal.

### AI assist 2: citation sanity check

Trigger after CSL formatting, usually with a cheap model.

Questions:

- Does the generated citation match the CSL fields?
- Are key fields unexpectedly missing for this source type and style?
- Is the source type likely wrong?
- Are there suspicious conflicts between title, URL, container, or DOI?
- Is the model unable to make a determination from evidence?

Output should be warnings only. It should not mutate CSL.

### AI assist 3: claim checking

This should be opt-in and likely premium or rate-limited:

1. User pastes paragraph or claims.
2. System splits claims.
3. Claims are mapped to saved sources or user-selected sources.
4. Source text is fetched/rendered/cached or user-provided.
5. AI returns `supported`, `partially_supported`, `not_supported`,
   `source_unavailable`, or `not_enough_evidence`, with evidence snippets.

This is not required for the first implementation, but the provenance and
blocked-source work should keep the door open.

## Citation Quality Warnings

Warnings are generated from CSL, source type, style, provenance, and conflicts.

Suggested shape:

```ts
export interface CitationQualityWarning {
  code: string;
  field?: keyof CSLItem;
  severity: 'info' | 'review' | 'warning' | 'error';
  message: string;
  action:
    | 'none'
    | 'review-field'
    | 'choose-source-type'
    | 'confirm-no-listed-author'
    | 'try-rendered-page'
    | 'use-extension'
    | 'paste-text'
    | 'enter-manually';
  evidence?: FieldEvidence[];
}
```

### Warning taxonomy

- **Missing critical identity**
  - no title
  - no URL/DOI/ISBN depending on source type
  - no source type

- **Missing review-worthy field**
  - no author
  - no publication date
  - no publisher/container for source types where it is useful
  - no volume/issue/pages for journal articles

- **Ambiguous field**
  - low-confidence author/date
  - personal author vs organization author unclear
  - source type unclear

- **Conflicting evidence**
  - fetched title differs materially from rendered title
  - JSON-LD date differs from citation meta date
  - DOI from page differs from DOI authority lookup
  - canonical URL differs from input URL after normalization

- **Style-specific issue**
  - MLA web source missing title or container where expected
  - APA/Chicago date fallback needed
  - journal article missing required bibliographic components
  - numeric styles need stable citation order outside the single-entry formatter

- **Blocked/incomplete acquisition**
  - server fetch blocked
  - rendered page blocked
  - page loaded partially
  - source text unavailable for claim checking

### Example warning copy

Missing author:

> No author was found. If this source lists a person or organization, add it.
> If the page has no listed author, this may be correct.

Missing date:

> No publication date was found. Review the source for a posted or updated date;
> otherwise the citation will use the style's no-date fallback.

Conflicting date:

> We found more than one publication date. Review the date field before using
> this citation.

Blocked:

> This site blocked automated access. Use the browser extension, paste page text,
> or enter the citation details manually.

### Rule matrix

Implement the rule matrix by source type first, then style:

- `webpage`
- `book`
- `article-journal`
- `article-magazine`
- `article-newspaper`

Priority styles:

- MLA 9
- APA 7
- Chicago 18

Secondary styles:

- AMA 11
- Harvard
- IEEE
- Vancouver

The rule matrix should not say "required" unless a style/source-type rule truly
requires the field. Prefer "review" language for fields that are frequently
needed but legitimately absent.

## Model and Platform Strategy

### Cloudflare-first stack

- **Browser Run:** use Quick Actions and/or bindings for rendered content.
- **Workers AI:** default for low-cost JSON-mode extraction/checking.
- **AI Gateway:** route external fallbacks, store provider keys if needed,
  monitor usage, add caching/rate limiting, and eventually dynamic routing.

AI Gateway core features are currently offered free, including dashboard
analytics, caching, and rate limiting. Unified Billing applies a 5% fee on
credits purchased through that mechanism, while provider inference pricing is
passed through with no markup.

### Workers AI JSON mode caveat

Workers AI supports JSON mode and JSON-schema-shaped responses, but Cloudflare
documents that schema compliance is not guaranteed in all cases and failures can
return a `JSON Mode couldn't be met` error. Therefore every model response must
still be validated and treated as untrusted input.

### Candidate model costs

All token prices below are official listed USD per million input/output tokens
as reviewed on 2026-06-30. Refresh before launch or large traffic shifts because
provider model catalogs and prices change quickly.

| Provider path | Model | Input | Output | Role |
| --- | ---: | ---: | ---: | --- |
| Workers AI | `@cf/meta/llama-3.2-3b-instruct` | $0.051 | $0.335 | cheapest text extraction candidate |
| Workers AI | `@cf/meta/llama-3.1-8b-instruct-fp8-fast` | $0.045 | $0.384 | cheap sanity checks |
| Workers AI | `@cf/qwen/qwen3-30b-a3b-fp8` | $0.051 | $0.335 | cheap structured extraction candidate |
| Workers AI | `@cf/meta/llama-3.3-70b-instruct-fp8-fast` | $0.293 | $2.253 | high-quality Cloudflare fallback |
| Workers AI | `@cf/openai/gpt-oss-20b` | $0.200 | $0.300 | balanced open model candidate |
| Workers AI | `@cf/openai/gpt-oss-120b` | $0.350 | $0.750 | stronger fallback if needed |
| OpenAI via Gateway | `gpt-5.4-nano` | $0.20 | $1.25 | external fallback, structured outputs |
| OpenAI via Gateway | `gpt-5.4-mini` | $0.75 | $4.50 | stronger external fallback |
| Gemini via Gateway | `Gemini 3.1 Flash-Lite` | $0.25 | $1.50 | external fallback, low-cost Gemini 3 tier |
| Anthropic via Gateway | `Claude Haiku 4.5` | $1.00 | $5.00 | avoid as default due cost |
| Anthropic via Gateway | `Claude Sonnet 5` | $2.00 until 2026-08-31 | $10.00 until 2026-08-31 | premium escalation only |

The default implementation uses a Workers AI JSON-mode-capable model and keeps
the model configurable. Treat the table as launch-planning input, not an
accuracy benchmark; run the eval suite before changing the production default.

### Unit economics assumptions

For an AI extraction/check call with 3,000 input tokens and 250 output tokens:

| Model | Cost per AI call |
| --- | ---: |
| Workers AI 3B/Qwen cheap tier | about $0.00024 |
| Workers AI 8B fp8 fast | about $0.00023 |
| Workers AI Llama 3.3 70B | about $0.00144 |
| Workers AI gpt-oss-20b | about $0.00068 |
| Workers AI gpt-oss-120b | about $0.00124 |
| OpenAI gpt-5.4-nano | about $0.00091 |
| OpenAI gpt-5.4-mini | about $0.00338 |
| Gemini 3.1 Flash-Lite | about $0.00113 |
| Anthropic Claude Haiku 4.5 | about $0.00425 |
| Anthropic Claude Sonnet 5 intro | about $0.00850 |

At 1M monthly citations:

| Scenario | Monthly cost estimate |
| --- | ---: |
| AI cheap tier on 20% of citations | about $45-$50 |
| AI 70B on 20% of citations | about $288 |
| AI 70B on 100% of citations | about $1,442 |
| OpenAI nano on 20% of citations | about $183 |
| Gemini 3.1 Flash-Lite on 20% of citations | about $225 |
| Anthropic Haiku on 20% of citations | about $850 |

Browser Run pricing:

- Workers Paid includes 10 browser hours/month.
- Additional browser hours cost $0.09/hour.
- Quick Actions are charged for browser hours only.
- Browser Sessions add concurrent-browser pricing, so prefer Quick Actions for
  this product unless direct browser control becomes essential.

At 1M monthly citations, if 10% render and each render consumes 5 seconds:

- 100,000 renders * 5 seconds = 138.9 browser hours.
- Subtract 10 included hours = 128.9 billable hours.
- 128.9 * $0.09 = about $11.60/month.

The dominant render cost is not dollars; it is latency and operational variance.

## Latency Budget

Target user experience:

- Cache hit: less than 250 ms backend time.
- Fetch + deterministic extraction: p50 less than 1.5s, p95 less than 5s.
- Rendered enrichment: p50 less than 6s, p95 less than 15s.
- AI check: p50 less than 1.5s, p95 less than 5s for cheap models.
- First usable citation should appear before rendered enrichment unless fetch is
  blocked or empty.

UX states:

1. "Creating citation..."
2. "Checking rendered page..." if enrichment is running.
3. "Review suggested fields" when warnings exist.
4. "Site blocked automated access" for blocked states.

Do not hide the initial citation behind render/AI unless the fetch result lacks
critical identity fields.

## Data Contracts

`ExtractEnvelope` should eventually become:

```ts
export interface ExtractEnvelopeV3 {
  uuid: string;
  type: CSLType;
  csl: CSLItem;
  _signals?: Record<string, string>;
  _provenance?: Partial<Record<keyof CSLItem, FieldProvenance>>;
  _quality?: {
    score: number;
    warnings: CitationQualityWarning[];
    acquisition: {
      fetch: AcquisitionAttempt;
      render?: AcquisitionAttempt;
      ai?: AcquisitionAttempt;
      authority?: AcquisitionAttempt;
    };
  };
  _cached?: boolean;
}
```

Keep `_signals` during transition for existing analytics and debug views. Add
`_provenance` and `_quality` behind tests before changing client UI.

## API Surface

Initial additions:

- `GET /api/cite-website?url=...`; acquisition mode, cache bypass, and AI
  assist are server-policy decisions, not public query controls.
- Internal-only eval overrides use `x-mla-internal-token` plus the optional
  `acquisition` and `nocache` query params.
- `POST /api/quality/check` with `{ csl, style, provenance? }`

Potential later additions:

- `POST /api/cite-website/enrich` with `{ url, csl, provenance }`
- `POST /api/cite-website/from-text` with pasted text and source URL
- `POST /api/claims/check` with `{ claimsText, sources }`

## UX Plan

### Citation creation

- Show the generated citation quickly.
- Show compact quality status: "Looks complete", "Review 2 fields", or "Source
  blocked".
- Let users expand warnings.
- Field-level badges in the edit drawer:
  - "Found in page metadata"
  - "Found after rendering"
  - "Suggested from page text"
  - "Edited by you"
  - "Needs review"

### Warning handling

Each warning should have a next action:

- Review field
- Mark as no listed author
- Try rendered page
- Use extension
- Paste text
- Choose source type

### Extension as a reliability path

The Chrome extension should become part of the blocked-site story:

- If server fetch/render fails, prompt extension install/use.
- Extension captures metadata from the user-visible tab.
- Extension hands off CSL and provenance into My References.
- Server can still format through `/api/format`.

## Observability

Add Analytics Engine events for:

- acquisition attempt: fetch/render/ai/authority/extension/paste
- acquisition result: success/partial/blocked/timeout/error
- rendered_ms and browser_ms_used when available
- ai_model, ai_input_tokens, ai_output_tokens, ai_cost_estimate
- warning codes emitted
- fields missing before and after render
- fields missing before and after AI
- user edits after generated citation
- host-level block/render success rates

Do not store full URLs, pasted text, claims, or source snippets in analytics.
Store host and normalized event dimensions only.

## Testing and Evals

### Unit tests

- provenance normalization
- merge precedence
- warning rule matrix
- blocked-page detection
- page-readiness scoring
- AI response validation
- no-evidence AI proposal rejection

### Fixture tests

Extend existing extraction fixtures with:

- static rich metadata page
- JS-rendered article page
- partial static metadata with JS-rendered byline/date
- Cloudflare-style blocker page
- generic "enable JavaScript" page
- journal landing page with DOI
- news article without listed author
- organization-authored page
- no-date web page
- conflicting metadata dates

### Live eval script

Add a manual script, not CI-blocking at first:

```bash
npm run eval:citation-acquisition -- --sample fixtures/live-urls.json
```

Output:

- fetch success rate
- render success lift
- field fill-rate lift
- warning precision sample
- average latency
- estimated render/model cost

### Human QA

For warning copy and false positives, human review is required. A green unit test
cannot prove that a warning feels correct to a student.

Minimum review set before launch:

- 25 websites
- 10 books
- 15 journal articles
- 10 blocked or partially blocked pages
- 10 pages with no listed author/date

## Rollout Plan

### Phase 1: Provenance foundation

Deliverables:

- Add field-level provenance types.
- Teach existing signals to emit evidence candidates.
- Preserve current `csl` output.
- Add tests that current fixtures still pass.

Gate:

- No behavior regression in existing extraction and formatting tests.
- `_provenance` can be enabled without client changes.

### Phase 2: Quality warnings

Deliverables:

- Add validation module and rule matrix.
- Return `_quality.warnings` from cite endpoints.
- Add warning fixture tests.
- Add UI summary and edit-drawer field hints.

Gate:

- Missing-author/no-date warnings are review-level, not errors.
- No warning says "required" unless backed by a rule.
- Human QA signs off on copy tone.

### Phase 3: Browser Run rendered acquisition

Deliverables:

- Add Browser Run client/binding wrapper.
- Add server-policy-driven `auto` rendering plus internal eval overrides.
- Add readiness scoring and blocker detection.
- Merge fetched and rendered evidence.

Gate:

- Render improves field fill rate on JS fixtures.
- Render does not overwrite stronger deterministic/authority evidence.
- Blocked pages return explicit recovery states.
- Cost and latency metrics are emitted.

### Phase 4: AI missing-field assist

Deliverables:

- Add Workers AI JSON-mode wrapper.
- Add strict schema and response validation.
- Add no-evidence rejection.
- Trigger only for empty/conflicting fields in initial rollout.

Gate:

- AI proposals never save without evidence.
- AI false-fill rate in QA sample is below an agreed threshold.
- Cost estimates remain within budget at projected traffic.

### Phase 5: AI sanity check

Deliverables:

- Add citation sanity-check endpoint or internal function.
- Emit review warnings only.
- Add style/source-type mismatch checks.

Gate:

- Sanity check catches known wrong-source-type fixtures.
- False warning rate is acceptable in human QA.
- User can dismiss or resolve warnings.

### Phase 6: Blocked-source UX and extension handoff

Deliverables:

- Add blocked state UI and recovery actions.
- Connect extension capture as recommended path.
- Add paste-text citation flow if not already present.

Gate:

- Blocked pages do not loop retries.
- User has at least two clear recovery options.
- Extension handoff preserves CSL and provenance.

### Phase 7: Claim checking beta

Deliverables:

- Opt-in claim checker for saved sources.
- Evidence snippets required.
- Strict classifications.
- Cost/rate limits.

Gate:

- No claim classification without source evidence.
- Clear "not enough evidence" state.
- No claims or source text stored in analytics.

## Key Risks

1. **False confidence from AI.**
   Mitigation: evidence snippets, schema validation, no-evidence rejection, and
   warnings-only sanity checks.

2. **Warning fatigue.**
   Mitigation: conservative severities, style-aware copy, and user actions that
   resolve warnings.

3. **Render latency.**
   Mitigation: fast fetch first, progressive enrichment, host-level render
   success tracking.

4. **Blocked-site arms race.**
   Mitigation: do not participate in stealth evasion; use extension and paste
   recovery paths.

5. **Analytics schema drift.**
   Mitigation: document positional Analytics Engine columns before adding new
   events.

6. **Provider pricing drift.**
   Mitigation: route through Gateway, keep model choice configurable, refresh
   pricing before launch.

7. **Authority data mismatch.**
   Mitigation: retain conflicts and warn when DOI/ISBN authority data appears to
   refer to a different work.

## Open Decisions

1. Should rendered enrichment be synchronous in `/api/cite-website` at first, or
   should it be a separate enrichment request from day one?
2. Should `_provenance` be stored in localStorage with sources, or only used
   during creation and warning display?
3. What is the acceptable false-warning rate for launch?
4. What traffic threshold justifies AI Gateway dynamic routing instead of a
   direct Workers AI call?
5. Should "confirm no listed author" be stored as user provenance to suppress
   future warnings?
6. Which exact Gemini model should be benchmarked once pricing and Gateway model
   availability are refreshed?

## Recommended Immediate Implementation Order

1. Implement provenance without AI or Browser Run.
2. Implement quality warnings using provenance and existing tests.
3. Add Browser Run rendered acquisition behind an explicit query parameter.
4. Build a live eval script and host-level dashboard.
5. Add AI missing-field assist behind a feature flag.
6. Add user-facing progressive enrichment and blocked-source recovery UI.
7. Add AI sanity check after the warning system has enough deterministic rules
   to judge the model's usefulness.

This order avoids the main trap: adding AI before the system can prove where
fields came from. Provenance is the control plane for everything else.

## Sources Reviewed

- Cloudflare Browser Run pricing:
  https://developers.cloudflare.com/browser-run/pricing/
- Cloudflare Browser Run `/json` endpoint:
  https://developers.cloudflare.com/browser-run/quick-actions/json-endpoint/
- Cloudflare Workers AI pricing:
  https://developers.cloudflare.com/workers-ai/platform/pricing/
- Cloudflare Workers AI JSON mode:
  https://developers.cloudflare.com/workers-ai/features/json-mode/
- Cloudflare AI Gateway pricing:
  https://developers.cloudflare.com/ai-gateway/reference/pricing/
- Cloudflare AI Gateway get started/providers:
  https://developers.cloudflare.com/ai-gateway/get-started/
- OpenAI pricing:
  https://platform.openai.com/docs/pricing
- Anthropic pricing:
  https://docs.anthropic.com/en/docs/about-claude/pricing
- Gemini API pricing:
  https://ai.google.dev/gemini-api/docs/pricing
