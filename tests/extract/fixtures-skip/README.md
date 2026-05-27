Skipped extraction fixtures

These fixtures live outside `tests/extract/fixtures/` so `extract.test.ts` does
not auto-pick them up. Each subdirectory documents a real-world page the
current pipeline does not handle correctly.

platformer-post
  URL: https://www.platformer.news/boris-cherny-interview-ai-jobs/
  Issue: The page's `<script type="application/ld+json">` blob contains
  HTML-encoded entities (`&#x27;`) inside JSON string values. HTML5 treats the
  contents of `<script>` as raw text, so cheerio's `.contents().text()` does
  not decode the entities before `JSON.parse`. The resulting title is
  `Claude Code&#x27;s creator on the end of the software engineer` instead of
  `Claude Code's creator on the end of the software engineer`.
  The OG meta on the same page (`og:title`) carries the same string but, being
  an attribute, IS decoded by cheerio — however JSON-LD has higher confidence
  (0.95 vs 0.75), so the buggy value wins.
  Fix candidates: (a) entity-decode script text before JSON.parse in
  `functions/lib/extract/signals/jsonld.ts`, or (b) detect mojibake in the
  result and demote confidence. Track separately.
