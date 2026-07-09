# Social-media citation matrix

How the generator renders the four supported social/video platforms across the
seven citation styles, and the authority each cell is grounded in. Every cell
below is pinned to a golden fixture in `tests/format/fixtures/webpage-social-*`
and re-derived at render time by `functions/lib/format/social-adapt.ts` from the
extracted CSL item (`custom.social`).

The verification behind this table: each of the 28 cells was checked against its
style's official source by an independent researcher **and** an adversarial
verifier (2026-07). MLA, APA, Chicago, and Harvard publish social-media formats;
Vancouver, IEEE (posts), and AMA (posts) do not, so those cells use a
documented generic-web fallback rather than an invented format.

| Style | TikTok | X / Twitter | YouTube | Instagram | Authority |
|-------|--------|-------------|---------|-----------|-----------|
| **MLA 9** | ✅ official | ✅ official | ✅ official | ✅ official | MLA Style Center (dedicated posts per platform) |
| **APA 7** | ✅ official | ✅ official | ✅ official | ✅ official | apastyle.apa.org platform reference pages |
| **Chicago 18** (author-date) | ✅ official | ✅ official | ✅ official | ✅ official | CMOS 18 §14.105–106 + citation quick guide |
| **Harvard** (Cite Them Right 13) | ✅ official | ✅ official | ✅ official (video) | ✅ official | Cite Them Right 13; CTR-following library guides |
| **Vancouver** | ⚠︎ fallback | ⚠︎ fallback | ⚠︎ fallback | ⚠︎ fallback | NLM Citing Medicine — no social format; Web-Sites form |
| **IEEE** | ⚠︎ fallback | ⚠︎ fallback | ✅ official (video) | ⚠︎ fallback | IEEE Reference Guide — online-video for YouTube; no post format |
| **AMA 11** | ⚠︎ fallback | ⚠︎ fallback | ✅ official (video) | ⚠︎ fallback | AMA 11 §3.15 — no consistent post format |

✅ = matches the style's official published format for that platform.
⚠︎ = the style publishes **no** format for this platform; the cell uses a clean,
documented generic-web/online-source fallback (the honest option — see below).

## Per-style conventions applied by the adapter

- **MLA 9** — `Name [@handle]. "caption verbatim." Platform, D Mon. Year, url.`
  Caption reproduced as written (a `nocase` wrapper defeats title-casing);
  handle bracket only when name ≠ handle; URL without the protocol
  (Handbook §5.95). YouTube keeps standard title-case (it is a titled work).
- **APA 7** — `Family, I. [@handle]. (Year, Month D). Caption (first 20 words,
  italic) [Video|Photograph|Post]. Platform. url` — descriptor by kind, X = Post.
- **Chicago 18 author-date** — `Name (@handle). Year. "caption verbatim."
  Platform, Month D. url.` Handle in **parentheses** (not brackets); caption
  verbatim; X posts before July 2023 render `Twitter (now X)`. YouTube uses the
  generic author-date video form (correct as-is).
- **Harvard / CTR 13** — posts: `Family, I. [@handle] (Year) 'caption'
  [Platform] D Month. Available at: url (Accessed: date).` The bracketed handle
  is for **person** names; organisations use the plain account name. YouTube
  (video): `Channel (Year) *Title*. D Month. Available at: url (Accessed: date).`
- **IEEE** — YouTube routes to the official online-video template (`Creator.
  Title. (date). Accessed: … [Online Video]. Available: url`). Posts have no
  IEEE format → generic online-source fallback.
- **Vancouver / AMA** — no social format; generic Web-Sites / web fallback with
  the caption as the title and the platform as the publisher.

## Why the fallbacks are the honest answer

Vancouver (NLM Citing Medicine), IEEE (for posts), and AMA (for posts) have not
published social-media citation formats in their current editions. Rather than
invent a format and present it as authoritative, the generator emits each
style's standard generic-web/online-source citation, reshaped so the post's own
caption is the title and the platform is the publisher. If a future edition adds
a real social format, the corresponding adapter branch supersedes the fallback.

Known fallback imperfections (documented, not bugs): Vancouver renders the
posting date at year precision (its generic webpage behavior, permitted by NLM
— month/day are optional) and uses the `[Internet]` medium designator rather
than NLM's `[video on the Internet]`.

## Cells that sit within legitimate interpretive range

Three full adversarial verification rounds (each: an independent researcher +
an adversarial verifier per cell, against the official source) converged on the
table above. A few cells are grounded in a deliberate, defensible choice rather
than a single unambiguous answer, because the authorities themselves disagree
or the data isn't available:

- **Harvard / TikTok–X–Instagram — the `[@handle]` bracket after a person's
  name.** Cite Them Right-following university guides split on this: Newcastle's
  CTR FAQ and the University of the West of Scotland guide **bracket** the handle
  (`Holthaus, E. [@EricHolthaus]`); UCL's guide **omits** it (`Matafeo, R.
  (2021)`). The generator brackets it — it preserves the account identity,
  parallels the APA/MLA/Chicago handle conventions, and matches these guides'
  own worked examples. A reader following a bracket-omitting interpretation can
  drop it in the editor.
- **Chicago / YouTube — the fuller online-video form.** CMOS 18's audiovisual
  example includes the running time and a "Posted [date]" phrase
  (`YouTube video, 0:19. Posted April 23, 2005.`). The generator does not
  extract video duration, so it renders the well-formed generic author-date web
  form instead; the guide page for YouTube documents the fuller CMOS form by
  hand.
- **IEEE / YouTube — creator punctuation.** IEEE's online-video template is
  "Creator, Location. Title." With no location, the creator is followed by the
  comma reserved for that slot (`jawed, Me at the Zoo.`); the alternative reads
  the empty location as collapsing to a period. Both are defensible; the
  generator keeps the comma (its standard author separator, shared with every
  other IEEE type).

Everything else in the matrix is pinned to a golden fixture in
`tests/format/fixtures/webpage-social-*` and re-derived from the extracted CSL
at render time, so it cannot drift from what the tool produces.

## Re-verification (2026-07)

The full 4×7 matrix was re-verified against the official sources by an
adversarial workflow (one independent researcher per style + a skeptical
refuter on every flagged cell). **All 28 base cells were confirmed correct or a
documented defensible fallback** — no base-matrix errors. The three interpretive
cells above (Harvard `[@handle]`, Chicago/YouTube duration, IEEE/YouTube comma)
were re-confirmed as deliberate, defensible choices.

Edge-case golden coverage was added (`tests/format/fixtures/webpage-social-*`):
handle-only author, single photo (`[Photograph]`), no-date post, emoji/CJK
caption over APA's 20-word cut, and a no-author post. Verified findings:

- **Handle-only accounts** (no real name, e.g. `@zachking`) render the username
  in the author slot across all styles. MLA's own rule is to *omit* a handle
  that duplicates the author name, so a leading `@` with no bracketed repeat is
  correct; the other styles follow suit. Defensible.
- **Name identical to handle** (e.g. an account named "NASA" posting as
  `@NASA`): the adapter omits the `[@handle]` bracket when the display name and
  handle are the same string. This is explicitly correct for **MLA** ("do not
  repeat the username if it is the same as the name") and sits in the same
  repeat-the-handle interpretive range as the Harvard cell for **APA/Chicago**
  (Chicago always shows the bracket; APA arguably retains it). Deferred to the
  product owner rather than "fixed" blindly. The edge fixture uses a distinct
  name and handle so it does not conflate this with the caption tests.
- **No-date posts** render each style's dateless form correctly: MLA adds an
  access date, APA `(n.d.)` + `Retrieved … from`, Chicago `n.d.` + access date,
  Harvard `(no date)`, AMA drops the `Posted` date. A no-date X post defaults to
  Chicago's `Twitter (now X)` label (the `isBeforeXRename` fallback assumes
  pre-rename when no date is available — conservative, since the true post date
  is unknown).
- **No-author posts** (rare in practice — a detected social URL almost always
  yields at least the @handle, which becomes the author): MLA, IEEE, AMA, and
  Vancouver render correctly (title-first; AMA uses the @handle). **Known
  imperfections**, from CSL's generic no-author handling (the title moves into
  the author slot): APA floats the `[Photograph]` descriptor after the date
  instead of adjoining the title, and Harvard places `(year)` after the medium.
  These are the same for any no-author webpage, not social-specific; not fixed
  here to avoid CSL surgery affecting the whole 600-fixture corpus.

## Live extraction reliability (2026-07)

Formatting is only half the job — the citation is only correct if the *facts*
are extracted correctly. Cloudflare's datacenter egress is bot-walled or
rate-limited by every one of these platforms, so the extraction path is hardened
to either produce a correct citation end-to-end or **fail honestly** (never a
plausible-looking wrong citation):

| Platform | Production extraction | Date source | If it can't be read |
|----------|----------------------|-------------|---------------------|
| **TikTok** | oEmbed (`tiktok.com/oembed`) → caption + creator, egress-independent | posting date recovered from the **video-ID timestamp bits** (no fetch needed) | honest-failure flag |
| **X / Twitter** | server fetch of the post page → tweet text + author; **handle recovered from the URL** so the citation renders in proper `[Post]` form. The syndication API (`cdn.syndication.twimg.com/tweet-result`) is tried first for the exact `created_at` date but **X blocks Cloudflare's datacenter egress** (200 from a normal host, empty from CF), so it usually only supplies the date when reachable | syndication `created_at` when reachable, else the page's og/JSON date | a walled page with only chrome ("jack on X") drops its title → honest-failure flag; deleted posts return a **TweetTombstone** |
| **YouTube** | oEmbed → title + channel; `ytInitialData` parsed from the page for the date; render is triggered even on a 429 | microdata `datePublished`, else `ytInitialData` `publishDate` | honest-failure flag |
| **Instagram** | og-string parse when the page is readable | og-string date | **no keyless path** — Instagram's oEmbed needs a Meta app token, so a bot-walled Instagram fails honestly |

**URL-handle recovery.** X and TikTok carry the account handle in the URL path
(`x.com/<handle>/status/…`, `tiktok.com/@<handle>/video/…`). When the page fetch
yields real content (a caption/tweet that survives the chrome check) but no
platform metadata was reachable — X's syndication CDN blocks Cloudflare egress, a
page can render without its hydration blob — the handle is recovered straight
from the URL and the post is shaped into the correct per-style social format,
with the platform name normalized to its canonical form ("X", not the
og:site_name "X (formerly Twitter)"). This is what keeps X citations in proper
`[Post]` form in production despite the syndication block. YouTube (`/watch`) and
Instagram (`/p/`) carry a video id / shortcode rather than the account, so they
have no URL-handle fallback and rely on oEmbed or fail honestly.

**Honest-failure guarantee.** When a recognized social/video URL yields no
platform metadata (`custom.social` absent after every rescue *and* no handle
recoverable from a real-content page), the page's chrome title ("Phillip Cook on
TikTok", "- YouTube", "jack on X") is dropped and an **error-severity
`social_unresolved`** warning is raised, pointing the user at the browser
extension or manual entry. The tool never emits a citation that looks finished
but is wrong. The warning clears once the user supplies a real title.

**Residual limitations:**

- **Instagram** has no keyless server-side extraction path (Graph oEmbed
  requires a Meta app token). A bot-walled Instagram post fails honestly; the
  browser extension or manual entry is the reliable route.
- **YouTube** date depends on the page being fetched or rendered. If Cloudflare
  is hard-rate-limited (429) *and* rendering is unavailable, only the oEmbed
  title + channel survive and the citation carries the style's no-date fallback
  (flagged `date_not_found`) rather than a wrong date.
- The `publish.twitter.com/oembed` endpoint the code previously used is **dead**
  (it 301s to `publish.x.com`, which serves an HTML error page); it was replaced
  by the syndication API, which also detects deleted posts.
