# Google Books fixtures — SYNTHETIC (acceptable)

The five `.json` files in this directory were **synthesized** from the Google
Books API's documented `volumes` response schema, not captured from live API
calls. At the time of vendoring (Task C3, commit `70283b4`), the unauthenticated
Google Books API returned HTTP 429 "Quota exceeded" for the default consumer
project, and that quota remains exhausted on this IP as of 2026-05-27.

## Why this is acceptable

The Google Books path in `functions/api/cite-book/handler.ts` is **only a
fallback** — Open Library is tried first, and Google Books is hit only when
Open Library returns no data for an ISBN. In that rare path, what the tests
verify is:

1. `fetchGoogleBooks` parses the documented `items[0].volumeInfo` shape.
2. `normalizeGoogleBooks` maps that shape onto CSL-JSON correctly.

Both of those are covered by the synthetic fixtures, which follow the
documented schema. The wire-format quirks that a real-response fixture might
surface (field ordering, encoding edge cases) don't affect those two
correctness properties — `JSON.parse` doesn't care about field order, and the
normalize function reads named fields.

## When you'd still want real fixtures

If we ever change normalization to depend on signals only present in real
responses (e.g., a heuristic that uses `industryIdentifiers` ordering, or an
encoding workaround), re-vendor:

```bash
# Use a Google Books API key from Google Cloud Console (free tier; per-key quota)
for isbn in 9780062315007 9780140449136 9780262032933 9780553418811 9781400079988; do
  curl -fsSL "https://www.googleapis.com/books/v1/volumes?q=isbn:$isbn&key=$KEY" \
    > tests/book/fixtures/googlebooks/$isbn.json
done
```

Until that's the case, the synthetic fixtures are the right level of
fidelity for what we're testing.
