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
posting date at year precision (its generic webpage behavior) and uses the
`[Internet]` medium designator rather than NLM's `[video on the Internet]`; IEEE
posts use IEEE's quoted-title-plus-comma convention shared with all web sources.
