# Citation Reliability Runtime

This project can run the AI-assisted citation reliability pipeline without
rendering, but AI assist and rendered acquisition only activate when their
server-side Cloudflare bindings are configured.

The implementation intentionally follows the existing Pages-dashboard setup
instead of adding a `wrangler.toml`; see `docs/analytics.md` for the same
deployment rationale.

## Cloudflare Bindings

Add these under the Cloudflare Pages project settings:

| Binding | Type | Purpose |
| --- | --- | --- |
| `AI` | Workers AI | Enables evidence-bounded missing-field extraction. This is the preferred default. |
| `BROWSER_RENDERER` | Service binding | Optional. Calls the separate Browser Run Worker in `workers/browser-renderer`. |
| `ANALYTICS` | Analytics Engine | Already supported; records acquisition and citation telemetry. |

If `BROWSER_RENDERER` is absent, `/api/cite-website` still uses normal fetch and
returns quality warnings that can ask the user to try the extension or manual
entry. If `AI` is absent, citation generation and deterministic warnings still
work.

Cloudflare Pages currently exposes Service bindings in the dashboard list, but
not a direct Browser Run binding. Use the included Worker instead:

1. Deploy `workers/browser-renderer` as `mla-browser-renderer`.
2. The Worker owns the direct Browser Run binding named `BROWSER`.
3. Add a Pages Service binding named `BROWSER_RENDERER` pointing at
   `mla-browser-renderer`.
4. If the renderer Worker has a public route or workers.dev enabled, set the
   same secret value as `RENDERER_SHARED_SECRET` on the Worker and
   `BROWSER_RENDERER_TOKEN` on the Pages project.

Browser Run `.quickAction()` requires a compatibility date of `2026-03-24` or
newer in the deployed Worker. Local testing of Browser Run needs Workers remote
mode; normal local Pages previews should be treated as fetch-only unless the
service binding is explicitly available.

The render stage is for ordinary JavaScript-rendered pages, not stealth bot
evasion. It sets a clear MLA Generator user agent and reports blocked/partial
states back to the user when a site denies automated access.

## Optional AI Gateway

Workers AI can be used directly through the `AI` binding. To route calls through
AI Gateway instead, leave `AI` unset and configure:

| Variable | Purpose |
| --- | --- |
| `AI_GATEWAY_CHAT_URL` | Full Gateway chat-completions URL. Example: `https://api.cloudflare.com/client/v4/accounts/<account>/ai/v1/chat/completions`. |
| `AI_GATEWAY_TOKEN` | Cloudflare token or provider token required by the Gateway endpoint. |
| `AI_GATEWAY_ID` | Optional `cf-aig-gateway-id` header value. |
| `AI_GATEWAY_MODEL` | Model name sent in the Gateway payload, for example `openai/gpt-5.4-nano`. |

`AI_CITATION_MODEL` overrides `AI_GATEWAY_MODEL` and the Workers AI default for
the citation pipeline.

## Runtime Behavior

`/api/cite-website` is intentionally server-policy driven. Public clients can
only submit a URL; they cannot force render, force fetch-only, force AI, or
bypass cache.

Server policy:

- Fetch first.
- Render only when concrete page signals indicate incomplete or blocked static
  content and `BROWSER_RENDERER` is configured.
- Run AI assist only when the `AI` binding or Gateway is available and the
  extracted citation is missing useful fields.
- Cache successful website citations under the current pipeline cache version.

Environment controls:

| Variable | Default | Purpose |
| --- | --- | --- |
| `CITATION_RENDERING_ENABLED` | enabled | Set to `0` to disable rendered acquisition without removing the binding. |
| `CITATION_AI_ASSIST_ENABLED` | enabled | Set to `0` to disable AI missing-field assist. |
| `CITATION_AI_CHECK_ENABLED` | disabled | Set to `1` to allow `/api/quality/check` to run AI sanity checks. |
| `CITATION_INTERNAL_DEBUG_TOKEN` | unset | Optional secret for internal eval/debug overrides. |
| `BROWSER_RENDERER_TOKEN` | unset | Optional shared secret sent to the renderer Worker. |

When `CITATION_INTERNAL_DEBUG_TOKEN` is set, internal callers can send
`x-mla-internal-token: <token>` to allow eval-only `acquisition` and `nocache`
query overrides. Do not expose this token to browsers.

Every successful response can include:

- `_provenance`: field-level winning evidence, candidates, and conflicts.
- `_quality`: conservative warnings and acquisition attempts.

Old clients can ignore both fields. The React reference UI stores and displays
them when present.

## Manual Eval

Run a preview server first, then:

```bash
npm run eval:citation-acquisition -- --base-url http://localhost:8788
```

Use a custom sample:

```bash
npm run eval:citation-acquisition -- --base-url https://preview.example.pages.dev --sample path/to/urls.json
```

To bypass cache or force an acquisition mode during an internal eval, provide
the secret token:

```bash
npm run eval:citation-acquisition -- --base-url https://preview.example.pages.dev --internal-token <token>
```

The eval output includes success count, average latency, field counts, warning
rate, render usage, AI usage, and per-URL acquisition states.

## Repeatable Smoke Tests

The citation smoke matrix lives in `tests/e2e/pipeline.test.ts`. It exercises
the full local path from HTML to CSL extraction, conservative quality warnings,
and formatted bibliography output in every supported style:

- MLA 9
- APA 7
- Chicago 18 author-date
- AMA 11
- Cite Them Right 12th edition Harvard
- IEEE
- NLM/Vancouver

The matrix includes real saved-page fixtures for scholarly articles, large
author lists, news sites, government pages, blogs, Wikipedia, and bare HTML, plus
synthetic edge cases for DOI-only early-view journal articles, conflicting news
metadata, and corporate-author/no-date government pages.

Style baselines checked during the smoke review:

- MLA: `https://style.mla.org/works-cited/citations-by-format/`
- APA: `https://apastyle.apa.org/instructional-aids/reference-examples.pdf`
- Chicago: `https://www.chicagomanualofstyle.org/tools_citationguide.html`
- AMA: `https://www.amamanualofstyle.com/view/10.1093/jama/9780190246556.001.0001/med-9780190246556-chapter-3-div1-50`
- Cite Them Right Harvard: `https://university.open.ac.uk/library/referencing-and-plagiarism/quick-guide-to-harvard-referencing-cite-them-right`
- IEEE: `https://journals.ieeeauthorcenter.ieee.org/your-role-in-article-production/ieee-editorial-style-manual/`
- NLM/Vancouver: `https://www.nlm.nih.gov/bsd/uniform_requirements.html`

For exact formatter regression coverage, run `tests/format/format.test.ts`.
That corpus compares every source-type fixture against golden output in every
supported style. The e2e smoke matrix complements it by proving extracted data
keeps the required style-specific locators and author/title/source structure.
