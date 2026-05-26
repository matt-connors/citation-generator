# Google Books fixtures — SYNTHETIC (pending re-vendor)

The five `.json` files in this directory were **synthesized** from the Google
Books API's documented `volumes` response schema, not captured from live API
calls. At the time of vendoring (Task C3, commit `70283b4`), the unauthenticated
Google Books API returned HTTP 429 "Quota exceeded" for the default consumer
project — daily quota was hit across the whole project, not per-IP, so retries
didn't help.

## What this means for tests

The fixtures honor the documented shape:
- top-level `{ kind, totalItems, items: [...] }`
- each `items[i]` has `volumeInfo` with `title`, `subtitle?`, `authors[]`,
  `publisher`, `publishedDate`, `pageCount`, `industryIdentifiers[]`, `infoLink`.

The bibliographic content (title, authors, publisher) for each ISBN was sourced
from public catalogs to be realistic. But quirks specific to Google Books
(field nesting, date formats, missing fields, encoding) may differ from real
responses — so tests passing against these fixtures do NOT guarantee the
production code handles every real Google Books response correctly.

## Action item before Phase 1 merge

Re-vendor with real API responses. Two ways to do this:

1. Wait 24h for the project-wide quota to reset, then re-run the curl loop
   from Task C3:
   ```bash
   for isbn in 9780062315007 9780140449136 9780262032933 9780553418811 9781400079988; do
     curl -fsSL "https://www.googleapis.com/books/v1/volumes?q=isbn:$isbn" \
       > tests/book/fixtures/googlebooks/$isbn.json
   done
   ```

2. Get a Google Books API key from Google Cloud Console (free tier is generous;
   per-key quota is per-key, not per-project) and append `&key=$KEY` to each URL.

After re-vendoring, run `npm test -- tests/book/` to confirm the existing tests
still pass against the real responses, then delete this README.
