# QA & Reliability Brief — Social/Video Citation Support

**For:** a fresh working session picking this up with no prior context.
**Goal:** be *certain* the citation generator is accurate and reliable for
social/video sources across every supported style, and resolve the one known
production problem. Do not assume anything below is already fixed — verify it.

---

## 1. What this is

`mlagenerator.com` (repo `matt-connors/citation-generator`) is an Astro +
React + Cloudflare Pages/Functions app. A user pastes a URL / DOI / ISBN and
gets a formatted citation in one of seven styles. Recent work added first-class
support for social/video sources (TikTok, X/Twitter, YouTube, Instagram) and
fixed a large batch of how-to guides.

**Deploy state:** `main` is at `734bb68` and is **deployed to production**
(Cloudflare builds production from `main`). Dev branch:
`claude/citation-long-tail-seo-preview`. All 606 unit tests pass; build is clean.

**Supported styles (exactly one version each — this is a hard limitation):**
`mla-9`, `apa-7`, `chicago-18` (author-date only, NOT notes-bibliography),
`harvard` (Cite Them Right), `ieee`, `ama-11`, `vancouver`.
There is **no** MLA 8, APA 6, Chicago 17, Chicago notes, or other Harvard variants.

## 2. Architecture you must understand before touching anything

Pipeline for a pasted URL (`functions/api/cite-website/handler.ts`):
1. `fetchHtml(url)` → 2. `runExtractionPipeline` (`functions/lib/extract/pipeline.ts`)
runs signal extractors including the **platform signal**
(`functions/lib/extract/signals/platform.ts`, which parses TikTok's
`__UNIVERSAL_DATA_FOR_REHYDRATION__` blob, YouTube microdata, Instagram
og-strings) → 3. optional **Browser Run render** if the fetch looks partial →
4. **oEmbed rescue** (`functions/lib/extract/oembed.ts`) for X/TikTok/YouTube →
5. optional **AI field assist**. Social facts are stored on
`csl.custom.social = { platform, handle, displayName, kind }`.

Formatting (`functions/lib/format/citeproc.ts` → `citeproc` engine) applies a
render-time **style adapter** (`functions/lib/format/social-adapt.ts`) that
reshapes the CSL item per style (handle conventions, `[Video]` descriptors,
Chicago verbatim caption + `(@handle)`, Harvard `[Platform]` medium, IEEE
online-video routing, AMA §3.15.4, Vancouver Web-Sites fallback). The stored
CSL stays "honest"; the adapter only shapes at render time.

The seven-style example tables in the guides are rendered **at build time** by
the same engine (`src/components/astro/CitationExampleTable.astro`) from static
CSL data — they do NOT do a runtime fetch, so they are already correct in prod.

**Read `docs/citation-matrix.md` first.** It documents every platform×style
cell: which are verified-official, which are documented generic-web fallbacks
(Vancouver, and IEEE/AMA where no social format exists), and three cells that
rest on genuine source ambiguity (do not "fix" these blindly — see §6).

## 3. THE PRIMARY PROBLEM TO RESOLVE (production extraction bot-wall)

The **formatting** is correct and verified. The **live extraction** is degraded
in production because Cloudflare's datacenter egress gets blocked/altered HTML:

- **TikTok:** prod `fetch: partial`, `render: success`, but the platform signal
  never fires → no author/caption/date/`custom.social`; falls back to og:title
  ("Phillip Cook on TikTok"). Cause: the bot-walled fetch HTML lacks the
  `__UNIVERSAL_DATA_FOR_REHYDRATION__` blob, and the browser-rendered HTML is a
  *hydrated DOM* where the raw blob is gone. The extractor works perfectly on
  the HTML a normal browser/curl fetches (verified), just not on what Cloudflare
  gets.
- **X/Twitter:** prod `fetch: error — HTTP 404`; the oEmbed rescue
  (`publish.twitter.com/oembed`) is inconsistent — works for some tweet IDs,
  returns nothing for others.
- **YouTube / Instagram:** NOT yet checked in prod — verify them the same way.

This is **not a regression** (pre-change prod returned bare "TikTok" / nothing);
it is a pre-existing infrastructure limitation the new code partially mitigates.

**How to diagnose:** call the live API and inspect `_quality.acquisition`
(shows fetch/render/authority/ai status + reason) and `csl.custom.social`:
```
curl -sS "https://mlagenerator.com/api/cite-website?url=<ENCODED_URL>&nocache=1" | python3 -m json.tool
```
Compare the HTML Cloudflare receives vs. what a normal fetch gets (this repo's
`tests/extract/fixtures/tiktok-video/input.html` is a known-good capture; the
extractor produces correct output on it — prove that first with the probe in §5).

**Candidate fixes (pick and validate, don't guess):**
- Route the extraction fetch through a residential/unblocked proxy or a fetch
  service that isn't IP-blocked by TikTok/X.
- In the render path, parse the **hydrated DOM** (extract creator/caption/date
  from rendered elements) instead of relying on the raw JSON blob.
- Harden/repair the oEmbed rescue (verify TikTok + X + YouTube oEmbed from a
  Cloudflare-like egress; handle non-JSON/empty responses; confirm
  `shouldRunOembedAssist` fires when author is missing even if a title exists).
- Lean on the browser extension flow for logged-in/unblocked fetches.
- If none is feasible, make the tool **degrade honestly**: detect the platform,
  and surface a clear "couldn't read this TikTok automatically — paste the
  details or use the extension" state rather than a wrong-looking citation.

## 4. Full accuracy/reliability checklist (verify, don't trust)

1. **Unit + golden tests:** `npx vitest run` → expect 606 passing. The social
   golden fixtures are in `tests/format/fixtures/webpage-social-{tiktok,x,youtube,instagram}/`.
2. **Build:** `npm run build` → must be clean (runs the CSL embed prebuild).
3. **Formatting matrix:** re-confirm all 4 platforms × 7 styles against each
   style's official source. The prior approach: an adversarial workflow (one
   researcher + one skeptical verifier per cell) fetching MLA Style Center, APA
   Style pages, CMOS 18 quick guide, Cite Them Right library guides, the IEEE
   Reference Guide, AMA 11 §3.15, NLM Citing Medicine. Cross-check any verdict
   that contradicts `docs/citation-matrix.md` before acting — verifiers showed
   run-to-run disagreement on the ambiguous cells.
4. **Production extraction (the real gap):** for each of TikTok, X, YouTube,
   Instagram, hit the live API and confirm the returned CSL is correct AND the
   rendered citation (call `/api/format` or check `/my-references`) matches the
   guide table for that platform.
5. **Edge-case inputs NOT yet golden-tested — add coverage:** handle-only
   account (no real name), no-author, no-date, deleted/unavailable, multi-image
   carousel, Instagram photo-vs-video kind detection, emoji/non-Latin captions,
   very long captions (APA 20-word cut), threads, YouTube video with a duration.
6. **Style versions:** confirm with the product owner whether one-version-each
   is acceptable, or whether MLA 8 / APA 6 / Chicago notes need adding (each is
   a new CSL style + adapter work + fixtures).
7. **No regressions:** book (ISBN) and journal (DOI) paths, and the non-social
   webpage/news/blog citations, must still be correct (the IEEE webpage
   punctuation change touched all webpage IEEE goldens — spot-check a news URL).

## 5. Commands & gotchas

- **Probe the extractor on real HTML** (proves extraction logic independent of
  prod fetch): see `functions/lib/extract/pipeline.ts` `runExtractionPipeline`;
  feed it a freshly-fetched TikTok/YouTube/etc. HTML string and inspect the CSL.
- **CSL edits require re-embedding:** after editing any
  `functions/lib/format/styles/*.csl`, run `node scripts/embed-csl.mjs` or the
  runtime/build won't see it (tests read the `.csl` directly, but the build and
  `/api/format` use the base64-embedded `.ts`).
- **Regenerate golden fixtures:** delete the target `<fixture>/<style>.txt` and
  run `npx tsx scripts/seed-format-fixtures.ts` (it only writes missing files).
- **Curly quotes are correct** in rendered citations (" " ' '); straight quotes
  in a golden/verifier string are usually just a transcription artifact, not a
  defect. Normalize before comparing.
- **OG images regenerate non-deterministically** — don't commit churn from
  `scripts/gen-og-images.mjs`.

## 6. Do NOT "fix" these — they are documented judgment calls (see matrix doc)

- **Harvard `[@handle]` bracket after a person's name:** CTR-following
  university guides genuinely disagree (Newcastle/UWS bracket it; UCL omits it).
  The engine brackets it deliberately. Changing it will just make a different
  verifier flag the opposite. Confirm the product owner's preference; otherwise
  leave as documented.
- **Chicago/YouTube** lacks the CMOS audiovisual duration form because the tool
  doesn't extract video duration — a data limitation, not a format bug.
- **IEEE/YouTube** creator comma (`jawed,`) is IEEE's creator-location separator
  with an empty location; defensible.

## 7. Definition of done

- Every platform×style cell is either verified-correct against the official
  source or a documented fallback — with the state re-confirmed, not assumed.
- Live production extraction for TikTok/X/YouTube/Instagram either produces a
  correct citation end-to-end, or fails **honestly** (clear user guidance),
  never a plausible-looking wrong one.
- Edge-case inputs have golden coverage.
- 606+ tests pass; build clean; no regressions in book/journal/webpage paths.
- Any residual limitation is written into `docs/citation-matrix.md`.
