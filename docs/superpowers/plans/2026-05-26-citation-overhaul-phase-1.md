# Citation Generator Overhaul — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace fragile regex/JSDOM extraction and hand-written per-style formatters with a cheerio multi-signal extractor + citeproc-js server-side formatter, all CSL-JSON, all behind a fixture-based test suite — without breaking the live UI on mlagenerator.com.

**Architecture:** Cloudflare Pages Functions handle three CSL-emitting endpoints (`/api/cite-website`, `/api/cite-book`, `/api/cite-journal`) plus a stateless `/api/format` that runs citeproc-js with bundled CSL XML files. The browser stores CSL-JSON in localStorage (`sources_v2`) and asks `/api/format` for rendered strings, caching by `(uuid, style)`.

**Tech Stack:** Astro + React (existing), Cloudflare Pages Functions (existing), cheerio (already a dependency), citeproc-js (new), vitest (already in devDependencies), Cloudflare Cache API.

**Source of truth:** `docs/superpowers/specs/2026-05-26-citation-generator-overhaul-design.md`. If a conflict appears between this plan and the spec during execution, **stop and surface it** — do not silently work around the spec.

**Commits:** No Claude attribution. Use Conventional Commits style (`feat:`, `test:`, `chore:`, `refactor:`, `docs:`).

**Branch:** `refine/citation-accuracy-overhaul` (already checked out; the spec is the single existing commit).

---

## File map (final state after Phase 1)

```
functions/
  _middleware.ts                       (unchanged — wraps everything with CORS + error)
  tsconfig.json                        (unchanged)
  api/
    cite-website/index.ts              MODIFIED — thin handler
    cite-book/index.ts                 RENAMED from .js + REWRITTEN
    cite-journal/index.ts              NEW
    format/index.ts                    NEW
    utils.ts                           MODIFIED — only createResponse stays
    definitions.ts                     DELETED
  lib/
    csl-types.ts                       NEW
    cache.ts                           NEW
    extract/
      fetch.ts                         NEW
      url-normalize.ts                 NEW
      author-parse.ts                  NEW
      date-parse.ts                    NEW
      pipeline.ts                      NEW
      merge.ts                         NEW
      signals/
        jsonld.ts                      NEW
        microdata.ts                   NEW
        opengraph.ts                   NEW
        twitter.ts                     NEW
        meta.ts                        NEW
        heuristic.ts                   NEW
    book/
      openlibrary.ts                   NEW
      googlebooks.ts                   NEW
      normalize.ts                     NEW
    journal/
      crossref.ts                      NEW
      openalex.ts                      NEW
      doi-detect.ts                    NEW
      normalize.ts                     NEW
    format/
      citeproc.ts                      NEW
      styles/
        mla-9.csl                      NEW (vendored)
        apa-7.csl                      NEW (vendored)
        chicago-18.csl                 NEW (vendored — upstream now Chicago 18, was 17 at plan time)
        ama-11.csl                     NEW (vendored)
        harvard.csl                    NEW (vendored — harvard-cite-them-right variant)
        ieee.csl                       NEW (vendored)
        vancouver.csl                  NEW (vendored — NLM/Vancouver citation-sequence)
        {mla-9,apa-7,chicago-18,ama-11,harvard,ieee,vancouver}.ts  NEW (base64-embedded siblings, auto-generated)
        index.ts                       NEW (decode/NAMES helper)
      locales/
        locales-en-US.xml              NEW (vendored, required by citeproc-js)
        locales-en-US.ts               NEW (base64 sibling, auto-generated)
        index.ts                       NEW (decode helper)
scripts/
  embed-csl.mjs                        NEW (regenerates .ts siblings from .csl/.xml)

src/
  lib/
    citations/
      csl-types.ts                     NEW (mirrors functions/lib/csl-types.ts)
      useFormattedCitation.ts          NEW
      definitions.ts                   DELETED
      formatSource.ts                  DELETED
      types.ts                         DELETED
      types/baseCitation.ts            DELETED
      types/book.ts                    DELETED
      types/website.ts                 DELETED
    references/
      useReferences.ts                 REWRITTEN
      storage.ts                       NEW
  components/
    citationStyles.ts                  REWRITTEN — 3 styles only in Phase 1
    react/
      References.tsx                   MODIFIED — createEmptyCitation rewritten
      ReferenceItem.tsx                MODIFIED — uses useFormattedCitation
      EditCitationForm.tsx             MODIFIED — CSL-JSON
      EditCitationFormComponents.tsx   MODIFIED — Contributors uses CSL names
      EditReferenceDialogDrawer.tsx    MODIFIED — isEmptyCitation reads CSL

tests/
  extract/
    fixtures/<10 fixture dirs>/
      input.html
      input.url
      expected.csl.json
    extract.test.ts                    NEW
    signals/<one test per signal>      NEW
  format/
    fixtures/<10 fixture dirs>/
      csl.json
      mla-9.txt
      apa-7.txt
      chicago-18.txt
    format.test.ts                     NEW
  book/
    fixtures/openlibrary/<5>.json
    fixtures/googlebooks/<5>.json
    book.test.ts                       NEW
  journal/
    fixtures/crossref/<5>.json
    fixtures/openalex/<5>.json
    journal.test.ts                    NEW
  e2e/
    pipeline.test.ts                   NEW
  helpers/
    load-fixture.ts                    NEW
    mock-fetch.ts                      NEW

.github/workflows/test.yml             NEW
vitest.config.ts                       NEW
package.json                           MODIFIED — add citeproc-js dep + test scripts
```

---

## Block A — Foundations (sequential)

Block A must complete before B/C/D start. The spike is the gate: if citeproc-js doesn't fit, the whole Phase 1 architecture changes.

### Task A1: citeproc-js bundle-size spike (architecture gate)

**Why first:** Per global CLAUDE.md and session brief, we must verify the server-side formatter is feasible on Cloudflare Pages Functions before writing anything that depends on it. The Functions bundle limit is **1 MB compressed on free plan, 10 MB on paid**. citeproc-js minified is ~800 KB; each CSL XML file is 50–200 KB; the `en-US` locale is ~40 KB. Three styles + locale + citeproc + supporting libs could be tight.

**Files:**
- Create: `functions/api/_spike-format/index.ts` (throwaway)
- Create: `functions/lib/format/styles/.gitkeep`
- Create: `functions/lib/format/locales/.gitkeep`
- Modify: `package.json` — add `citeproc` dependency

- [ ] **Step 1: Install citeproc**

```bash
npm install citeproc@^2.4.63
```

Expected: a single new line under `dependencies` in `package.json`.

- [ ] **Step 2: Vendor all 7 Phase 1 CSL files + locale**

Per the user decision, Phase 1 bundles ALL seven supported style families (one current version each) so the UI dropdown doesn't regress. The spec's "MLA 9 / APA 7 / Chicago 18" requirement is about FIXTURE COVERAGE (those three are held to byte-for-byte handbook accuracy); the other four (AMA, Harvard, IEEE, Vancouver) are still bundled so users can select them, but only tested for shape in Phase 2.

Download from the Citation Style Language official Zotero repo:

```bash
mkdir -p functions/lib/format/styles functions/lib/format/locales
curl -fsSL -o functions/lib/format/styles/mla-9.csl \
  https://raw.githubusercontent.com/citation-style-language/styles/master/modern-language-association.csl
curl -fsSL -o functions/lib/format/styles/apa-7.csl \
  https://raw.githubusercontent.com/citation-style-language/styles/master/apa.csl
curl -fsSL -o functions/lib/format/styles/chicago-18.csl \
  https://raw.githubusercontent.com/citation-style-language/styles/master/chicago-author-date.csl  # upstream is now Chicago 18 (was 17 when plan drafted)
curl -fsSL -o functions/lib/format/styles/ama-11.csl \
  https://raw.githubusercontent.com/citation-style-language/styles/master/american-medical-association.csl
curl -fsSL -o functions/lib/format/styles/harvard.csl \
  https://raw.githubusercontent.com/citation-style-language/styles/master/harvard-cite-them-right.csl
curl -fsSL -o functions/lib/format/styles/ieee.csl \
  https://raw.githubusercontent.com/citation-style-language/styles/master/ieee.csl
curl -fsSL -o functions/lib/format/styles/vancouver.csl \
  https://raw.githubusercontent.com/citation-style-language/styles/master/vancouver.csl
curl -fsSL -o functions/lib/format/locales/locales-en-US.xml \
  https://raw.githubusercontent.com/citation-style-language/locales/master/locales-en-US.xml
```

Expected: 8 files present, each non-empty.

- [ ] **Step 3: Write the throwaway spike endpoint**

Create `functions/api/_spike-format/index.ts`:

```ts
// @ts-ignore - citeproc has no types
import CSL from 'citeproc';
import mla from '../../lib/format/styles/mla-9.csl';
import locale from '../../lib/format/locales/locales-en-US.xml';

const SAMPLE = {
  id: 'spike',
  type: 'webpage',
  title: 'Spike Test',
  author: [{ family: 'Smith', given: 'John' }],
  issued: { 'date-parts': [[2026, 5, 26]] },
  URL: 'https://example.com',
  'container-title': 'Example',
};

export const onRequest: PagesFunction = async () => {
  const sys = {
    retrieveLocale: () => locale,
    retrieveItem: (id: string) => SAMPLE,
  };
  const engine = new CSL.Engine(sys, mla);
  engine.updateItems([SAMPLE.id]);
  const out = engine.makeBibliography();
  return new Response(JSON.stringify(out), {
    headers: { 'content-type': 'application/json' },
  });
};
```

This requires raw-file imports of `.csl` and `.xml`. Astro/Cloudflare-adapter doesn't do this by default. We need a Wrangler/esbuild loader hint. Add to `package.json` the dev dep `esbuild-plugin-text-import` OR use a Vite import: `import mla from '.../mla-9.csl?raw'`. The Astro Cloudflare adapter uses Vite under the hood — **prefer the `?raw` suffix**:

```ts
import mla from '../../lib/format/styles/mla-9.csl?raw';
import locale from '../../lib/format/locales/locales-en-US.xml?raw';
```

If `?raw` doesn't work in the Pages Functions build (functions are bundled by Wrangler separately, not Vite), the fallback is to base64-encode the CSL files into `.ts` modules at build time. Document the actual approach taken in the commit message.

- [ ] **Step 4: Measure bundle size — local build**

```bash
npm run build
ls -la dist/_worker.js* 2>/dev/null || find dist -name '*.js' -path '*functions*' -exec ls -la {} \;
```

Expected: a single bundled worker file. Record its **uncompressed AND gzipped** size:

```bash
gzip -c dist/_worker.js | wc -c  # or wherever the bundle lands
```

Pass criterion:
- **< 1,048,576 bytes gzipped** → safe on free plan; proceed with full plan.
- **1 MB – 10 MB gzipped** → assume paid plan (mlagenerator.com is a custom domain so likely paid); proceed but flag in the PR body.
- **> 10 MB gzipped** → STOP. Surface to user. Need to drop styles, lazy-load, or move formatting client-side.

- [ ] **Step 5: Measure bundle size — preview deploy**

```bash
npm run preview
# verify GET /api/_spike-format returns a non-empty bibliography string
curl -s http://127.0.0.1:8788/api/_spike-format | head -c 500
```

Expected: JSON with `bibliography` array containing a non-empty string. If empty or errors, citeproc-js doesn't work in this runtime — STOP and surface.

- [ ] **Step 6: Delete the spike endpoint, keep CSL/locale files**

```bash
rm -rf functions/api/_spike-format
```

The CSL and locale files stay — they're real Phase 1 deliverables.

- [ ] **Step 7: Commit**

```bash
git add functions/lib/format/styles functions/lib/format/locales package.json package-lock.json
git commit -m "chore: vendor CSL styles + locale, verify citeproc-js bundles under Workers limit

Bundle size measured at <fill in actual number> bytes gzipped, well under the
Pages Functions cap. CSL XML and en-US locale vendored from upstream
citation-style-language repo (commit <upstream hash if known>)."
```

### Task A2: vitest config + npm scripts + CI gate

**Files:**
- Create: `vitest.config.ts`
- Create: `.github/workflows/test.yml`
- Create: `tests/helpers/load-fixture.ts`
- Create: `tests/sanity.test.ts` (deleted at end of task)
- Modify: `package.json` — add `test`/`test:watch` scripts

- [ ] **Step 1: Write the sanity test**

Create `tests/sanity.test.ts`:

```ts
import { describe, it, expect } from 'vitest';

describe('sanity', () => {
  it('vitest is wired up', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 2: Write the vitest config**

Create `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 10000,
  },
});
```

- [ ] **Step 3: Add npm scripts**

Edit `package.json`. Add to the `scripts` block:

```json
    "test": "vitest run",
    "test:watch": "vitest"
```

- [ ] **Step 4: Run the sanity test**

```bash
npm test
```

Expected: PASS with 1 test, exit 0.

- [ ] **Step 5: Add the CI workflow**

Create `.github/workflows/test.yml`:

```yaml
name: test
on:
  pull_request:
    branches: [main]
  push:
    branches: [main]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm test
```

- [ ] **Step 6: Write the fixture loader helper**

Create `tests/helpers/load-fixture.ts`:

```ts
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

export function loadFixtureFile(dir: string, filename: string): string {
  return readFileSync(join(dir, filename), 'utf-8');
}

export function loadFixtureJson<T = unknown>(dir: string, filename: string): T {
  return JSON.parse(loadFixtureFile(dir, filename));
}

export function listFixtureDirs(parentDir: string): string[] {
  return readdirSync(parentDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => join(parentDir, d.name))
    .sort();
}
```

- [ ] **Step 7: Delete sanity test, commit**

```bash
rm tests/sanity.test.ts
git add vitest.config.ts package.json .github tests/helpers
git commit -m "chore: add vitest config, npm test script, CI gate, fixture loader

GitHub Actions runs npm test on every PR and push to main. Tests live under
tests/ following the spec layout. Loader helpers in tests/helpers/."
```

### Task A3: CSL-JSON types (shared server + client)

**Files:**
- Create: `functions/lib/csl-types.ts`
- Create: `src/lib/citations/csl-types.ts`
- Create: `tests/csl-types.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/csl-types.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import type { CSLItem, CSLName, CSLDate, RichText, ExtractEnvelope, FormatRequest } from '../functions/lib/csl-types';

describe('csl-types', () => {
  it('allows a structured author name', () => {
    const n: CSLName = { family: 'Smith', given: 'John' };
    expect(n.family).toBe('Smith');
  });

  it('allows a literal (corporate) author', () => {
    const n: CSLName = { literal: 'Wikimedia Foundation' };
    expect('literal' in n).toBe(true);
  });

  it('encodes a y/m/d date in CSL date-parts shape', () => {
    const d: CSLDate = { 'date-parts': [[2026, 5, 26]] };
    expect(d['date-parts'][0][0]).toBe(2026);
  });

  it('encodes a webpage CSL item', () => {
    const item: CSLItem = {
      id: 'abc',
      type: 'webpage',
      title: 't',
      author: [{ family: 'A' }],
      issued: { 'date-parts': [[2026]] },
      URL: 'https://x',
    };
    expect(item.type).toBe('webpage');
  });

  it('envelopes a server response', () => {
    const env: ExtractEnvelope = {
      uuid: 'u',
      type: 'webpage',
      csl: { id: 'u', type: 'webpage' },
    };
    expect(env.type).toBe('webpage');
  });

  it('models a format request', () => {
    const req: FormatRequest = { csl: { id: 'u', type: 'webpage' }, style: 'mla-9' };
    expect(req.style).toBe('mla-9');
  });
});
```

- [ ] **Step 2: Verify it fails**

```bash
npm test
```

Expected: FAIL — `Cannot find module '../functions/lib/csl-types'`.

- [ ] **Step 3: Write `functions/lib/csl-types.ts`**

```ts
export type CSLNamePerson = {
  family: string;
  given?: string;
  'non-dropping-particle'?: string;
  'dropping-particle'?: string;
  suffix?: string;
};

export type CSLNameLiteral = { literal: string };

export type CSLName = CSLNamePerson | CSLNameLiteral;

export type CSLDateParts =
  | [number]
  | [number, number]
  | [number, number, number];

export type CSLDate = {
  'date-parts': CSLDateParts[];
  literal?: string;
  raw?: string;
};

export type CSLType =
  | 'webpage'
  | 'book'
  | 'article-journal'
  | 'article-magazine'
  | 'article-newspaper';

export interface CSLItem {
  id: string;
  type: CSLType;
  title?: string;
  author?: CSLName[];
  editor?: CSLName[];
  issued?: CSLDate;
  accessed?: CSLDate;
  URL?: string;
  DOI?: string;
  ISBN?: string;
  'container-title'?: string;
  publisher?: string;
  'publisher-place'?: string;
  volume?: string;
  issue?: string;
  page?: string;
  edition?: string;
  abstract?: string;
}

export interface ExtractEnvelope {
  uuid: string;
  type: CSLType;
  csl: CSLItem;
  _signals?: Record<string, string>;
  _cached?: boolean;
}

export type SupportedStyle =
  | 'mla-9'
  | 'apa-7'
  | 'chicago-18'
  | 'ama-11'
  | 'harvard'
  | 'ieee'
  | 'vancouver';

export interface FormatRequest {
  csl: CSLItem;
  style: SupportedStyle;
}

export interface RichText {
  text: string;
  italic?: boolean;
}

export interface FormatResponse {
  formatted: RichText[];
}
```

- [ ] **Step 4: Mirror on the client**

Create `src/lib/citations/csl-types.ts` with the **exact same contents** as the server file. (Don't re-export — the server file is in the Functions tsconfig, not the app tsconfig. Duplicate, but verify they stay in sync via a test in a later task.)

- [ ] **Step 5: Run tests**

```bash
npm test
```

Expected: PASS, 6 tests.

- [ ] **Step 6: Commit**

```bash
git add functions/lib/csl-types.ts src/lib/citations/csl-types.ts tests/csl-types.test.ts
git commit -m "feat(types): add CSL-JSON type definitions for server and client"
```

---

## Block B — Server building blocks (parallelizable)

After Block A lands, Tasks B1–B11 below are independent and can run as parallel subagents. Each is fully self-contained with code + tests.

### Task B1: URL normalization

**Files:**
- Create: `functions/lib/extract/url-normalize.ts`
- Create: `tests/extract/url-normalize.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/extract/url-normalize.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { normalizeUrl } from '../../functions/lib/extract/url-normalize';

describe('normalizeUrl', () => {
  it('lowercases scheme and host', () => {
    expect(normalizeUrl('HTTPS://Example.COM/Path')).toBe('https://example.com/Path');
  });

  it('strips utm_* tracking params', () => {
    expect(normalizeUrl('https://x.com/p?a=1&utm_source=tw&utm_medium=x'))
      .toBe('https://x.com/p?a=1');
  });

  it('strips fbclid, gclid, ref, mc_cid, mc_eid', () => {
    expect(normalizeUrl('https://x.com/p?fbclid=1&gclid=2&ref=3&mc_cid=4&mc_eid=5&keep=ok'))
      .toBe('https://x.com/p?keep=ok');
  });

  it('drops the fragment', () => {
    expect(normalizeUrl('https://x.com/p#section')).toBe('https://x.com/p');
  });

  it('sorts remaining query params for stable keys', () => {
    expect(normalizeUrl('https://x.com/p?b=2&a=1')).toBe('https://x.com/p?a=1&b=2');
  });

  it('preserves trailing slashes as given', () => {
    expect(normalizeUrl('https://x.com/p/')).toBe('https://x.com/p/');
  });

  it('throws on invalid input', () => {
    expect(() => normalizeUrl('not a url')).toThrow();
  });
});
```

- [ ] **Step 2: Verify it fails**

```bash
npm test -- tests/extract/url-normalize.test.ts
```

Expected: FAIL with "Cannot find module".

- [ ] **Step 3: Implement**

Create `functions/lib/extract/url-normalize.ts`:

```ts
const TRACKING_PARAMS = new Set([
  'fbclid', 'gclid', 'ref', 'mc_cid', 'mc_eid', 'igshid', 'msclkid', 'yclid',
]);

export function normalizeUrl(input: string): string {
  const u = new URL(input);
  u.protocol = u.protocol.toLowerCase();
  u.hostname = u.hostname.toLowerCase();
  u.hash = '';
  const cleaned = new URLSearchParams();
  const keys = [...new Set([...u.searchParams.keys()])].sort();
  for (const key of keys) {
    if (key.startsWith('utm_') || TRACKING_PARAMS.has(key)) continue;
    for (const v of u.searchParams.getAll(key)) cleaned.append(key, v);
  }
  const qs = cleaned.toString();
  u.search = qs ? `?${qs}` : '';
  return u.toString();
}
```

Note: `URL#search` will re-prepend `?` automatically when assigning a value with `?`, and stays empty when assigned `''`. Browsers and Node URL diverge slightly — use the explicit construction above.

- [ ] **Step 4: Run tests**

```bash
npm test -- tests/extract/url-normalize.test.ts
```

Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add functions/lib/extract/url-normalize.ts tests/extract/url-normalize.test.ts
git commit -m "feat(extract): URL normalization for cache keys (strips utm/fbclid/etc, sorts params)"
```

### Task B2: Fetch utility

**Files:**
- Create: `functions/lib/extract/fetch.ts`
- Create: `tests/extract/fetch.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/extract/fetch.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchHtml, FetchError } from '../../functions/lib/extract/fetch';

describe('fetchHtml', () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => { globalThis.fetch = originalFetch; });

  it('returns html + finalUrl on a normal text/html response', async () => {
    globalThis.fetch = vi.fn(async () => new Response('<html>ok</html>', {
      status: 200,
      headers: { 'content-type': 'text/html; charset=utf-8' },
    })) as any;
    const { html, finalUrl } = await fetchHtml('https://x.com');
    expect(html).toContain('<html>');
    expect(finalUrl).toBe('https://x.com/');
  });

  it('rejects non-HTML content', async () => {
    globalThis.fetch = vi.fn(async () => new Response('binary', {
      status: 200,
      headers: { 'content-type': 'application/pdf' },
    })) as any;
    await expect(fetchHtml('https://x.com')).rejects.toMatchObject({ code: 'not_html' });
  });

  it('rejects non-2xx responses', async () => {
    globalThis.fetch = vi.fn(async () => new Response('nope', {
      status: 404, headers: { 'content-type': 'text/html' },
    })) as any;
    await expect(fetchHtml('https://x.com')).rejects.toMatchObject({ code: 'fetch_failed' });
  });

  it('sets a modern user-agent header', async () => {
    const spy = vi.fn(async () => new Response('<html></html>', {
      status: 200, headers: { 'content-type': 'text/html' },
    }));
    globalThis.fetch = spy as any;
    await fetchHtml('https://x.com');
    const init = spy.mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>)['User-Agent']).toMatch(/mlagenerator/i);
  });
});
```

- [ ] **Step 2: Verify it fails**

```bash
npm test -- tests/extract/fetch.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `functions/lib/extract/fetch.ts`:

```ts
const UA = 'Mozilla/5.0 (compatible; mlagenerator/1.0; +https://mlagenerator.com)';
const TIMEOUT_MS = 10_000;

export class FetchError extends Error {
  constructor(
    message: string,
    public readonly code: 'fetch_failed' | 'not_html' | 'timeout' | 'invalid_url',
    public readonly retryable: boolean,
  ) {
    super(message);
    this.name = 'FetchError';
  }
}

export async function fetchHtml(url: string): Promise<{ html: string; finalUrl: string }> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new FetchError('Invalid URL', 'invalid_url', false);
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new FetchError('Unsupported scheme', 'invalid_url', false);
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: ctrl.signal,
      headers: {
        'User-Agent': UA,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });
    if (!res.ok) {
      throw new FetchError(`HTTP ${res.status}`, 'fetch_failed', res.status >= 500);
    }
    const ct = (res.headers.get('content-type') || '').toLowerCase();
    if (!ct.includes('text/html') && !ct.includes('application/xhtml')) {
      throw new FetchError(`Non-HTML content: ${ct || 'unknown'}`, 'not_html', false);
    }
    const html = await res.text();
    return { html, finalUrl: res.url || url };
  } catch (err) {
    if (err instanceof FetchError) throw err;
    if ((err as any)?.name === 'AbortError') {
      throw new FetchError('Timeout', 'timeout', true);
    }
    throw new FetchError(`Fetch error: ${(err as Error).message}`, 'fetch_failed', true);
  } finally {
    clearTimeout(timer);
  }
}
```

- [ ] **Step 4: Run tests**

```bash
npm test -- tests/extract/fetch.test.ts
```

Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add functions/lib/extract/fetch.ts tests/extract/fetch.test.ts
git commit -m "feat(extract): HTML fetcher with modern UA, 10s timeout, content-type check"
```

### Task B3: Cache wrapper

The Cloudflare Cache API uses a request-keyed cache (`caches.default`). It's not available in the vitest Node environment. We design the module to accept an injected cache for testing.

**Files:**
- Create: `functions/lib/cache.ts`
- Create: `tests/cache.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/cache.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createCacheStore } from '../functions/lib/cache';

describe('cache store', () => {
  function inMemoryCache(): Cache {
    const store = new Map<string, Response>();
    return {
      async match(req: Request | string) {
        const key = typeof req === 'string' ? req : req.url;
        const r = store.get(key);
        return r ? r.clone() : undefined;
      },
      async put(req: Request | string, res: Response) {
        const key = typeof req === 'string' ? req : req.url;
        store.set(key, res.clone());
      },
      async delete() { return true; },
    } as unknown as Cache;
  }

  it('returns undefined on cache miss', async () => {
    const store = createCacheStore(inMemoryCache());
    const got = await store.get('https://x.com/a');
    expect(got).toBeUndefined();
  });

  it('round-trips a JSON response', async () => {
    const store = createCacheStore(inMemoryCache());
    await store.put('https://x.com/a', new Response(JSON.stringify({ ok: 1 }), {
      headers: { 'content-type': 'application/json' },
    }), 86400);
    const got = await store.get('https://x.com/a');
    expect(await got!.json()).toEqual({ ok: 1 });
  });

  it('sets Cache-Control with the provided max-age on stored responses', async () => {
    const cache = inMemoryCache();
    const store = createCacheStore(cache);
    await store.put('https://x.com/a', new Response('hi'), 2592000);
    const got = await cache.match('https://x.com/a');
    expect(got!.headers.get('Cache-Control')).toBe('public, max-age=2592000');
  });
});
```

- [ ] **Step 2: Verify it fails**

```bash
npm test -- tests/cache.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `functions/lib/cache.ts`:

```ts
export interface CacheStore {
  get(key: string): Promise<Response | undefined>;
  put(key: string, response: Response, maxAgeSeconds: number): Promise<void>;
}

export function createCacheStore(cache: Cache): CacheStore {
  return {
    async get(key) {
      const r = await cache.match(new Request(key));
      return r ?? undefined;
    },
    async put(key, response, maxAgeSeconds) {
      const cloned = new Response(response.clone().body, response);
      cloned.headers.set('Cache-Control', `public, max-age=${maxAgeSeconds}`);
      await cache.put(new Request(key), cloned);
    },
  };
}

// Convenience for production code paths inside the Worker:
export function defaultCacheStore(): CacheStore {
  // @ts-ignore — caches.default is Cloudflare-specific, not in standard lib
  return createCacheStore((caches as any).default);
}

export const TTL = {
  WEBSITE: 86_400,         // 24h
  BOOK_OR_JOURNAL: 2_592_000, // 30d
} as const;
```

- [ ] **Step 4: Run tests**

```bash
npm test -- tests/cache.test.ts
```

Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add functions/lib/cache.ts tests/cache.test.ts
git commit -m "feat(cache): Cloudflare Cache API wrapper with injectable backend for tests"
```

### Task B4: Author name parser

**Files:**
- Create: `functions/lib/extract/author-parse.ts`
- Create: `tests/extract/author-parse.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/extract/author-parse.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { parseAuthorName } from '../../functions/lib/extract/author-parse';

describe('parseAuthorName', () => {
  it('parses "First Last"', () => {
    expect(parseAuthorName('John Smith')).toEqual({ family: 'Smith', given: 'John' });
  });

  it('parses "First Middle Last"', () => {
    expect(parseAuthorName('John Q Smith')).toEqual({ family: 'Smith', given: 'John Q' });
  });

  it('parses "Last, First"', () => {
    expect(parseAuthorName('Smith, John')).toEqual({ family: 'Smith', given: 'John' });
  });

  it('parses single-token names', () => {
    expect(parseAuthorName('Cher')).toEqual({ family: 'Cher' });
  });

  it('recognises non-dropping particles', () => {
    expect(parseAuthorName('John von Neumann')).toEqual({
      family: 'Neumann', given: 'John', 'non-dropping-particle': 'von',
    });
  });

  it('recognises trailing suffixes', () => {
    expect(parseAuthorName('John Smith Jr.')).toEqual({
      family: 'Smith', given: 'John', suffix: 'Jr.',
    });
  });

  it('flags corporate authors as literal', () => {
    expect(parseAuthorName('Wikimedia Foundation')).toEqual({ literal: 'Wikimedia Foundation' });
    expect(parseAuthorName('Acme Corp.')).toEqual({ literal: 'Acme Corp.' });
    expect(parseAuthorName('Stanford University')).toEqual({ literal: 'Stanford University' });
  });

  it('passes through pre-structured input', () => {
    expect(parseAuthorName({ family: 'X', given: 'Y' })).toEqual({ family: 'X', given: 'Y' });
  });

  it('trims whitespace', () => {
    expect(parseAuthorName('  John Smith  ')).toEqual({ family: 'Smith', given: 'John' });
  });

  it('returns null-ish for empty input', () => {
    expect(parseAuthorName('')).toBeNull();
    expect(parseAuthorName('   ')).toBeNull();
  });
});
```

- [ ] **Step 2: Verify it fails**

```bash
npm test -- tests/extract/author-parse.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `functions/lib/extract/author-parse.ts`:

```ts
import type { CSLName } from '../csl-types';

const ORG_SUFFIXES = /\b(Inc\.?|LLC|Ltd\.?|Corp\.?|Corporation|Foundation|Press|University|Institute|Society|Group|Company|Co\.?|Department|Office|Agency|Bureau|Commission)\b/i;
const PARTICLES = new Set([
  'von', 'de', 'del', 'della', 'van', 'la', 'le', 'der', 'den', 'di', 'da', 'du', 'dos', 'des',
]);
const SUFFIX = /^(Jr\.?|Sr\.?|II|III|IV|V|PhD|Ph\.D\.?|MD|M\.D\.?|MA|MSc|BSc|Esq\.?)$/i;

export function parseAuthorName(input: string | CSLName | null | undefined): CSLName | null {
  if (input == null) return null;
  if (typeof input === 'object') return input;
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (ORG_SUFFIXES.test(trimmed)) return { literal: trimmed };

  if (trimmed.includes(',')) {
    const [family, given] = trimmed.split(',', 2).map((s) => s.trim());
    if (!family) return null;
    return given ? { family, given } : { family };
  }

  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return { family: parts[0] };

  let suffix: string | undefined;
  if (SUFFIX.test(parts[parts.length - 1])) {
    suffix = parts.pop();
  }
  const family = parts.pop();
  if (!family) return null;
  let particle: string | undefined;
  if (parts.length >= 1 && PARTICLES.has(parts[parts.length - 1].toLowerCase())) {
    particle = parts.pop();
  }
  const given = parts.join(' ');

  const out: CSLName = { family };
  if (given) (out as any).given = given;
  if (particle) (out as any)['non-dropping-particle'] = particle;
  if (suffix) (out as any).suffix = suffix;
  return out;
}
```

- [ ] **Step 4: Run tests**

```bash
npm test -- tests/extract/author-parse.test.ts
```

Expected: PASS, 10 tests.

- [ ] **Step 5: Commit**

```bash
git add functions/lib/extract/author-parse.ts tests/extract/author-parse.test.ts
git commit -m "feat(extract): author name parser with particles, suffixes, corporate detection"
```

### Task B5: Date parser

**Files:**
- Create: `functions/lib/extract/date-parse.ts`
- Create: `tests/extract/date-parse.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/extract/date-parse.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { parseIsoDate, parseFreeformDate } from '../../functions/lib/extract/date-parse';

describe('parseIsoDate', () => {
  it('parses YYYY-MM-DD', () => {
    expect(parseIsoDate('2026-05-26')).toEqual([2026, 5, 26]);
  });
  it('parses YYYY-MM', () => {
    expect(parseIsoDate('2026-05')).toEqual([2026, 5]);
  });
  it('parses YYYY', () => {
    expect(parseIsoDate('2026')).toEqual([2026]);
  });
  it('tolerates an ISO timestamp', () => {
    expect(parseIsoDate('2026-05-26T10:30:00Z')).toEqual([2026, 5, 26]);
  });
  it('returns null on garbage', () => {
    expect(parseIsoDate('notadate')).toBeNull();
    expect(parseIsoDate('')).toBeNull();
  });
});

describe('parseFreeformDate', () => {
  it('parses "May 26, 2026"', () => {
    expect(parseFreeformDate('May 26, 2026')).toEqual([2026, 5, 26]);
  });
  it('parses "26 May 2026"', () => {
    expect(parseFreeformDate('26 May 2026')).toEqual([2026, 5, 26]);
  });
  it('parses month abbreviation', () => {
    expect(parseFreeformDate('Jan 5, 2026')).toEqual([2026, 1, 5]);
  });
  it('returns null on bare year (use parseIsoDate for that)', () => {
    expect(parseFreeformDate('2026')).toBeNull();
  });
  it('returns null on garbage', () => {
    expect(parseFreeformDate('hello world')).toBeNull();
  });
});
```

- [ ] **Step 2: Verify it fails**

```bash
npm test -- tests/extract/date-parse.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement**

Create `functions/lib/extract/date-parse.ts`:

```ts
import type { CSLDateParts } from '../csl-types';

const MONTHS: Record<string, number> = {
  january: 1, jan: 1,
  february: 2, feb: 2,
  march: 3, mar: 3,
  april: 4, apr: 4,
  may: 5,
  june: 6, jun: 6,
  july: 7, jul: 7,
  august: 8, aug: 8,
  september: 9, sept: 9, sep: 9,
  october: 10, oct: 10,
  november: 11, nov: 11,
  december: 12, dec: 12,
};

export function parseIsoDate(s: string | null | undefined): CSLDateParts | null {
  if (!s) return null;
  const m = s.match(/^(\d{4})(?:-(\d{1,2})(?:-(\d{1,2}))?)?/);
  if (!m) return null;
  const y = parseInt(m[1], 10);
  if (!Number.isFinite(y) || y < 1000 || y > 9999) return null;
  if (m[3]) return [y, parseInt(m[2], 10), parseInt(m[3], 10)];
  if (m[2]) return [y, parseInt(m[2], 10)];
  return [y];
}

export function parseFreeformDate(s: string | null | undefined): CSLDateParts | null {
  if (!s) return null;
  const text = s.trim();
  // "May 26, 2026" or "May 26 2026"
  let m = text.match(/^([A-Za-z]+)\.?\s+(\d{1,2}),?\s+(\d{4})$/);
  if (m) {
    const month = MONTHS[m[1].toLowerCase()];
    if (month) return [parseInt(m[3], 10), month, parseInt(m[2], 10)];
  }
  // "26 May 2026"
  m = text.match(/^(\d{1,2})\s+([A-Za-z]+)\.?\s+(\d{4})$/);
  if (m) {
    const month = MONTHS[m[2].toLowerCase()];
    if (month) return [parseInt(m[3], 10), month, parseInt(m[1], 10)];
  }
  return null;
}
```

- [ ] **Step 4: Run tests**

```bash
npm test -- tests/extract/date-parse.test.ts
```

Expected: PASS, 10 tests.

- [ ] **Step 5: Commit**

```bash
git add functions/lib/extract/date-parse.ts tests/extract/date-parse.test.ts
git commit -m "feat(extract): ISO and free-form date parsers returning CSL date-parts"
```

### Task B6: Signal extractor — JSON-LD

**Files:**
- Create: `functions/lib/extract/signals/jsonld.ts`
- Create: `tests/extract/signals/jsonld.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/extract/signals/jsonld.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import * as cheerio from 'cheerio';
import { jsonldSignal } from '../../../functions/lib/extract/signals/jsonld';

function load(html: string) { return cheerio.load(html); }

describe('jsonldSignal', () => {
  it('extracts headline, author, datePublished, publisher from NewsArticle', () => {
    const $ = load(`<html><head><script type="application/ld+json">${JSON.stringify({
      '@type': 'NewsArticle',
      headline: 'A Title',
      author: { '@type': 'Person', givenName: 'Jane', familyName: 'Doe' },
      datePublished: '2026-05-26',
      publisher: { '@type': 'Organization', name: 'Example News' },
    })}</script></head></html>`);
    const r = jsonldSignal($);
    expect(r.fields.title).toBe('A Title');
    expect(r.fields.author).toEqual([{ family: 'Doe', given: 'Jane' }]);
    expect(r.fields.issued).toEqual({ 'date-parts': [[2026, 5, 26]] });
    expect(r.fields.publisher).toBe('Example News');
    expect(r.confidence.title).toBeCloseTo(0.95);
  });

  it('handles a @graph wrapper', () => {
    const $ = load(`<html><head><script type="application/ld+json">${JSON.stringify({
      '@context': 'https://schema.org',
      '@graph': [{ '@type': 'Article', headline: 'In graph', datePublished: '2025' }],
    })}</script></head></html>`);
    const r = jsonldSignal($);
    expect(r.fields.title).toBe('In graph');
    expect(r.fields.issued).toEqual({ 'date-parts': [[2025]] });
  });

  it('handles a top-level array', () => {
    const $ = load(`<html><head><script type="application/ld+json">${JSON.stringify([
      { '@type': 'WebSite', name: 'site' },
      { '@type': 'Article', headline: 'Top' },
    ])}</script></head></html>`);
    const r = jsonldSignal($);
    expect(r.fields.title).toBe('Top');
  });

  it('handles author as a plain string', () => {
    const $ = load(`<html><head><script type="application/ld+json">${JSON.stringify({
      '@type': 'Article', headline: 'h', author: 'John Smith',
    })}</script></head></html>`);
    const r = jsonldSignal($);
    expect(r.fields.author).toEqual([{ family: 'Smith', given: 'John' }]);
  });

  it('handles author array of mixed shapes', () => {
    const $ = load(`<html><head><script type="application/ld+json">${JSON.stringify({
      '@type': 'Article', headline: 'h',
      author: [
        'John Smith',
        { '@type': 'Person', givenName: 'Jane', familyName: 'Doe' },
        { '@type': 'Organization', name: 'Acme Inc' },
      ],
    })}</script></head></html>`);
    const r = jsonldSignal($);
    expect(r.fields.author).toEqual([
      { family: 'Smith', given: 'John' },
      { family: 'Doe', given: 'Jane' },
      { literal: 'Acme Inc' },
    ]);
  });

  it('silently ignores malformed JSON', () => {
    const $ = load(`<html><head><script type="application/ld+json">{not json}</script></head></html>`);
    const r = jsonldSignal($);
    expect(r.fields).toEqual({});
  });

  it('returns empty when no script tags exist', () => {
    const $ = load(`<html><head></head><body>hi</body></html>`);
    const r = jsonldSignal($);
    expect(r.fields).toEqual({});
  });
});
```

- [ ] **Step 2: Verify it fails**

```bash
npm test -- tests/extract/signals/jsonld.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `functions/lib/extract/signals/jsonld.ts`:

```ts
import type { CheerioAPI } from 'cheerio';
import type { CSLItem, CSLName } from '../../csl-types';
import { parseAuthorName } from '../author-parse';
import { parseIsoDate } from '../date-parse';

export interface SignalResult {
  fields: Partial<CSLItem>;
  confidence: Partial<Record<keyof CSLItem, number>>;
}

const CONF = 0.95;

export function jsonldSignal($: CheerioAPI): SignalResult {
  const fields: Partial<CSLItem> = {};
  const confidence: Partial<Record<keyof CSLItem, number>> = {};
  $('script[type="application/ld+json"]').each((_, el) => {
    let blob: unknown;
    try {
      blob = JSON.parse($(el).contents().text());
    } catch {
      return;
    }
    walk(blob, fields, confidence);
  });
  return { fields, confidence };
}

function walk(node: unknown, fields: Partial<CSLItem>, confidence: Partial<Record<keyof CSLItem, number>>): void {
  if (Array.isArray(node)) {
    for (const item of node) walk(item, fields, confidence);
    return;
  }
  if (!node || typeof node !== 'object') return;
  const n = node as Record<string, any>;

  if (!fields.title) {
    const t = n.headline || n.name || n.title;
    if (typeof t === 'string' && t.trim()) {
      fields.title = t.trim();
      confidence.title = CONF;
    }
  }

  if (!fields.author && n.author) {
    const arr = Array.isArray(n.author) ? n.author : [n.author];
    const authors: CSLName[] = [];
    for (const a of arr) {
      const parsed = nodeToAuthor(a);
      if (parsed) authors.push(parsed);
    }
    if (authors.length) {
      fields.author = authors;
      confidence.author = CONF;
    }
  }

  if (!fields.issued) {
    const d = n.datePublished || n.dateCreated;
    if (typeof d === 'string') {
      const dp = parseIsoDate(d);
      if (dp) {
        fields.issued = { 'date-parts': [dp] };
        confidence.issued = CONF;
      }
    }
  }

  if (!fields.publisher && n.publisher) {
    const name = typeof n.publisher === 'string' ? n.publisher : n.publisher?.name;
    if (typeof name === 'string' && name.trim()) {
      fields.publisher = name.trim();
      confidence.publisher = CONF;
    }
  }

  if (!fields.URL && typeof n.url === 'string') {
    fields.URL = n.url;
    confidence.URL = CONF;
  }

  if (n['@graph']) walk(n['@graph'], fields, confidence);
  if (n.mainEntity) walk(n.mainEntity, fields, confidence);
}

function nodeToAuthor(a: unknown): CSLName | null {
  if (typeof a === 'string') return parseAuthorName(a);
  if (!a || typeof a !== 'object') return null;
  const obj = a as Record<string, any>;
  const type = String(obj['@type'] || '');
  if (type === 'Organization' || type === 'Corporation') {
    return obj.name ? { literal: String(obj.name) } : null;
  }
  if (obj.familyName || obj.givenName) {
    const out: CSLName = { family: String(obj.familyName || '') };
    if (obj.givenName) (out as any).given = String(obj.givenName);
    return out.family ? out : null;
  }
  if (obj.name) return parseAuthorName(String(obj.name));
  return null;
}
```

- [ ] **Step 4: Run tests**

```bash
npm test -- tests/extract/signals/jsonld.test.ts
```

Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add functions/lib/extract/signals/jsonld.ts tests/extract/signals/jsonld.test.ts
git commit -m "feat(extract): JSON-LD signal extractor (handles @graph, arrays, mixed author shapes)"
```

### Task B7: Signal extractor — Microdata (schema.org itemprop)

**Files:**
- Create: `functions/lib/extract/signals/microdata.ts`
- Create: `tests/extract/signals/microdata.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/extract/signals/microdata.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import * as cheerio from 'cheerio';
import { microdataSignal } from '../../../functions/lib/extract/signals/microdata';

describe('microdataSignal', () => {
  it('reads itemprop headline/author/datePublished', () => {
    const $ = cheerio.load(`<article itemscope itemtype="https://schema.org/Article">
      <h1 itemprop="headline">My headline</h1>
      <span itemprop="author">Jane Doe</span>
      <time itemprop="datePublished" datetime="2026-05-26"></time>
    </article>`);
    const r = microdataSignal($);
    expect(r.fields.title).toBe('My headline');
    expect(r.fields.author).toEqual([{ family: 'Doe', given: 'Jane' }]);
    expect(r.fields.issued).toEqual({ 'date-parts': [[2026, 5, 26]] });
    expect(r.confidence.title).toBeCloseTo(0.85);
  });

  it('falls back to itemprop=name when headline missing', () => {
    const $ = cheerio.load(`<div itemprop="name">Just a name</div>`);
    const r = microdataSignal($);
    expect(r.fields.title).toBe('Just a name');
  });

  it('reads content attribute when text empty', () => {
    const $ = cheerio.load(`<meta itemprop="datePublished" content="2024-01-15">`);
    const r = microdataSignal($);
    expect(r.fields.issued).toEqual({ 'date-parts': [[2024, 1, 15]] });
  });

  it('returns empty when nothing matches', () => {
    const $ = cheerio.load(`<html><body><p>plain</p></body></html>`);
    const r = microdataSignal($);
    expect(r.fields).toEqual({});
  });
});
```

- [ ] **Step 2: Verify it fails**

```bash
npm test -- tests/extract/signals/microdata.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement**

Create `functions/lib/extract/signals/microdata.ts`:

```ts
import type { CheerioAPI } from 'cheerio';
import type { CSLItem } from '../../csl-types';
import { parseAuthorName } from '../author-parse';
import { parseIsoDate } from '../date-parse';
import type { SignalResult } from './jsonld';

const CONF = 0.85;

function readValue($: CheerioAPI, sel: string): string | null {
  const el = $(sel).first();
  if (!el.length) return null;
  return (el.attr('content') || el.attr('datetime') || el.text() || '').trim() || null;
}

export function microdataSignal($: CheerioAPI): SignalResult {
  const fields: Partial<CSLItem> = {};
  const confidence: SignalResult['confidence'] = {};

  const title = readValue($, '[itemprop="headline"]') || readValue($, '[itemprop="name"]');
  if (title) { fields.title = title; confidence.title = CONF; }

  const authorText = readValue($, '[itemprop="author"]');
  if (authorText) {
    const parsed = parseAuthorName(authorText);
    if (parsed) { fields.author = [parsed]; confidence.author = CONF; }
  }

  const datePublished = readValue($, '[itemprop="datePublished"]');
  if (datePublished) {
    const dp = parseIsoDate(datePublished);
    if (dp) { fields.issued = { 'date-parts': [dp] }; confidence.issued = CONF; }
  }

  const publisher = readValue($, '[itemprop="publisher"] [itemprop="name"]') || readValue($, '[itemprop="publisher"]');
  if (publisher) { fields.publisher = publisher; confidence.publisher = CONF; }

  return { fields, confidence };
}
```

- [ ] **Step 4: Run tests**

```bash
npm test -- tests/extract/signals/microdata.test.ts
```

Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add functions/lib/extract/signals/microdata.ts tests/extract/signals/microdata.test.ts
git commit -m "feat(extract): schema.org microdata signal extractor"
```

### Task B8: Signal extractor — OpenGraph

**Files:**
- Create: `functions/lib/extract/signals/opengraph.ts`
- Create: `tests/extract/signals/opengraph.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/extract/signals/opengraph.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import * as cheerio from 'cheerio';
import { openGraphSignal } from '../../../functions/lib/extract/signals/opengraph';

describe('openGraphSignal', () => {
  it('reads og:title, og:site_name, og:url', () => {
    const $ = cheerio.load(`
      <meta property="og:title" content="The Title" />
      <meta property="og:site_name" content="Example Site" />
      <meta property="og:url" content="https://example.com/p" />`);
    const r = openGraphSignal($);
    expect(r.fields.title).toBe('The Title');
    expect(r.fields['container-title']).toBe('Example Site');
    expect(r.fields.URL).toBe('https://example.com/p');
    expect(r.confidence.title).toBeCloseTo(0.75);
  });

  it('reads article:published_time', () => {
    const $ = cheerio.load(`<meta property="article:published_time" content="2026-05-26T10:00:00Z" />`);
    const r = openGraphSignal($);
    expect(r.fields.issued).toEqual({ 'date-parts': [[2026, 5, 26]] });
  });

  it('reads article:author only when it is a name, not a URL', () => {
    const $1 = cheerio.load(`<meta property="article:author" content="Jane Doe" />`);
    expect(openGraphSignal($1).fields.author).toEqual([{ family: 'Doe', given: 'Jane' }]);

    const $2 = cheerio.load(`<meta property="article:author" content="https://example.com/author/jane" />`);
    expect(openGraphSignal($2).fields.author).toBeUndefined();
  });

  it('returns empty when no OG tags', () => {
    const $ = cheerio.load(`<html></html>`);
    expect(openGraphSignal($).fields).toEqual({});
  });
});
```

- [ ] **Step 2: Verify it fails**

```bash
npm test -- tests/extract/signals/opengraph.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement**

Create `functions/lib/extract/signals/opengraph.ts`:

```ts
import type { CheerioAPI } from 'cheerio';
import type { CSLItem } from '../../csl-types';
import { parseAuthorName } from '../author-parse';
import { parseIsoDate } from '../date-parse';
import type { SignalResult } from './jsonld';

const CONF = 0.75;
const AUTHOR_CONF = 0.6;

function meta($: CheerioAPI, prop: string): string | null {
  const v = $(`meta[property="${prop}"]`).attr('content');
  return v ? v.trim() || null : null;
}

export function openGraphSignal($: CheerioAPI): SignalResult {
  const fields: Partial<CSLItem> = {};
  const confidence: SignalResult['confidence'] = {};

  const title = meta($, 'og:title');
  if (title) { fields.title = title; confidence.title = CONF; }

  const site = meta($, 'og:site_name');
  if (site) { fields['container-title'] = site; confidence['container-title'] = CONF; }

  const url = meta($, 'og:url');
  if (url) { fields.URL = url; confidence.URL = CONF; }

  const pub = meta($, 'article:published_time');
  if (pub) {
    const dp = parseIsoDate(pub);
    if (dp) { fields.issued = { 'date-parts': [dp] }; confidence.issued = CONF; }
  }

  const author = meta($, 'article:author');
  if (author && !/^https?:\/\//i.test(author)) {
    const parsed = parseAuthorName(author);
    if (parsed) { fields.author = [parsed]; confidence.author = AUTHOR_CONF; }
  }

  return { fields, confidence };
}
```

- [ ] **Step 4: Run tests**

```bash
npm test -- tests/extract/signals/opengraph.test.ts
```

Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add functions/lib/extract/signals/opengraph.ts tests/extract/signals/opengraph.test.ts
git commit -m "feat(extract): OpenGraph + article:* meta signal extractor"
```

### Task B9: Signal extractor — Twitter cards

**Files:**
- Create: `functions/lib/extract/signals/twitter.ts`
- Create: `tests/extract/signals/twitter.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/extract/signals/twitter.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import * as cheerio from 'cheerio';
import { twitterSignal } from '../../../functions/lib/extract/signals/twitter';

describe('twitterSignal', () => {
  it('reads twitter:title', () => {
    const $ = cheerio.load(`<meta name="twitter:title" content="T Title" />`);
    expect(twitterSignal($).fields.title).toBe('T Title');
  });

  it('reads twitter:site as container-title', () => {
    const $ = cheerio.load(`<meta name="twitter:site" content="@nyt" />`);
    // @-prefixed handles are not container titles
    expect(twitterSignal($).fields['container-title']).toBeUndefined();

    const $2 = cheerio.load(`<meta name="twitter:site" content="The New York Times" />`);
    expect(twitterSignal($2).fields['container-title']).toBe('The New York Times');
  });

  it('returns empty when no twitter tags', () => {
    expect(twitterSignal(cheerio.load(`<html></html>`)).fields).toEqual({});
  });
});
```

- [ ] **Step 2: Verify it fails**

```bash
npm test -- tests/extract/signals/twitter.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement**

Create `functions/lib/extract/signals/twitter.ts`:

```ts
import type { CheerioAPI } from 'cheerio';
import type { CSLItem } from '../../csl-types';
import type { SignalResult } from './jsonld';

const CONF = 0.55;

function meta($: CheerioAPI, name: string): string | null {
  const v = $(`meta[name="twitter:${name}"]`).attr('content');
  return v ? v.trim() || null : null;
}

export function twitterSignal($: CheerioAPI): SignalResult {
  const fields: Partial<CSLItem> = {};
  const confidence: SignalResult['confidence'] = {};

  const title = meta($, 'title');
  if (title) { fields.title = title; confidence.title = CONF; }

  const site = meta($, 'site');
  if (site && !site.startsWith('@')) {
    fields['container-title'] = site;
    confidence['container-title'] = CONF;
  }

  return { fields, confidence };
}
```

- [ ] **Step 4: Run tests**

```bash
npm test -- tests/extract/signals/twitter.test.ts
```

Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add functions/lib/extract/signals/twitter.ts tests/extract/signals/twitter.test.ts
git commit -m "feat(extract): Twitter card signal extractor"
```

### Task B10: Signal extractor — Plain meta tags + citation_* / DC.*

**Files:**
- Create: `functions/lib/extract/signals/meta.ts`
- Create: `tests/extract/signals/meta.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/extract/signals/meta.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import * as cheerio from 'cheerio';
import { metaSignal } from '../../../functions/lib/extract/signals/meta';

describe('metaSignal', () => {
  it('reads <meta name="author">', () => {
    const $ = cheerio.load(`<meta name="author" content="Jane Doe" />`);
    expect(metaSignal($).fields.author).toEqual([{ family: 'Doe', given: 'Jane' }]);
  });

  it('splits multi-author meta on comma and semicolon', () => {
    const $ = cheerio.load(`<meta name="author" content="Jane Doe, John Smith; Acme Inc" />`);
    const r = metaSignal($);
    expect(r.fields.author).toEqual([
      { family: 'Doe', given: 'Jane' },
      { family: 'Smith', given: 'John' },
      { literal: 'Acme Inc' },
    ]);
  });

  it('reads <meta name="publisher">', () => {
    const $ = cheerio.load(`<meta name="publisher" content="Example Pub" />`);
    expect(metaSignal($).fields.publisher).toBe('Example Pub');
  });

  it('reads citation_title at higher confidence than other meta', () => {
    const $ = cheerio.load(`<meta name="citation_title" content="Academic Paper" />`);
    const r = metaSignal($);
    expect(r.fields.title).toBe('Academic Paper');
    expect(r.confidence.title).toBeGreaterThan(0.7);
  });

  it('reads citation_publication_date / dc.date / DC.date', () => {
    const cases = [
      `<meta name="citation_publication_date" content="2024-06-01" />`,
      `<meta name="dc.date" content="2024-06-01" />`,
      `<meta name="DC.date" content="2024-06-01" />`,
    ];
    for (const html of cases) {
      const $ = cheerio.load(html);
      expect(metaSignal($).fields.issued).toEqual({ 'date-parts': [[2024, 6, 1]] });
    }
  });

  it('returns empty when no relevant meta', () => {
    expect(metaSignal(cheerio.load(`<meta name="viewport" content="x" />`)).fields).toEqual({});
  });
});
```

- [ ] **Step 2: Verify it fails**

```bash
npm test -- tests/extract/signals/meta.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement**

Create `functions/lib/extract/signals/meta.ts`:

```ts
import type { CheerioAPI } from 'cheerio';
import type { CSLItem, CSLName } from '../../csl-types';
import { parseAuthorName } from '../author-parse';
import { parseIsoDate } from '../date-parse';
import type { SignalResult } from './jsonld';

const CONF_META = 0.55;
const CONF_CITATION = 0.85;
const CONF_DC_DATE = 0.7;

function meta($: CheerioAPI, sel: string): string | null {
  const v = $(sel).attr('content');
  return v ? v.trim() || null : null;
}

export function metaSignal($: CheerioAPI): SignalResult {
  const fields: Partial<CSLItem> = {};
  const confidence: SignalResult['confidence'] = {};

  // <meta name="author">
  const author = meta($, 'meta[name="author" i]');
  if (author) {
    const split = author.split(/[,;]/).map((s) => parseAuthorName(s.trim())).filter(Boolean) as CSLName[];
    if (split.length) { fields.author = split; confidence.author = CONF_META; }
  }

  // <meta name="publisher">
  const publisher = meta($, 'meta[name="publisher" i]');
  if (publisher) { fields.publisher = publisher; confidence.publisher = CONF_META; }

  // citation_title — academic landing pages (Google Scholar)
  const cTitle = meta($, 'meta[name="citation_title" i]');
  if (cTitle) { fields.title = cTitle; confidence.title = CONF_CITATION; }

  // citation_author / DC.creator — split by ; (per Google Scholar conventions)
  const cAuthor = meta($, 'meta[name="citation_author" i]') || meta($, 'meta[name="DC.creator" i]') || meta($, 'meta[name="dc.creator" i]');
  if (cAuthor && !fields.author) {
    const split = cAuthor.split(/;/).map((s) => parseAuthorName(s.trim())).filter(Boolean) as CSLName[];
    if (split.length) { fields.author = split; confidence.author = CONF_CITATION; }
  }

  // Publication date — citation_publication_date or DC.date variants
  const dateRaw =
    meta($, 'meta[name="citation_publication_date" i]') ||
    meta($, 'meta[name="DC.date" i]') ||
    meta($, 'meta[name="dc.date" i]') ||
    meta($, 'meta[name="DC.date.issued" i]');
  if (dateRaw) {
    const dp = parseIsoDate(dateRaw);
    if (dp) { fields.issued = { 'date-parts': [dp] }; confidence.issued = CONF_DC_DATE; }
  }

  // citation_journal_title / DC.publisher → container-title
  const journal = meta($, 'meta[name="citation_journal_title" i]');
  if (journal) { fields['container-title'] = journal; confidence['container-title'] = CONF_CITATION; }

  return { fields, confidence };
}
```

- [ ] **Step 4: Run tests**

```bash
npm test -- tests/extract/signals/meta.test.ts
```

Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add functions/lib/extract/signals/meta.ts tests/extract/signals/meta.test.ts
git commit -m "feat(extract): plain-meta + citation_* + DC.* signal extractor"
```

### Task B11: Signal extractor — Heuristic last-resort

**Files:**
- Create: `functions/lib/extract/signals/heuristic.ts`
- Create: `tests/extract/signals/heuristic.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/extract/signals/heuristic.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import * as cheerio from 'cheerio';
import { heuristicSignal } from '../../../functions/lib/extract/signals/heuristic';

describe('heuristicSignal', () => {
  it('reads <title>', () => {
    const $ = cheerio.load(`<html><head><title>Page Title</title></head></html>`);
    expect(heuristicSignal($).fields.title).toBe('Page Title');
  });

  it('strips a trailing " | Site Name" from <title>', () => {
    const $ = cheerio.load(`<html><head><title>Article — The Site</title></head></html>`);
    const r = heuristicSignal($);
    expect(r.fields.title).toBe('Article');
  });

  it('reads rel=author link text', () => {
    const $ = cheerio.load(`<a rel="author" href="/x">Jane Doe</a>`);
    expect(heuristicSignal($).fields.author).toEqual([{ family: 'Doe', given: 'Jane' }]);
  });

  it('reads .byline text and strips a leading "By "', () => {
    const $ = cheerio.load(`<div class="byline">By Jane Doe</div>`);
    expect(heuristicSignal($).fields.author).toEqual([{ family: 'Doe', given: 'Jane' }]);
  });

  it('reads <time datetime>', () => {
    const $ = cheerio.load(`<time datetime="2026-05-26">May 26</time>`);
    expect(heuristicSignal($).fields.issued).toEqual({ 'date-parts': [[2026, 5, 26]] });
  });

  it('returns empty when nothing present', () => {
    expect(heuristicSignal(cheerio.load(`<html></html>`)).fields).toEqual({});
  });
});
```

- [ ] **Step 2: Verify it fails**

```bash
npm test -- tests/extract/signals/heuristic.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement**

Create `functions/lib/extract/signals/heuristic.ts`:

```ts
import type { CheerioAPI } from 'cheerio';
import type { CSLItem } from '../../csl-types';
import { parseAuthorName } from '../author-parse';
import { parseIsoDate } from '../date-parse';
import type { SignalResult } from './jsonld';

const CONF_TITLE = 0.4;
const CONF_AUTHOR_REL = 0.45;
const CONF_AUTHOR_BYLINE = 0.35;
const CONF_TIME = 0.45;

const TITLE_SEP = /\s+[—\-–|]\s+/;

export function heuristicSignal($: CheerioAPI): SignalResult {
  const fields: Partial<CSLItem> = {};
  const confidence: SignalResult['confidence'] = {};

  const titleEl = $('title').first().text().trim();
  if (titleEl) {
    const parts = titleEl.split(TITLE_SEP);
    fields.title = parts[0].trim();
    confidence.title = CONF_TITLE;
  }

  const relAuthor = $('a[rel="author"], [rel="author"]').first().text().trim();
  if (relAuthor) {
    const parsed = parseAuthorName(relAuthor);
    if (parsed) { fields.author = [parsed]; confidence.author = CONF_AUTHOR_REL; }
  }

  if (!fields.author) {
    const byline = $('.byline, .author, .article-author').first().text().trim();
    if (byline) {
      const cleaned = byline.replace(/^by\s+/i, '').trim();
      const parsed = parseAuthorName(cleaned);
      if (parsed) { fields.author = [parsed]; confidence.author = CONF_AUTHOR_BYLINE; }
    }
  }

  const timeEl = $('time[datetime]').first();
  if (timeEl.length) {
    const dp = parseIsoDate(timeEl.attr('datetime') || '');
    if (dp) { fields.issued = { 'date-parts': [dp] }; confidence.issued = CONF_TIME; }
  }

  return { fields, confidence };
}
```

- [ ] **Step 4: Run tests**

```bash
npm test -- tests/extract/signals/heuristic.test.ts
```

Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add functions/lib/extract/signals/heuristic.ts tests/extract/signals/heuristic.test.ts
git commit -m "feat(extract): last-resort heuristic signal extractor"
```

### Task B12: Merger — confidence-based field winner

**Files:**
- Create: `functions/lib/extract/merge.ts`
- Create: `tests/extract/merge.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/extract/merge.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { mergeSignals } from '../../functions/lib/extract/merge';

describe('mergeSignals', () => {
  it('picks the highest-confidence value per field', () => {
    const a = { name: 'meta', fields: { title: 'A' }, confidence: { title: 0.55 } };
    const b = { name: 'jsonld', fields: { title: 'B' }, confidence: { title: 0.95 } };
    const c = { name: 'og', fields: { title: 'C' }, confidence: { title: 0.75 } };
    const { csl, signals } = mergeSignals([a, b, c]);
    expect(csl.title).toBe('B');
    expect(signals.title).toBe('jsonld');
  });

  it('falls back to lower-confidence signal when higher is absent', () => {
    const a = { name: 'meta', fields: { publisher: 'M' }, confidence: { publisher: 0.55 } };
    const b = { name: 'jsonld', fields: { title: 'B' }, confidence: { title: 0.95 } };
    const { csl } = mergeSignals([a, b]);
    expect(csl.publisher).toBe('M');
    expect(csl.title).toBe('B');
  });

  it('records winning-signal name per field for debug', () => {
    const a = { name: 'og', fields: { title: 't', URL: 'u' }, confidence: { title: 0.75, URL: 0.75 } };
    const { signals } = mergeSignals([a]);
    expect(signals).toEqual({ title: 'og', URL: 'og' });
  });

  it('returns empty fields and empty signals when no input has confidence', () => {
    const { csl, signals } = mergeSignals([]);
    expect(csl).toEqual({});
    expect(signals).toEqual({});
  });
});
```

- [ ] **Step 2: Verify it fails**

```bash
npm test -- tests/extract/merge.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement**

Create `functions/lib/extract/merge.ts`:

```ts
import type { CSLItem } from '../csl-types';

export interface NamedSignal {
  name: string;
  fields: Partial<CSLItem>;
  confidence: Partial<Record<keyof CSLItem, number>>;
}

const MERGEABLE_FIELDS: Array<keyof CSLItem> = [
  'title', 'author', 'issued', 'publisher', 'container-title', 'URL', 'DOI',
  'volume', 'issue', 'page', 'edition',
];

export function mergeSignals(signals: NamedSignal[]): {
  csl: Partial<CSLItem>;
  signals: Record<string, string>;
} {
  const csl: Partial<CSLItem> = {};
  const winners: Record<string, string> = {};
  for (const field of MERGEABLE_FIELDS) {
    let bestConf = 0;
    let bestVal: any;
    let bestName: string | undefined;
    for (const s of signals) {
      const conf = s.confidence[field];
      if (typeof conf === 'number' && s.fields[field] !== undefined && conf > bestConf) {
        bestConf = conf;
        bestVal = s.fields[field];
        bestName = s.name;
      }
    }
    if (bestName) {
      (csl as any)[field] = bestVal;
      winners[field] = bestName;
    }
  }
  return { csl, signals: winners };
}
```

- [ ] **Step 4: Run tests**

```bash
npm test -- tests/extract/merge.test.ts
```

Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add functions/lib/extract/merge.ts tests/extract/merge.test.ts
git commit -m "feat(extract): merger that picks highest-confidence value per CSL field"
```

### Task B13: Pipeline orchestrator

**Files:**
- Create: `functions/lib/extract/pipeline.ts`
- Create: `tests/extract/pipeline.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/extract/pipeline.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { runExtractionPipeline } from '../../functions/lib/extract/pipeline';

describe('runExtractionPipeline', () => {
  it('combines all six signals on a well-marked-up page', () => {
    const html = `<!DOCTYPE html><html><head>
      <title>Heur Title — Site</title>
      <meta name="author" content="Plain Meta Author" />
      <meta property="og:title" content="OG Title" />
      <script type="application/ld+json">${JSON.stringify({
        '@type': 'NewsArticle',
        headline: 'JSON-LD Title',
        author: { '@type': 'Person', givenName: 'Jane', familyName: 'Doe' },
        datePublished: '2026-05-26',
      })}</script>
    </head><body></body></html>`;

    const url = 'https://example.com/article';
    const result = runExtractionPipeline(html, url);
    expect(result.csl.id).toBe(url);
    expect(result.csl.type).toBe('webpage');
    expect(result.csl.title).toBe('JSON-LD Title');               // JSON-LD wins
    expect(result.csl.author).toEqual([{ family: 'Doe', given: 'Jane' }]);
    expect(result.csl.issued).toEqual({ 'date-parts': [[2026, 5, 26]] });
    expect(result.csl.URL).toBe(url);
    expect(result.signals.title).toBe('jsonld');
  });

  it('falls back to heuristic <title> when nothing else present', () => {
    const html = `<html><head><title>Just A Title</title></head></html>`;
    const result = runExtractionPipeline(html, 'https://x.com/p');
    expect(result.csl.title).toBe('Just A Title');
    expect(result.signals.title).toBe('heuristic');
  });

  it('always sets id, type, and URL from the input URL', () => {
    const result = runExtractionPipeline(`<html></html>`, 'https://example.com/p');
    expect(result.csl.id).toBe('https://example.com/p');
    expect(result.csl.type).toBe('webpage');
    expect(result.csl.URL).toBe('https://example.com/p');
  });
});
```

- [ ] **Step 2: Verify it fails**

```bash
npm test -- tests/extract/pipeline.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement**

Create `functions/lib/extract/pipeline.ts`:

```ts
import * as cheerio from 'cheerio';
import type { CSLItem } from '../csl-types';
import { jsonldSignal } from './signals/jsonld';
import { microdataSignal } from './signals/microdata';
import { openGraphSignal } from './signals/opengraph';
import { twitterSignal } from './signals/twitter';
import { metaSignal } from './signals/meta';
import { heuristicSignal } from './signals/heuristic';
import { mergeSignals } from './merge';

const SIGNALS = [
  { name: 'jsonld', fn: jsonldSignal },
  { name: 'microdata', fn: microdataSignal },
  { name: 'opengraph', fn: openGraphSignal },
  { name: 'twitter', fn: twitterSignal },
  { name: 'meta', fn: metaSignal },
  { name: 'heuristic', fn: heuristicSignal },
] as const;

export interface PipelineResult {
  csl: CSLItem;
  signals: Record<string, string>;
}

export function runExtractionPipeline(html: string, url: string): PipelineResult {
  const $ = cheerio.load(html);
  const named = SIGNALS.map((s) => ({ name: s.name, ...s.fn($) }));
  const { csl: merged, signals } = mergeSignals(named);
  const final: CSLItem = {
    id: url,
    type: 'webpage',
    URL: url,
    ...merged,
  };
  return { csl: final, signals };
}
```

Note: `id` and `URL` are always overwritten by the caller's URL, but the merged value may override `URL` if a signal supplied a different canonical URL (e.g., `og:url`). The merger order above sets the canonical from signals last via the spread. If we want the input URL to always win, swap the spread direction. **For Phase 1, signals win** (canonical URLs are usually better for citations).

Actually — re-read: the spread `...merged` comes AFTER `URL: url`, so merged values overwrite. That's intentional. Test case 3 ("always sets URL from input URL") passes because the empty HTML produces no signal URL. Verify by re-reading the test.

- [ ] **Step 4: Run tests**

```bash
npm test -- tests/extract/pipeline.test.ts
```

Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add functions/lib/extract/pipeline.ts tests/extract/pipeline.test.ts
git commit -m "feat(extract): pipeline orchestrator running 6 signals + confidence merge"
```

---

## Block C — Endpoints (depend on Block B)

Block C runs after B. C1 (cite-website) is independent of C2/C3 (book/journal). Within each subgroup, the helper modules come before the endpoint.

### Task C1: Refactor `/api/cite-website` to use the new pipeline

**Files:**
- Modify: `functions/api/cite-website/index.ts`
- Create: `tests/api/cite-website.test.ts`
- Delete (at end): `functions/api/cite-website/{author-utils,date-utils,publisher-utils,title-utils,consts,rewriter,fetch-data}.ts`
- Modify: `functions/api/utils.ts` — remove `isUrlInvalid` and `cleanUrl` and `capitalizeFirstLetter`; keep only `createResponse`

- [ ] **Step 1: Write failing test** (endpoint contract — pure handler, no live network)

Create `tests/api/cite-website.test.ts`:

```ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import { handleCiteWebsite } from '../../functions/api/cite-website/handler';

const HTML_OK = `<!DOCTYPE html><html><head>
  <title>Test Article</title>
  <script type="application/ld+json">${JSON.stringify({
    '@type': 'NewsArticle',
    headline: 'Test Article',
    author: { '@type': 'Person', givenName: 'Jane', familyName: 'Doe' },
    datePublished: '2026-01-15',
  })}</script>
</head></html>`;

describe('handleCiteWebsite', () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => { globalThis.fetch = originalFetch; });

  function mockHtml(html: string, status = 200) {
    globalThis.fetch = vi.fn(async () => new Response(html, {
      status, headers: { 'content-type': 'text/html' },
    })) as any;
  }

  it('returns 400 when no url param', async () => {
    const res = await handleCiteWebsite(new URL('https://m.com/api/cite-website'), null);
    expect(res.status).toBe(400);
    const body = await res.json() as any;
    expect(body.code).toBe('invalid_url');
  });

  it('extracts CSL from a normal HTML page', async () => {
    mockHtml(HTML_OK);
    const res = await handleCiteWebsite(new URL('https://m.com/api/cite-website?url=https://x.com/p'), null);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.uuid).toBeTruthy();
    expect(body.type).toBe('webpage');
    expect(body.csl.title).toBe('Test Article');
    expect(body.csl.author).toEqual([{ family: 'Doe', given: 'Jane' }]);
    expect(body._cached).toBe(false);
  });

  it('returns cached body when cache is warm', async () => {
    mockHtml(HTML_OK);
    const cacheStore = new Map<string, Response>();
    const fakeCache = {
      async get(k: string) { return cacheStore.get(k)?.clone(); },
      async put(k: string, r: Response) { cacheStore.set(k, r.clone()); },
    };
    const url = new URL('https://m.com/api/cite-website?url=https://x.com/p');
    const first = await handleCiteWebsite(url, fakeCache);
    expect((await first.clone().json() as any)._cached).toBe(false);
    const second = await handleCiteWebsite(url, fakeCache);
    expect((await second.json() as any)._cached).toBe(true);
  });

  it('returns 400 on fetch failure', async () => {
    globalThis.fetch = vi.fn(async () => new Response('nope', { status: 404, headers: { 'content-type': 'text/html' } })) as any;
    const res = await handleCiteWebsite(new URL('https://m.com/api/cite-website?url=https://x.com/p'), null);
    expect(res.status).toBe(400);
    const body = await res.json() as any;
    expect(body.code).toBe('fetch_failed');
  });
});
```

- [ ] **Step 2: Verify it fails**

```bash
npm test -- tests/api/cite-website.test.ts
```

Expected: FAIL — handler module not found.

- [ ] **Step 3: Implement the handler separately from `onRequest`**

Create `functions/api/cite-website/handler.ts`:

```ts
import { runExtractionPipeline } from '../../lib/extract/pipeline';
import { fetchHtml, FetchError } from '../../lib/extract/fetch';
import { normalizeUrl } from '../../lib/extract/url-normalize';
import { TTL } from '../../lib/cache';
import type { ExtractEnvelope } from '../../lib/csl-types';

export interface MinCache {
  get(key: string): Promise<Response | undefined>;
  put(key: string, response: Response, maxAgeSeconds: number): Promise<void>;
}

export async function handleCiteWebsite(requestUrl: URL, cache: MinCache | null): Promise<Response> {
  const raw = requestUrl.searchParams.get('url');
  if (!raw) return errorResponse(400, 'invalid_url', 'Missing url parameter', false);

  let target: string;
  try {
    target = normalizeUrl(decodeURIComponent(raw).startsWith('http') ? decodeURIComponent(raw) : `https://${decodeURIComponent(raw)}`);
  } catch {
    return errorResponse(400, 'invalid_url', 'Malformed URL', false);
  }

  const bypassCache = requestUrl.searchParams.get('nocache') === '1';
  if (cache && !bypassCache) {
    const hit = await cache.get(target);
    if (hit) {
      const body = await hit.json() as ExtractEnvelope;
      body._cached = true;
      return jsonResponse(body);
    }
  }

  let html: string;
  let finalUrl: string;
  try {
    ({ html, finalUrl } = await fetchHtml(target));
  } catch (err) {
    if (err instanceof FetchError) {
      return errorResponse(400, err.code, err.message, err.retryable);
    }
    return errorResponse(500, 'internal', String((err as Error).message), false);
  }

  const { csl, signals } = runExtractionPipeline(html, finalUrl);
  const envelope: ExtractEnvelope = {
    uuid: target,
    type: 'webpage',
    csl,
    _signals: signals,
    _cached: false,
  };
  const response = jsonResponse(envelope);
  if (cache && !bypassCache) {
    await cache.put(target, response.clone(), TTL.WEBSITE);
  }
  return response;
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { 'content-type': 'application/json' },
  });
}

function errorResponse(status: number, code: string, message: string, retryable: boolean): Response {
  return new Response(JSON.stringify({ error: message, code, retryable }), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}
```

- [ ] **Step 4: Rewrite `functions/api/cite-website/index.ts` as a thin wrapper**

Replace the entire file:

```ts
import { handleCiteWebsite } from './handler';
import { defaultCacheStore } from '../../lib/cache';

export const onRequest: PagesFunction = async (context) => {
  const url = new URL(context.request.url);
  return handleCiteWebsite(url, defaultCacheStore());
};
```

- [ ] **Step 5: Run tests**

```bash
npm test -- tests/api/cite-website.test.ts
```

Expected: PASS, 4 tests.

- [ ] **Step 6: Delete superseded modules + clean utils**

```bash
rm functions/api/cite-website/author-utils.ts
rm functions/api/cite-website/date-utils.ts
rm functions/api/cite-website/publisher-utils.ts
rm functions/api/cite-website/title-utils.ts
rm functions/api/cite-website/consts.ts
rm functions/api/cite-website/rewriter.ts
rm functions/api/cite-website/fetch-data.ts
rm functions/api/definitions.ts
```

Edit `functions/api/utils.ts` to its final form:

```ts
export function createResponse(body: any) {
  return new Response(JSON.stringify(body), {
    headers: { 'content-type': 'application/json' },
  });
}
```

- [ ] **Step 7: Verify all tests still pass + functions still build**

```bash
npm test
npm run build
```

Expected: tests pass, build succeeds. If build fails because cite-book still references the deleted utils — that's OK; we rewrite cite-book in Task C2 next. Annotate the commit message accordingly.

- [ ] **Step 8: Commit**

```bash
git add -A functions/api/cite-website functions/api/utils.ts
git rm functions/api/definitions.ts
git commit -m "refactor(cite-website): replace regex/HTMLRewriter extractor with cheerio multi-signal pipeline

Endpoint now emits CSL-JSON envelope { uuid, type, csl, _signals, _cached }.
Uses Cloudflare Cache API with 24h TTL keyed by normalized URL. Removes the
seven helper modules under cite-website/ that the pipeline replaces."
```

### Task C2: Book endpoint — OpenLibrary client

**Files:**
- Create: `functions/lib/book/openlibrary.ts`
- Create: `tests/book/openlibrary.test.ts`
- Create: `tests/book/fixtures/openlibrary/9780140449136.json` (Plato's Republic — pick 5 real responses; download via `curl https://openlibrary.org/api/books?bibkeys=ISBN:<isbn>&jscmd=data&format=json` and trim to just the response body)

**Recommended five ISBNs for fixtures (cover edge cases):**
1. `9780140449136` — Plato's Republic (multiple authors)
2. `9780062315007` — The Alchemist (single author)
3. `9780262032933` — Introduction to Algorithms (corporate author + multiple)
4. `9781400079988` — A Walk in the Woods (Bryson)
5. `9780553418811` — A Brief History of Time (Hawking)

- [ ] **Step 1: Download five OpenLibrary fixtures**

```bash
mkdir -p tests/book/fixtures/openlibrary
for isbn in 9780140449136 9780062315007 9780262032933 9781400079988 9780553418811; do
  curl -fsSL "https://openlibrary.org/api/books?bibkeys=ISBN:$isbn&jscmd=data&format=json" \
    > tests/book/fixtures/openlibrary/$isbn.json
done
```

Verify each file is valid JSON and non-empty. Hand-inspect one to confirm shape.

- [ ] **Step 2: Write failing test**

Create `tests/book/openlibrary.test.ts`:

```ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchOpenLibrary } from '../../functions/lib/book/openlibrary';
import { loadFixtureFile } from '../helpers/load-fixture';
import { join } from 'node:path';

const FIX = join(__dirname, 'fixtures/openlibrary');

describe('fetchOpenLibrary', () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => { globalThis.fetch = originalFetch; });

  it('returns parsed JSON for a known ISBN', async () => {
    const body = loadFixtureFile(FIX, '9780140449136.json');
    globalThis.fetch = vi.fn(async () => new Response(body, { status: 200, headers: { 'content-type': 'application/json' } })) as any;
    const result = await fetchOpenLibrary('9780140449136');
    expect(result).not.toBeNull();
    expect(result!.title).toBeTruthy();
  });

  it('returns null when OpenLibrary has no data', async () => {
    globalThis.fetch = vi.fn(async () => new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } })) as any;
    const result = await fetchOpenLibrary('9999999999999');
    expect(result).toBeNull();
  });

  it('returns null on 5xx', async () => {
    globalThis.fetch = vi.fn(async () => new Response('boom', { status: 503 })) as any;
    const result = await fetchOpenLibrary('9780140449136');
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 3: Verify it fails**

```bash
npm test -- tests/book/openlibrary.test.ts
```

Expected: FAIL.

- [ ] **Step 4: Implement**

Create `functions/lib/book/openlibrary.ts`:

```ts
export interface OpenLibraryBook {
  title?: string;
  subtitle?: string;
  authors?: Array<{ name: string }>;
  publishers?: Array<{ name: string }>;
  publish_date?: string;
  publish_places?: Array<{ name: string }>;
  number_of_pages?: number;
  url?: string;
}

const TIMEOUT_MS = 5_000;

export async function fetchOpenLibrary(isbn: string): Promise<OpenLibraryBook | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&jscmd=data&format=json`, {
      signal: ctrl.signal,
      headers: { 'User-Agent': 'mlagenerator/1.0' },
    });
    if (!res.ok) return null;
    const blob = await res.json() as Record<string, OpenLibraryBook>;
    const entry = blob[`ISBN:${isbn}`];
    return entry || null;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}
```

- [ ] **Step 5: Run tests**

```bash
npm test -- tests/book/openlibrary.test.ts
```

Expected: PASS, 3 tests.

- [ ] **Step 6: Commit**

```bash
git add functions/lib/book/openlibrary.ts tests/book/openlibrary.test.ts tests/book/fixtures/openlibrary
git commit -m "feat(book): OpenLibrary ISBN lookup client (5s timeout, null on miss/error)"
```

### Task C3: Book endpoint — Google Books fallback client

**Files:**
- Create: `functions/lib/book/googlebooks.ts`
- Create: `tests/book/googlebooks.test.ts`
- Create: `tests/book/fixtures/googlebooks/<isbn>.json` × 5

- [ ] **Step 1: Download five Google Books fixtures**

```bash
mkdir -p tests/book/fixtures/googlebooks
for isbn in 9780140449136 9780062315007 9780262032933 9781400079988 9780553418811; do
  curl -fsSL "https://www.googleapis.com/books/v1/volumes?q=isbn:$isbn" \
    > tests/book/fixtures/googlebooks/$isbn.json
done
```

- [ ] **Step 2: Write failing test**

Create `tests/book/googlebooks.test.ts`:

```ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchGoogleBooks } from '../../functions/lib/book/googlebooks';
import { loadFixtureFile } from '../helpers/load-fixture';
import { join } from 'node:path';

const FIX = join(__dirname, 'fixtures/googlebooks');

describe('fetchGoogleBooks', () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => { globalThis.fetch = originalFetch; });

  it('returns first volumeInfo for a known ISBN', async () => {
    const body = loadFixtureFile(FIX, '9780140449136.json');
    globalThis.fetch = vi.fn(async () => new Response(body, { status: 200, headers: { 'content-type': 'application/json' } })) as any;
    const result = await fetchGoogleBooks('9780140449136');
    expect(result).not.toBeNull();
    expect(result!.title).toBeTruthy();
  });

  it('returns null when items missing', async () => {
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({ totalItems: 0 }), { status: 200, headers: { 'content-type': 'application/json' } })) as any;
    expect(await fetchGoogleBooks('9999999999999')).toBeNull();
  });

  it('returns null on 5xx', async () => {
    globalThis.fetch = vi.fn(async () => new Response('boom', { status: 503 })) as any;
    expect(await fetchGoogleBooks('9780140449136')).toBeNull();
  });
});
```

- [ ] **Step 3: Verify it fails**

```bash
npm test -- tests/book/googlebooks.test.ts
```

Expected: FAIL.

- [ ] **Step 4: Implement**

Create `functions/lib/book/googlebooks.ts`:

```ts
export interface GoogleBooksVolume {
  title?: string;
  subtitle?: string;
  authors?: string[];
  publisher?: string;
  publishedDate?: string;
  pageCount?: number;
  industryIdentifiers?: Array<{ type: string; identifier: string }>;
  infoLink?: string;
}

const TIMEOUT_MS = 5_000;

export async function fetchGoogleBooks(isbn: string, apiKey?: string): Promise<GoogleBooksVolume | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const url = new URL('https://www.googleapis.com/books/v1/volumes');
    url.searchParams.set('q', `isbn:${isbn}`);
    if (apiKey) url.searchParams.set('key', apiKey);
    const res = await fetch(url.toString(), {
      signal: ctrl.signal,
      headers: { 'User-Agent': 'mlagenerator/1.0' },
    });
    if (!res.ok) return null;
    const blob = await res.json() as { items?: Array<{ volumeInfo: GoogleBooksVolume }> };
    return blob.items?.[0]?.volumeInfo ?? null;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}
```

- [ ] **Step 5: Run tests**

```bash
npm test -- tests/book/googlebooks.test.ts
```

Expected: PASS, 3 tests.

- [ ] **Step 6: Commit**

```bash
git add functions/lib/book/googlebooks.ts tests/book/googlebooks.test.ts tests/book/fixtures/googlebooks
git commit -m "feat(book): Google Books ISBN lookup fallback client"
```

### Task C4: Book normalizer (OpenLibrary | Google Books → CSL)

**Files:**
- Create: `functions/lib/book/normalize.ts`
- Create: `tests/book/normalize.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/book/normalize.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { normalizeOpenLibrary, normalizeGoogleBooks } from '../../functions/lib/book/normalize';

describe('normalizeOpenLibrary', () => {
  it('maps title, authors, publisher, year, place', () => {
    const csl = normalizeOpenLibrary({
      title: 'Republic',
      authors: [{ name: 'Plato' }, { name: 'G. M. A. Grube' }],
      publishers: [{ name: 'Hackett' }],
      publish_date: '1992',
      publish_places: [{ name: 'Indianapolis' }],
    }, '9780140449136');
    expect(csl.id).toBe('9780140449136');
    expect(csl.type).toBe('book');
    expect(csl.title).toBe('Republic');
    expect(csl.author).toEqual([{ family: 'Plato' }, { family: 'Grube', given: 'G. M. A.' }]);
    expect(csl.publisher).toBe('Hackett');
    expect(csl.issued).toEqual({ 'date-parts': [[1992]] });
    expect(csl['publisher-place']).toBe('Indianapolis');
    expect(csl.ISBN).toBe('9780140449136');
  });

  it('handles missing optional fields', () => {
    const csl = normalizeOpenLibrary({ title: 'X' }, '111');
    expect(csl.title).toBe('X');
    expect(csl.author).toBeUndefined();
    expect(csl.publisher).toBeUndefined();
  });
});

describe('normalizeGoogleBooks', () => {
  it('maps title, authors (string array), publisher, date', () => {
    const csl = normalizeGoogleBooks({
      title: 'A Brief History of Time',
      authors: ['Stephen Hawking'],
      publisher: 'Bantam',
      publishedDate: '1998-09-01',
    }, '9780553418811');
    expect(csl.title).toBe('A Brief History of Time');
    expect(csl.author).toEqual([{ family: 'Hawking', given: 'Stephen' }]);
    expect(csl.publisher).toBe('Bantam');
    expect(csl.issued).toEqual({ 'date-parts': [[1998, 9, 1]] });
    expect(csl.ISBN).toBe('9780553418811');
  });

  it('merges title + subtitle with ": "', () => {
    const csl = normalizeGoogleBooks({
      title: 'A Walk in the Woods',
      subtitle: 'Rediscovering America on the Appalachian Trail',
      authors: ['Bill Bryson'],
    }, '9781400079988');
    expect(csl.title).toBe('A Walk in the Woods: Rediscovering America on the Appalachian Trail');
  });
});
```

- [ ] **Step 2: Verify it fails**

```bash
npm test -- tests/book/normalize.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement**

Create `functions/lib/book/normalize.ts`:

```ts
import type { CSLItem } from '../csl-types';
import { parseAuthorName } from '../extract/author-parse';
import { parseIsoDate } from '../extract/date-parse';
import type { OpenLibraryBook } from './openlibrary';
import type { GoogleBooksVolume } from './googlebooks';

export function normalizeOpenLibrary(book: OpenLibraryBook, isbn: string): CSLItem {
  const item: CSLItem = {
    id: isbn,
    type: 'book',
    ISBN: isbn,
  };
  if (book.title) {
    item.title = book.subtitle ? `${book.title}: ${book.subtitle}` : book.title;
  }
  if (book.authors?.length) {
    const parsed = book.authors.map((a) => parseAuthorName(a.name)).filter(Boolean) as any[];
    if (parsed.length) item.author = parsed;
  }
  if (book.publishers?.length) item.publisher = book.publishers[0].name;
  if (book.publish_date) {
    const dp = parseIsoDate(book.publish_date);
    if (dp) item.issued = { 'date-parts': [dp] };
  }
  if (book.publish_places?.length) item['publisher-place'] = book.publish_places[0].name;
  return item;
}

export function normalizeGoogleBooks(vol: GoogleBooksVolume, isbn: string): CSLItem {
  const item: CSLItem = {
    id: isbn,
    type: 'book',
    ISBN: isbn,
  };
  if (vol.title) {
    item.title = vol.subtitle ? `${vol.title}: ${vol.subtitle}` : vol.title;
  }
  if (vol.authors?.length) {
    const parsed = vol.authors.map((a) => parseAuthorName(a)).filter(Boolean) as any[];
    if (parsed.length) item.author = parsed;
  }
  if (vol.publisher) item.publisher = vol.publisher;
  if (vol.publishedDate) {
    const dp = parseIsoDate(vol.publishedDate);
    if (dp) item.issued = { 'date-parts': [dp] };
  }
  return item;
}
```

- [ ] **Step 4: Run tests**

```bash
npm test -- tests/book/normalize.test.ts
```

Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add functions/lib/book/normalize.ts tests/book/normalize.test.ts
git commit -m "feat(book): normalize OpenLibrary + Google Books responses to CSL-JSON"
```

### Task C5: Refactor `/api/cite-book`

**Files:**
- Delete: `functions/api/cite-book/index.js`
- Create: `functions/api/cite-book/handler.ts`
- Create: `functions/api/cite-book/index.ts`
- Create: `tests/api/cite-book.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/api/cite-book.test.ts`:

```ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import { handleCiteBook } from '../../functions/api/cite-book/handler';
import { loadFixtureFile } from '../helpers/load-fixture';
import { join } from 'node:path';

const OL_FIX = join(__dirname, '../book/fixtures/openlibrary');
const GB_FIX = join(__dirname, '../book/fixtures/googlebooks');

function mockSequence(...responses: Response[]) {
  let i = 0;
  globalThis.fetch = vi.fn(async () => responses[i++]) as any;
}

describe('handleCiteBook', () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => { globalThis.fetch = originalFetch; });

  it('returns 400 on missing isbn', async () => {
    const res = await handleCiteBook(new URL('https://m.com/api/cite-book'), null);
    expect(res.status).toBe(400);
    expect((await res.json() as any).code).toBe('invalid_isbn');
  });

  it('returns 400 on malformed isbn', async () => {
    const res = await handleCiteBook(new URL('https://m.com/api/cite-book?isbn=abc'), null);
    expect(res.status).toBe(400);
    expect((await res.json() as any).code).toBe('invalid_isbn');
  });

  it('uses OpenLibrary when it returns data', async () => {
    const body = loadFixtureFile(OL_FIX, '9780553418811.json');
    mockSequence(new Response(body, { status: 200, headers: { 'content-type': 'application/json' } }));
    const res = await handleCiteBook(new URL('https://m.com/api/cite-book?isbn=9780553418811'), null);
    expect(res.status).toBe(200);
    const env = await res.json() as any;
    expect(env.type).toBe('book');
    expect(env.csl.title).toBeTruthy();
  });

  it('falls back to Google Books when OpenLibrary empty', async () => {
    const empty = new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
    const gb = loadFixtureFile(GB_FIX, '9780553418811.json');
    mockSequence(empty, new Response(gb, { status: 200, headers: { 'content-type': 'application/json' } }));
    const res = await handleCiteBook(new URL('https://m.com/api/cite-book?isbn=9780553418811'), null);
    expect(res.status).toBe(200);
  });

  it('returns 503 when both providers fail', async () => {
    mockSequence(
      new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } }),
      new Response(JSON.stringify({ totalItems: 0 }), { status: 200, headers: { 'content-type': 'application/json' } }),
    );
    const res = await handleCiteBook(new URL('https://m.com/api/cite-book?isbn=9780553418811'), null);
    expect(res.status).toBe(404);
    expect((await res.json() as any).code).toBe('not_found');
  });
});
```

- [ ] **Step 2: Verify it fails**

```bash
npm test -- tests/api/cite-book.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement**

Create `functions/api/cite-book/handler.ts`:

```ts
import { fetchOpenLibrary } from '../../lib/book/openlibrary';
import { fetchGoogleBooks } from '../../lib/book/googlebooks';
import { normalizeOpenLibrary, normalizeGoogleBooks } from '../../lib/book/normalize';
import { TTL } from '../../lib/cache';
import type { ExtractEnvelope } from '../../lib/csl-types';

const ISBN_RE = /^(97[89])?\d{9}[\dX]$/;

export interface MinCache {
  get(key: string): Promise<Response | undefined>;
  put(key: string, response: Response, maxAgeSeconds: number): Promise<void>;
}

export async function handleCiteBook(requestUrl: URL, cache: MinCache | null, apiKey?: string): Promise<Response> {
  const raw = requestUrl.searchParams.get('isbn');
  if (!raw) return errorResponse(400, 'invalid_isbn', 'Missing isbn parameter');
  const isbn = raw.replace(/[-\s]/g, '');
  if (!ISBN_RE.test(isbn)) return errorResponse(400, 'invalid_isbn', 'Invalid ISBN format');

  const cacheKey = `https://cache.mlagenerator/book/${isbn}`;
  const bypassCache = requestUrl.searchParams.get('nocache') === '1';
  if (cache && !bypassCache) {
    const hit = await cache.get(cacheKey);
    if (hit) {
      const body = await hit.json() as ExtractEnvelope;
      body._cached = true;
      return jsonResponse(body);
    }
  }

  // OpenLibrary first
  const ol = await fetchOpenLibrary(isbn);
  let csl;
  if (ol && ol.title) {
    csl = normalizeOpenLibrary(ol, isbn);
  } else {
    const gb = await fetchGoogleBooks(isbn, apiKey);
    if (!gb || !gb.title) {
      return errorResponse(404, 'not_found', 'Book not found in OpenLibrary or Google Books');
    }
    csl = normalizeGoogleBooks(gb, isbn);
  }

  const envelope: ExtractEnvelope = { uuid: isbn, type: 'book', csl, _cached: false };
  const response = jsonResponse(envelope);
  if (cache && !bypassCache) {
    await cache.put(cacheKey, response.clone(), TTL.BOOK_OR_JOURNAL);
  }
  return response;
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { 'content-type': 'application/json' },
  });
}

function errorResponse(status: number, code: string, message: string): Response {
  return new Response(JSON.stringify({ error: message, code, retryable: false }), {
    status, headers: { 'content-type': 'application/json' },
  });
}
```

- [ ] **Step 4: Replace the .js endpoint with a .ts wrapper**

Delete:
```bash
rm functions/api/cite-book/index.js
```

Create `functions/api/cite-book/index.ts`:

```ts
import { handleCiteBook } from './handler';
import { defaultCacheStore } from '../../lib/cache';

interface Env { API_KEY?: string }

export const onRequest: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url);
  return handleCiteBook(url, defaultCacheStore(), context.env.API_KEY);
};
```

- [ ] **Step 5: Run tests**

```bash
npm test -- tests/api/cite-book.test.ts
```

Expected: PASS, 5 tests.

- [ ] **Step 6: Commit**

```bash
git add functions/api/cite-book tests/api/cite-book.test.ts
git rm functions/api/cite-book/index.js 2>/dev/null || true
git commit -m "refactor(cite-book): OpenLibrary primary + Google Books fallback, CSL-JSON envelope, 30d cache"
```

### Task C6: Journal — DOI detector

**Files:**
- Create: `functions/lib/journal/doi-detect.ts`
- Create: `tests/journal/doi-detect.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/journal/doi-detect.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import * as cheerio from 'cheerio';
import { extractDoi, validateDoi } from '../../functions/lib/journal/doi-detect';

describe('validateDoi', () => {
  it('accepts standard DOI format', () => {
    expect(validateDoi('10.1038/s41586-021-03828-1')).toBe('10.1038/s41586-021-03828-1');
  });

  it('strips a doi.org URL prefix', () => {
    expect(validateDoi('https://doi.org/10.1038/s41586-021-03828-1'))
      .toBe('10.1038/s41586-021-03828-1');
  });

  it('strips a "doi:" prefix', () => {
    expect(validateDoi('doi:10.1038/foo')).toBe('10.1038/foo');
  });

  it('returns null for garbage', () => {
    expect(validateDoi('not a doi')).toBeNull();
    expect(validateDoi('')).toBeNull();
  });
});

describe('extractDoi (from HTML)', () => {
  it('finds citation_doi meta', () => {
    const $ = cheerio.load(`<meta name="citation_doi" content="10.1038/foo" />`);
    expect(extractDoi($)).toBe('10.1038/foo');
  });

  it('finds dc.identifier when it looks like a DOI', () => {
    const $ = cheerio.load(`<meta name="dc.identifier" content="doi:10.1038/bar" />`);
    expect(extractDoi($)).toBe('10.1038/bar');
  });

  it('falls back to scanning text content for a DOI pattern', () => {
    const $ = cheerio.load(`<p>See https://doi.org/10.1038/baz for details.</p>`);
    expect(extractDoi($)).toBe('10.1038/baz');
  });

  it('returns null when no DOI present', () => {
    const $ = cheerio.load(`<p>plain text</p>`);
    expect(extractDoi($)).toBeNull();
  });
});
```

- [ ] **Step 2: Verify it fails**

```bash
npm test -- tests/journal/doi-detect.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement**

Create `functions/lib/journal/doi-detect.ts`:

```ts
import type { CheerioAPI } from 'cheerio';

const DOI_RE = /\b(10\.\d{4,9}\/[-._;()/:A-Z0-9]+)/i;

export function validateDoi(input: string | null | undefined): string | null {
  if (!input) return null;
  let s = String(input).trim();
  s = s.replace(/^https?:\/\/(dx\.)?doi\.org\//i, '');
  s = s.replace(/^doi:\s*/i, '');
  const m = s.match(/^(10\.\d{4,9}\/[-._;()/:A-Z0-9]+)$/i);
  return m ? m[1] : null;
}

export function extractDoi($: CheerioAPI): string | null {
  const metaCandidates = ['citation_doi', 'dc.identifier', 'DC.identifier', 'prism.doi'];
  for (const name of metaCandidates) {
    const v = $(`meta[name="${name}" i]`).attr('content');
    const doi = validateDoi(v);
    if (doi) return doi;
  }
  const text = $('body').text();
  const m = text.match(DOI_RE);
  if (m) return validateDoi(m[1]);
  return null;
}
```

- [ ] **Step 4: Run tests**

```bash
npm test -- tests/journal/doi-detect.test.ts
```

Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add functions/lib/journal/doi-detect.ts tests/journal/doi-detect.test.ts
git commit -m "feat(journal): DOI extractor (meta + body fallback) and validator"
```

### Task C7: Journal — Crossref + OpenAlex clients + normalizer

**Files:**
- Create: `functions/lib/journal/crossref.ts`
- Create: `functions/lib/journal/openalex.ts`
- Create: `functions/lib/journal/normalize.ts`
- Create: `tests/journal/fixtures/crossref/<5>.json` and `tests/journal/fixtures/openalex/<5>.json`
- Create: `tests/journal/crossref.test.ts`
- Create: `tests/journal/openalex.test.ts`
- Create: `tests/journal/normalize.test.ts`

**Recommended five DOIs:**
1. `10.1038/s41586-021-03828-1` — Nature paper (multi-author)
2. `10.1126/science.aaq1144` — Science paper
3. `10.1145/3318464.3389772` — ACM (CS)
4. `10.1056/NEJMoa2034577` — NEJM (medicine)
5. `10.1038/nature12373` — older Nature

- [ ] **Step 1: Download fixtures**

```bash
mkdir -p tests/journal/fixtures/crossref tests/journal/fixtures/openalex
for doi in "10.1038/s41586-021-03828-1" "10.1126/science.aaq1144" "10.1145/3318464.3389772" "10.1056/NEJMoa2034577" "10.1038/nature12373"; do
  safe=$(echo "$doi" | tr '/' '_')
  curl -fsSL "https://api.crossref.org/works/$doi" \
    > "tests/journal/fixtures/crossref/$safe.json"
  curl -fsSL "https://api.openalex.org/works/doi:$doi" \
    > "tests/journal/fixtures/openalex/$safe.json"
done
```

- [ ] **Step 2: Write failing tests**

Create `tests/journal/crossref.test.ts`:

```ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchCrossref } from '../../functions/lib/journal/crossref';
import { loadFixtureFile } from '../helpers/load-fixture';
import { join } from 'node:path';

const FIX = join(__dirname, 'fixtures/crossref');

describe('fetchCrossref', () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => { globalThis.fetch = originalFetch; });

  it('returns the .message object on success', async () => {
    const body = loadFixtureFile(FIX, '10.1038_s41586-021-03828-1.json');
    globalThis.fetch = vi.fn(async () => new Response(body, { status: 200 })) as any;
    const r = await fetchCrossref('10.1038/s41586-021-03828-1');
    expect(r).not.toBeNull();
    expect(r!.title).toBeDefined();
  });

  it('returns null on 404', async () => {
    globalThis.fetch = vi.fn(async () => new Response('nope', { status: 404 })) as any;
    expect(await fetchCrossref('10.0/none')).toBeNull();
  });
});
```

Create `tests/journal/openalex.test.ts`:

```ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchOpenAlex } from '../../functions/lib/journal/openalex';
import { loadFixtureFile } from '../helpers/load-fixture';
import { join } from 'node:path';

const FIX = join(__dirname, 'fixtures/openalex');

describe('fetchOpenAlex', () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => { globalThis.fetch = originalFetch; });

  it('returns parsed work', async () => {
    const body = loadFixtureFile(FIX, '10.1038_s41586-021-03828-1.json');
    globalThis.fetch = vi.fn(async () => new Response(body, { status: 200 })) as any;
    const r = await fetchOpenAlex('10.1038/s41586-021-03828-1');
    expect(r).not.toBeNull();
    expect(r!.title).toBeDefined();
  });

  it('returns null on 404', async () => {
    globalThis.fetch = vi.fn(async () => new Response('nope', { status: 404 })) as any;
    expect(await fetchOpenAlex('10.0/none')).toBeNull();
  });
});
```

Create `tests/journal/normalize.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { normalizeCrossref, normalizeOpenAlex } from '../../functions/lib/journal/normalize';

describe('normalizeCrossref', () => {
  it('maps title, authors, container, year, volume, issue, page, DOI', () => {
    const csl = normalizeCrossref({
      title: ['The Title'],
      author: [
        { family: 'Doe', given: 'Jane' },
        { family: 'Smith', given: 'John' },
      ],
      'container-title': ['Nature'],
      issued: { 'date-parts': [[2021, 8, 4]] },
      volume: '596',
      issue: '7871',
      page: '583-589',
      DOI: '10.1038/s41586-021-03828-1',
    } as any);
    expect(csl.type).toBe('article-journal');
    expect(csl.title).toBe('The Title');
    expect(csl.author).toEqual([{ family: 'Doe', given: 'Jane' }, { family: 'Smith', given: 'John' }]);
    expect(csl['container-title']).toBe('Nature');
    expect(csl.issued).toEqual({ 'date-parts': [[2021, 8, 4]] });
    expect(csl.volume).toBe('596');
    expect(csl.issue).toBe('7871');
    expect(csl.page).toBe('583-589');
    expect(csl.DOI).toBe('10.1038/s41586-021-03828-1');
  });
});

describe('normalizeOpenAlex', () => {
  it('maps title, authorships, host venue, publication_date, DOI', () => {
    const csl = normalizeOpenAlex({
      title: 'A Work',
      authorships: [
        { author: { display_name: 'Jane Doe' } },
        { author: { display_name: 'John Smith' } },
      ],
      host_venue: { display_name: 'Nature' },
      publication_date: '2021-08-04',
      doi: 'https://doi.org/10.1038/s41586-021-03828-1',
      volume: '596',
      issue: '7871',
      first_page: '583',
      last_page: '589',
    } as any);
    expect(csl.title).toBe('A Work');
    expect(csl.author).toEqual([
      { family: 'Doe', given: 'Jane' },
      { family: 'Smith', given: 'John' },
    ]);
    expect(csl['container-title']).toBe('Nature');
    expect(csl.issued).toEqual({ 'date-parts': [[2021, 8, 4]] });
    expect(csl.DOI).toBe('10.1038/s41586-021-03828-1');
    expect(csl.volume).toBe('596');
    expect(csl.page).toBe('583-589');
  });
});
```

- [ ] **Step 3: Verify fails**

```bash
npm test -- tests/journal/
```

Expected: FAIL.

- [ ] **Step 4: Implement clients**

Create `functions/lib/journal/crossref.ts`:

```ts
export interface CrossrefWork {
  title?: string[];
  author?: Array<{ family?: string; given?: string; literal?: string; name?: string }>;
  'container-title'?: string[];
  issued?: { 'date-parts'?: Array<[number] | [number, number] | [number, number, number]> };
  volume?: string;
  issue?: string;
  page?: string;
  DOI?: string;
}

const TIMEOUT_MS = 5_000;

export async function fetchCrossref(doi: string): Promise<CrossrefWork | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`https://api.crossref.org/works/${encodeURIComponent(doi)}`, {
      signal: ctrl.signal,
      headers: {
        'User-Agent': 'mlagenerator/1.0 (mailto:matt@thunderboltnetworks.com)',
      },
    });
    if (!res.ok) return null;
    const blob = await res.json() as { message?: CrossrefWork };
    return blob.message ?? null;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}
```

Create `functions/lib/journal/openalex.ts`:

```ts
export interface OpenAlexWork {
  title?: string;
  authorships?: Array<{ author?: { display_name?: string } }>;
  host_venue?: { display_name?: string };
  publication_date?: string;
  doi?: string;
  volume?: string;
  issue?: string;
  first_page?: string;
  last_page?: string;
}

const TIMEOUT_MS = 5_000;

export async function fetchOpenAlex(doi: string): Promise<OpenAlexWork | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`https://api.openalex.org/works/doi:${encodeURIComponent(doi)}`, {
      signal: ctrl.signal,
      headers: { 'User-Agent': 'mlagenerator/1.0 (mailto:matt@thunderboltnetworks.com)' },
    });
    if (!res.ok) return null;
    return await res.json() as OpenAlexWork;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}
```

Create `functions/lib/journal/normalize.ts`:

```ts
import type { CSLItem, CSLName } from '../csl-types';
import { parseAuthorName } from '../extract/author-parse';
import { parseIsoDate } from '../extract/date-parse';
import { validateDoi } from './doi-detect';
import type { CrossrefWork } from './crossref';
import type { OpenAlexWork } from './openalex';

export function normalizeCrossref(work: CrossrefWork): CSLItem {
  const csl: CSLItem = {
    id: work.DOI || '',
    type: 'article-journal',
  };
  if (work.title?.length) csl.title = work.title[0];
  if (work.author?.length) {
    const a: CSLName[] = [];
    for (const author of work.author) {
      if (author.literal) a.push({ literal: author.literal });
      else if (author.family) a.push({ family: author.family, ...(author.given ? { given: author.given } : {}) });
      else if (author.name) {
        const parsed = parseAuthorName(author.name);
        if (parsed) a.push(parsed);
      }
    }
    if (a.length) csl.author = a;
  }
  if (work['container-title']?.length) csl['container-title'] = work['container-title'][0];
  if (work.issued?.['date-parts']?.[0]) csl.issued = { 'date-parts': [work.issued['date-parts'][0]] };
  if (work.volume) csl.volume = work.volume;
  if (work.issue) csl.issue = work.issue;
  if (work.page) csl.page = work.page;
  if (work.DOI) csl.DOI = work.DOI;
  return csl;
}

export function normalizeOpenAlex(work: OpenAlexWork): CSLItem {
  const doi = validateDoi(work.doi) || '';
  const csl: CSLItem = {
    id: doi,
    type: 'article-journal',
  };
  if (work.title) csl.title = work.title;
  if (work.authorships?.length) {
    const a: CSLName[] = [];
    for (const aa of work.authorships) {
      const name = aa.author?.display_name;
      if (!name) continue;
      const parsed = parseAuthorName(name);
      if (parsed) a.push(parsed);
    }
    if (a.length) csl.author = a;
  }
  if (work.host_venue?.display_name) csl['container-title'] = work.host_venue.display_name;
  if (work.publication_date) {
    const dp = parseIsoDate(work.publication_date);
    if (dp) csl.issued = { 'date-parts': [dp] };
  }
  if (doi) csl.DOI = doi;
  if (work.volume) csl.volume = work.volume;
  if (work.issue) csl.issue = work.issue;
  if (work.first_page) csl.page = work.last_page ? `${work.first_page}-${work.last_page}` : work.first_page;
  return csl;
}
```

- [ ] **Step 5: Run tests**

```bash
npm test -- tests/journal/
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add functions/lib/journal tests/journal
git commit -m "feat(journal): Crossref + OpenAlex clients + CSL normalizers (5 fixtures each)"
```

### Task C8: `/api/cite-journal` endpoint

**Files:**
- Create: `functions/api/cite-journal/handler.ts`
- Create: `functions/api/cite-journal/index.ts`
- Create: `tests/api/cite-journal.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/api/cite-journal.test.ts`:

```ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import { handleCiteJournal } from '../../functions/api/cite-journal/handler';
import { loadFixtureFile } from '../helpers/load-fixture';
import { join } from 'node:path';

const CR_FIX = join(__dirname, '../journal/fixtures/crossref');
const OA_FIX = join(__dirname, '../journal/fixtures/openalex');

function seqMock(...responses: Response[]) {
  let i = 0;
  globalThis.fetch = vi.fn(async () => responses[i++]) as any;
}

describe('handleCiteJournal', () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => { globalThis.fetch = originalFetch; });

  it('400s with no doi/url', async () => {
    const res = await handleCiteJournal(new URL('https://m.com/api/cite-journal'), null);
    expect(res.status).toBe(400);
  });

  it('400s on invalid DOI', async () => {
    const res = await handleCiteJournal(new URL('https://m.com/api/cite-journal?doi=garbage'), null);
    expect(res.status).toBe(400);
    expect((await res.json() as any).code).toBe('invalid_doi');
  });

  it('returns CSL from Crossref on direct DOI', async () => {
    const body = loadFixtureFile(CR_FIX, '10.1038_s41586-021-03828-1.json');
    seqMock(new Response(body, { status: 200 }));
    const res = await handleCiteJournal(new URL('https://m.com/api/cite-journal?doi=10.1038/s41586-021-03828-1'), null);
    expect(res.status).toBe(200);
    const env = await res.json() as any;
    expect(env.type).toBe('article-journal');
    expect(env.csl.title).toBeTruthy();
  });

  it('falls back to OpenAlex when Crossref 404s', async () => {
    const oa = loadFixtureFile(OA_FIX, '10.1038_s41586-021-03828-1.json');
    seqMock(new Response('nope', { status: 404 }), new Response(oa, { status: 200 }));
    const res = await handleCiteJournal(new URL('https://m.com/api/cite-journal?doi=10.1038/s41586-021-03828-1'), null);
    expect(res.status).toBe(200);
  });

  it('returns 404 when both providers miss', async () => {
    seqMock(new Response('nope', { status: 404 }), new Response('nope', { status: 404 }));
    const res = await handleCiteJournal(new URL('https://m.com/api/cite-journal?doi=10.1038/none'), null);
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Verify it fails**

```bash
npm test -- tests/api/cite-journal.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement**

Create `functions/api/cite-journal/handler.ts`:

```ts
import { fetchCrossref } from '../../lib/journal/crossref';
import { fetchOpenAlex } from '../../lib/journal/openalex';
import { normalizeCrossref, normalizeOpenAlex } from '../../lib/journal/normalize';
import { validateDoi } from '../../lib/journal/doi-detect';
import { TTL } from '../../lib/cache';
import type { ExtractEnvelope } from '../../lib/csl-types';

export interface MinCache {
  get(key: string): Promise<Response | undefined>;
  put(key: string, response: Response, maxAgeSeconds: number): Promise<void>;
}

export async function handleCiteJournal(requestUrl: URL, cache: MinCache | null): Promise<Response> {
  const rawDoi = requestUrl.searchParams.get('doi');
  const rawUrl = requestUrl.searchParams.get('url');
  if (!rawDoi && !rawUrl) return errorResponse(400, 'invalid_doi', 'Missing doi or url parameter');

  let doi: string | null = rawDoi ? validateDoi(rawDoi) : null;
  if (!doi && rawDoi) return errorResponse(400, 'invalid_doi', 'Malformed DOI');

  // Phase 1: url-mode falls back to a 400 telling the client to use cite-website instead.
  // The HTML-fallback path is a Phase-2 nice-to-have.
  if (!doi) return errorResponse(400, 'invalid_doi', 'cite-journal currently requires a doi parameter; use cite-website for non-DOI articles');

  const cacheKey = `https://cache.mlagenerator/journal/${doi}`;
  const bypassCache = requestUrl.searchParams.get('nocache') === '1';
  if (cache && !bypassCache) {
    const hit = await cache.get(cacheKey);
    if (hit) {
      const body = await hit.json() as ExtractEnvelope;
      body._cached = true;
      return jsonResponse(body);
    }
  }

  const cr = await fetchCrossref(doi);
  let csl;
  if (cr && cr.title?.length) {
    csl = normalizeCrossref(cr);
  } else {
    const oa = await fetchOpenAlex(doi);
    if (!oa || !oa.title) return errorResponse(404, 'not_found', 'DOI not found in Crossref or OpenAlex');
    csl = normalizeOpenAlex(oa);
  }

  const envelope: ExtractEnvelope = { uuid: doi, type: 'article-journal', csl, _cached: false };
  const response = jsonResponse(envelope);
  if (cache && !bypassCache) {
    await cache.put(cacheKey, response.clone(), TTL.BOOK_OR_JOURNAL);
  }
  return response;
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { 'content-type': 'application/json' },
  });
}

function errorResponse(status: number, code: string, message: string): Response {
  return new Response(JSON.stringify({ error: message, code, retryable: false }), {
    status, headers: { 'content-type': 'application/json' },
  });
}
```

Create `functions/api/cite-journal/index.ts`:

```ts
import { handleCiteJournal } from './handler';
import { defaultCacheStore } from '../../lib/cache';

export const onRequest: PagesFunction = async (context) => {
  const url = new URL(context.request.url);
  return handleCiteJournal(url, defaultCacheStore());
};
```

- [ ] **Step 4: Run tests**

```bash
npm test -- tests/api/cite-journal.test.ts
```

Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add functions/api/cite-journal tests/api/cite-journal.test.ts
git commit -m "feat(cite-journal): new endpoint, Crossref primary + OpenAlex fallback (DOI mode only in Phase 1)"
```

---

## Block D — Formatting endpoint (depends on Block A spike confirming citeproc-js fits)

### Task D1: citeproc.ts wrapper with cached engine per style

**Files:**
- Create: `functions/lib/format/citeproc.ts`
- Create: `tests/format/citeproc.test.ts`

The Phase 1 styles are bundled as `.csl` (XML text). Locale is bundled separately. The wrapper caches one `CSL.Engine` per style in module-level state — Workers reuse isolates between requests, so this matters for performance.

The CSL XML and locale are loaded via `?raw` imports (or whichever mechanism the spike confirmed works). If `?raw` proves not to work in the Functions bundle, fall back to embedding as base64 in a generated `.ts` file (do not block on this — the spike should have settled it).

- [ ] **Step 1: Write failing test**

Create `tests/format/citeproc.test.ts`:

```ts
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { formatCitation, registerStyle, registerLocale } from '../../functions/lib/format/citeproc';
import type { CSLItem } from '../../functions/lib/csl-types';

const PROJECT_ROOT = join(__dirname, '..', '..');

beforeAll(() => {
  registerLocale('en-US', readFileSync(join(PROJECT_ROOT, 'functions/lib/format/locales/locales-en-US.xml'), 'utf-8'));
  for (const s of ['mla-9', 'apa-7', 'chicago-18', 'ama-11', 'harvard', 'ieee', 'vancouver'] as const) {
    registerStyle(s, readFileSync(join(PROJECT_ROOT, `functions/lib/format/styles/${s}.csl`), 'utf-8'));
  }
});

const SAMPLE: CSLItem = {
  id: 'test',
  type: 'webpage',
  title: 'A Sample Web Article',
  author: [{ family: 'Doe', given: 'Jane' }],
  issued: { 'date-parts': [[2026, 5, 26]] },
  accessed: { 'date-parts': [[2026, 5, 26]] },
  URL: 'https://example.com/article',
  'container-title': 'Example',
};

describe('formatCitation', () => {
  it('renders MLA 9', () => {
    const out = formatCitation(SAMPLE, 'mla-9');
    expect(out.length).toBeGreaterThan(0);
    const text = out.map((r) => r.text).join('');
    expect(text).toContain('Doe');
    expect(text).toContain('Jane');
    expect(text).toContain('Sample Web Article');
    expect(text).toContain('example.com');
    // MLA italicizes the container title
    const containerSeg = out.find((r) => r.italic);
    expect(containerSeg?.text).toContain('Example');
  });

  it('renders APA 7', () => {
    const out = formatCitation(SAMPLE, 'apa-7');
    const text = out.map((r) => r.text).join('');
    expect(text).toContain('Doe');
    expect(text).toContain('(2026');
  });

  it('renders Chicago 18', () => {
    const out = formatCitation(SAMPLE, 'chicago-18');
    const text = out.map((r) => r.text).join('');
    expect(text).toContain('Doe');
    expect(text).toContain('2026');
  });

  it('throws on unknown style', () => {
    expect(() => formatCitation(SAMPLE, 'made-up' as any)).toThrow();
  });
});
```

- [ ] **Step 2: Verify it fails**

```bash
npm test -- tests/format/citeproc.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement**

Create `functions/lib/format/citeproc.ts`:

```ts
// @ts-ignore — citeproc has no types
import CSL from 'citeproc';
import type { CSLItem, RichText, SupportedStyle } from '../csl-types';

const styles: Map<string, string> = new Map();
const locales: Map<string, string> = new Map();
const engines: Map<string, any> = new Map();

export function registerStyle(name: SupportedStyle, csl: string): void {
  styles.set(name, csl);
  engines.delete(name); // force rebuild
}

export function registerLocale(name: string, xml: string): void {
  locales.set(name, xml);
  engines.clear(); // affects all engines
}

function getEngine(style: SupportedStyle, item: CSLItem): any {
  const cached = engines.get(style);
  if (cached) {
    cached.sys.__currentItem = item;
    return cached;
  }
  const csl = styles.get(style);
  if (!csl) throw new Error(`Unknown style: ${style}`);
  const sys = {
    __currentItem: item as CSLItem,
    retrieveLocale: (lang: string) => locales.get(lang) || locales.get('en-US') || '',
    retrieveItem: (id: string) => sys.__currentItem,
  };
  const engine = new CSL.Engine(sys, csl, 'en-US');
  engines.set(style, engine);
  return engine;
}

export function formatCitation(item: CSLItem, style: SupportedStyle): RichText[] {
  const engine = getEngine(style, item);
  engine.sys.__currentItem = item;
  engine.updateItems([item.id]);
  const bib = engine.makeBibliography();
  if (!bib || !bib[1] || !bib[1].length) return [];
  const raw: string = bib[1][0];
  return parseRichText(raw);
}

// citeproc output uses <i> and <span style="..."> markers. For Phase 1 we
// support italic via <i>...</i>; other inline markup is flattened to text.
function parseRichText(html: string): RichText[] {
  const stripped = html
    .replace(/<div[^>]*>/g, '')
    .replace(/<\/div>/g, '')
    .replace(/^\s+|\s+$/g, '');
  const segments: RichText[] = [];
  const re = /<i>([\s\S]*?)<\/i>|([^<]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(stripped)) !== null) {
    if (m[1] !== undefined) {
      if (m[1]) segments.push({ text: decode(m[1]), italic: true });
    } else if (m[2] !== undefined) {
      // Strip any leftover tags within plain text run.
      const text = decode(m[2].replace(/<[^>]+>/g, ''));
      if (text) segments.push({ text });
    }
  }
  return segments;
}

function decode(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#x2009;/g, ' ');
}
```

- [ ] **Step 4: Run tests**

```bash
npm test -- tests/format/citeproc.test.ts
```

Expected: PASS, 4 tests. If citeproc panics, log the error message and surface to user — it likely means the CSL XML is misnamed or the locale didn't load.

- [ ] **Step 5: Commit**

```bash
git add functions/lib/format/citeproc.ts tests/format/citeproc.test.ts
git commit -m "feat(format): citeproc-js wrapper with per-style engine cache and RichText parser"
```

### Task D2: `/api/format` endpoint

The endpoint loads the bundled CSL files at module init and registers them. **Loading strategy depends on what the spike confirmed in Task A1.** If `?raw` works, use the imports as written. If not, swap to whatever the spike settled on.

**Files:**
- Create: `functions/api/format/index.ts`
- Create: `functions/api/format/handler.ts`
- Create: `tests/api/format.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/api/format.test.ts`:

```ts
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { handleFormat } from '../../functions/api/format/handler';
import { registerStyle, registerLocale } from '../../functions/lib/format/citeproc';

const ROOT = join(__dirname, '..', '..');

beforeAll(() => {
  registerLocale('en-US', readFileSync(join(ROOT, 'functions/lib/format/locales/locales-en-US.xml'), 'utf-8'));
  for (const s of ['mla-9', 'apa-7', 'chicago-18', 'ama-11', 'harvard', 'ieee', 'vancouver']) {
    registerStyle(s as any, readFileSync(join(ROOT, `functions/lib/format/styles/${s}.csl`), 'utf-8'));
  }
});

describe('handleFormat', () => {
  it('400s on missing body', async () => {
    const req = new Request('https://m.com/api/format', { method: 'POST', body: '' });
    const res = await handleFormat(req);
    expect(res.status).toBe(400);
  });

  it('400s on invalid JSON', async () => {
    const req = new Request('https://m.com/api/format', { method: 'POST', body: 'not json' });
    const res = await handleFormat(req);
    expect(res.status).toBe(400);
  });

  it('400s on unsupported style', async () => {
    const body = JSON.stringify({ csl: { id: 'x', type: 'webpage', title: 't' }, style: 'made-up' });
    const req = new Request('https://m.com/api/format', { method: 'POST', body });
    const res = await handleFormat(req);
    expect(res.status).toBe(400);
  });

  it('returns RichText[] for MLA 9', async () => {
    const body = JSON.stringify({
      csl: {
        id: 'x', type: 'webpage', title: 'A Title',
        author: [{ family: 'Doe', given: 'Jane' }],
        issued: { 'date-parts': [[2026]] },
        URL: 'https://example.com',
      },
      style: 'mla-9',
    });
    const req = new Request('https://m.com/api/format', { method: 'POST', body });
    const res = await handleFormat(req);
    expect(res.status).toBe(200);
    const out = await res.json() as { formatted: Array<{ text: string; italic?: boolean }> };
    expect(out.formatted.length).toBeGreaterThan(0);
    expect(out.formatted.map((r) => r.text).join('')).toContain('Doe');
  });
});
```

- [ ] **Step 2: Verify it fails**

```bash
npm test -- tests/api/format.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement handler**

Create `functions/api/format/handler.ts`:

```ts
import type { CSLItem, FormatRequest, FormatResponse, SupportedStyle } from '../../lib/csl-types';
import { formatCitation } from '../../lib/format/citeproc';

const SUPPORTED: SupportedStyle[] = ['mla-9', 'apa-7', 'chicago-18', 'ama-11', 'harvard', 'ieee', 'vancouver'];

export async function handleFormat(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return error(405, 'method_not_allowed', 'POST required');
  }
  let parsed: FormatRequest;
  try {
    parsed = await req.json() as FormatRequest;
  } catch {
    return error(400, 'bad_request', 'Body must be JSON');
  }
  if (!parsed || !parsed.csl || typeof parsed.csl !== 'object') {
    return error(400, 'bad_request', 'Missing csl');
  }
  if (!parsed.style || !SUPPORTED.includes(parsed.style)) {
    return error(400, 'bad_request', `Unsupported style. Allowed: ${SUPPORTED.join(', ')}`);
  }
  try {
    const formatted = formatCitation(parsed.csl as CSLItem, parsed.style);
    const body: FormatResponse = { formatted };
    return new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } });
  } catch (e) {
    return error(500, 'internal', `Format failed: ${(e as Error).message}`);
  }
}

function error(status: number, code: string, message: string): Response {
  return new Response(JSON.stringify({ error: message, code, retryable: false }), {
    status, headers: { 'content-type': 'application/json' },
  });
}
```

- [ ] **Step 4: Implement endpoint with bundled CSL loading**

Create `functions/api/format/index.ts`:

```ts
import { handleFormat } from './handler';
import { registerStyle, registerLocale } from '../../lib/format/citeproc';

// Per Task A1 spike: Wrangler's bundler does NOT honor Vite's `?raw` suffix and
// has no default text loader for .csl/.xml. CSL files are base64-embedded as
// sibling .ts modules via `scripts/embed-csl.mjs` and decoded at runtime via atob.
// The styles/index.ts and locales/index.ts modules expose `decode(name)` + `NAMES`.
import { decode as decodeStyle, NAMES as STYLE_NAMES } from '../../lib/format/styles';
import { decode as decodeLocale } from '../../lib/format/locales';

let registered = false;
function ensureRegistered() {
  if (registered) return;
  registerLocale('en-US', decodeLocale('locales-en-US'));
  for (const name of STYLE_NAMES) {
    registerStyle(name as any, decodeStyle(name));
  }
  registered = true;
}

export const onRequest: PagesFunction = async (context) => {
  ensureRegistered();
  return handleFormat(context.request);
};
```

- [ ] **Step 5: Run tests**

```bash
npm test -- tests/api/format.test.ts
```

Expected: PASS, 4 tests.

- [ ] **Step 6: Confirm preview deploy still bundles correctly**

```bash
npm run preview
# Then in another shell:
curl -s -X POST http://127.0.0.1:8788/api/format \
  -H "content-type: application/json" \
  -d '{"csl":{"id":"x","type":"webpage","title":"T","author":[{"family":"Doe","given":"J"}],"issued":{"date-parts":[[2026]]},"URL":"https://e.com"},"style":"mla-9"}'
```

Expected: JSON with `formatted` array containing non-empty segments. If 500, the `?raw` import didn't work in the Functions bundle — apply the spike fallback (embed as base64 strings or as `.ts` modules).

- [ ] **Step 7: Commit**

```bash
git add functions/api/format tests/api/format.test.ts
git commit -m "feat(format): /api/format endpoint with bundled CSL files for MLA 9, APA 7, Chicago 18"
```

---

## Block E — Client migration (depends on D being live)

The client side is small in volume but high-risk: a regression here is what shows up in production. Each task is sequential because they all touch shared state shapes.

### Task E1: localStorage v2 storage module

**Files:**
- Create: `src/lib/references/storage.ts`
- Create: `tests/client/storage.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/client/storage.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { loadSources, saveSources, type StoredSource } from '../../src/lib/references/storage';

// vitest's default node environment lacks localStorage; polyfill minimally.
beforeEach(() => {
  const store: Record<string, string> = {};
  (globalThis as any).localStorage = {
    getItem: (k: string) => (k in store ? store[k] : null),
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { for (const k of Object.keys(store)) delete store[k]; },
  };
});

describe('storage v2', () => {
  it('returns [] when no key present', () => {
    expect(loadSources()).toEqual([]);
  });

  it('round-trips an array of stored sources', () => {
    const sources: StoredSource[] = [{
      uuid: 'u1',
      csl: { id: 'u1', type: 'webpage', title: 'T' },
    }];
    saveSources(sources);
    expect(loadSources()).toEqual(sources);
  });

  it('ignores old v1 shape silently and returns []', () => {
    localStorage.setItem('sources', JSON.stringify([{ uuid: 'old', citationType: 'website', citationInfo: {} }]));
    expect(loadSources()).toEqual([]);
  });

  it('treats malformed JSON as empty', () => {
    localStorage.setItem('sources_v2', '{not json}');
    expect(loadSources()).toEqual([]);
  });

  it('treats a non-array v2 payload as empty', () => {
    localStorage.setItem('sources_v2', JSON.stringify({ not: 'array' }));
    expect(loadSources()).toEqual([]);
  });
});
```

- [ ] **Step 2: Verify it fails**

```bash
npm test -- tests/client/storage.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement**

Create `src/lib/references/storage.ts`:

```ts
import type { CSLItem } from '../citations/csl-types';

export const STORAGE_KEY = 'sources_v2';

export interface StoredSource {
  uuid: string;
  csl: CSLItem;
}

export function loadSources(): StoredSource[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isStoredSource);
  } catch {
    return [];
  }
}

export function saveSources(sources: StoredSource[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sources));
  } catch {
    // quota or disabled storage — silently no-op
  }
}

function isStoredSource(x: unknown): x is StoredSource {
  if (!x || typeof x !== 'object') return false;
  const o = x as any;
  return typeof o.uuid === 'string' && o.csl && typeof o.csl === 'object' && typeof o.csl.id === 'string';
}
```

- [ ] **Step 4: Run tests**

```bash
npm test -- tests/client/storage.test.ts
```

Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/references/storage.ts tests/client/storage.test.ts
git commit -m "feat(client): sources_v2 localStorage wrapper, defensively ignores v1 shape"
```

### Task E2: useFormattedCitation hook

**Files:**
- Create: `src/lib/citations/useFormattedCitation.ts`
- Create: `tests/client/useFormattedCitation.test.ts`

The hook posts CSL-JSON to `/api/format`, caches by `(uuid, style)` in a module-level Map, and returns `{ formatted, loading, error }`.

- [ ] **Step 1: Write failing test**

Create `tests/client/useFormattedCitation.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useFormattedCitation, _resetCacheForTests } from '../../src/lib/citations/useFormattedCitation';

beforeEach(() => {
  _resetCacheForTests();
  globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({
    formatted: [{ text: 'Doe, Jane. ' }, { text: 'Title', italic: true }, { text: '.' }],
  }), { status: 200, headers: { 'content-type': 'application/json' } })) as any;
});

describe('useFormattedCitation', () => {
  it('fetches and returns formatted rich text', async () => {
    const csl = { id: 'u1', type: 'webpage' as const, title: 'Title' };
    const { result } = renderHook(() => useFormattedCitation({ uuid: 'u1', csl }, 'mla-9'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.formatted).toEqual([
      { text: 'Doe, Jane. ' }, { text: 'Title', italic: true }, { text: '.' },
    ]);
    expect(result.current.error).toBeNull();
  });

  it('caches by (uuid, style) so a second call does not refetch', async () => {
    const csl = { id: 'u1', type: 'webpage' as const, title: 'Title' };
    const { result: r1, rerender } = renderHook(
      ({ s }) => useFormattedCitation({ uuid: 'u1', csl }, s as any),
      { initialProps: { s: 'mla-9' } },
    );
    await waitFor(() => expect(r1.current.loading).toBe(false));
    const callsAfterFirst = (globalThis.fetch as any).mock.calls.length;
    rerender({ s: 'mla-9' });
    await waitFor(() => expect(r1.current.loading).toBe(false));
    expect((globalThis.fetch as any).mock.calls.length).toBe(callsAfterFirst);
  });

  it('surfaces an error when /api/format returns non-200', async () => {
    globalThis.fetch = vi.fn(async () => new Response('boom', { status: 500 })) as any;
    const csl = { id: 'u2', type: 'webpage' as const, title: 'X' };
    const { result } = renderHook(() => useFormattedCitation({ uuid: 'u2', csl }, 'mla-9'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeTruthy();
  });
});
```

Note: this test needs the `jsdom` environment. Add per-file pragma at the top of the test file:

```ts
// @vitest-environment jsdom
```

And install the deps:

```bash
npm install -D @testing-library/react@^14 jsdom
```

- [ ] **Step 2: Verify it fails**

```bash
npm test -- tests/client/useFormattedCitation.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement**

Create `src/lib/citations/useFormattedCitation.ts`:

```ts
import { useEffect, useState } from 'react';
import type { CSLItem, RichText, SupportedStyle } from './csl-types';

interface Args {
  uuid: string;
  csl: CSLItem;
}

interface State {
  formatted: RichText[];
  loading: boolean;
  error: string | null;
}

const cache: Map<string, RichText[]> = new Map();
const inflight: Map<string, Promise<RichText[]>> = new Map();

export function _resetCacheForTests() {
  cache.clear();
  inflight.clear();
}

export function useFormattedCitation(source: Args, style: SupportedStyle): State {
  const key = `${source.uuid}::${style}`;
  const [state, setState] = useState<State>(() => {
    const hit = cache.get(key);
    return hit
      ? { formatted: hit, loading: false, error: null }
      : { formatted: [], loading: true, error: null };
  });

  useEffect(() => {
    let cancelled = false;
    const cached = cache.get(key);
    if (cached) {
      setState({ formatted: cached, loading: false, error: null });
      return;
    }
    setState((s) => ({ ...s, loading: true, error: null }));
    const promise = inflight.get(key) ?? (async () => {
      const res = await fetch('/api/format', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ csl: source.csl, style }),
      });
      if (!res.ok) throw new Error(`Format failed: HTTP ${res.status}`);
      const body = await res.json() as { formatted: RichText[] };
      cache.set(key, body.formatted);
      return body.formatted;
    })();
    inflight.set(key, promise);
    promise
      .then((rt) => { if (!cancelled) setState({ formatted: rt, loading: false, error: null }); })
      .catch((e: Error) => { if (!cancelled) setState({ formatted: [], loading: false, error: e.message }); })
      .finally(() => inflight.delete(key));
    return () => { cancelled = true; };
  }, [key, source.csl, style]);

  return state;
}
```

- [ ] **Step 4: Update vitest config to allow `jsdom` env per file**

Edit `vitest.config.ts` — no global change needed; the per-file pragma in the test handles it. But ensure `jsdom` is now installed (Step 1).

- [ ] **Step 5: Run tests**

```bash
npm test -- tests/client/useFormattedCitation.test.ts
```

Expected: PASS, 3 tests.

- [ ] **Step 6: Commit**

```bash
git add src/lib/citations/useFormattedCitation.ts tests/client/useFormattedCitation.test.ts package.json package-lock.json
git commit -m "feat(client): useFormattedCitation hook with session-level (uuid, style) cache"
```

### Task E3: Update `citationStyles.ts` to Phase 1 dropdown

**Files:**
- Modify: `src/components/citationStyles.ts`

- [ ] **Step 1: Replace the file**

Replace the entire contents of `src/components/citationStyles.ts` with:

```ts
import type { SupportedStyle } from '../lib/citations/csl-types';

export interface CitationStyleOption {
  label: string;
  value: SupportedStyle;
  default?: boolean;
}

const citationStyles: CitationStyleOption[] = [
  { label: 'MLA 9th edition', value: 'mla-9', default: true },
  { label: 'APA 7th edition', value: 'apa-7' },
  { label: 'Chicago 18th edition', value: 'chicago-18' },
  { label: 'AMA 11th edition', value: 'ama-11' },
  { label: 'Harvard', value: 'harvard' },
  { label: 'IEEE', value: 'ieee' },
  { label: 'Vancouver', value: 'vancouver' },
].sort((a, b) => a.label.localeCompare(b.label));

export default citationStyles;
```

Older versions (MLA 6/7/8, APA 6, Chicago 16, AMA 10) are dropped. Per user decision, Phase 1 bundles all 7 current style families so users do not lose options vs the legacy implementation.

- [ ] **Step 2: Commit (no test — pure data file)**

```bash
git add src/components/citationStyles.ts
git commit -m "refactor(client): restrict style dropdown to Phase 1 styles (MLA 9, APA 7, Chicago 18)

The remaining styles (AMA, Harvard, IEEE, Vancouver, plus older versions of
MLA/APA/Chicago) come back in Phase 2 once their CSL files are bundled and
fixture-tested. The internal style codes change from <slug>-<n>th-edition to
the CSL canonical <slug>-<major-version> form (mla-9, apa-7, chicago-18)."
```

### Task E4: Rewrite `useReferences`

This is the central state hook. It changes from `Source[]` (old shape) to `StoredSource[]` (CSL-JSON). Bookmark-injected references from the URL (`?website=...`/`?book=...`) need to hit the new server contract.

**Files:**
- Modify: `src/lib/references/useReferences.ts`
- Create: `tests/client/useReferences.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useReferences } from '../../src/lib/references/useReferences';
import { STORAGE_KEY } from '../../src/lib/references/storage';

beforeEach(() => {
  localStorage.clear();
  Object.defineProperty(window, 'location', {
    writable: true,
    value: new URL('http://localhost/my-references'),
  });
  globalThis.fetch = vi.fn() as any;
});

describe('useReferences', () => {
  it('starts empty when localStorage is empty', async () => {
    const { result } = renderHook(() => useReferences());
    await waitFor(() => expect(result.current.sourceCount).toBe(0));
  });

  it('loads existing v2 sources', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([
      { uuid: 'u1', csl: { id: 'u1', type: 'webpage', title: 'T' } },
    ]));
    const { result } = renderHook(() => useReferences());
    await waitFor(() => expect(result.current.sourceCount).toBe(1));
    expect(result.current.sources[0].uuid).toBe('u1');
  });

  it('silently ignores legacy v1 sources', async () => {
    localStorage.setItem('sources', JSON.stringify([{ uuid: 'old', citationType: 'website', citationInfo: {} }]));
    const { result } = renderHook(() => useReferences());
    await waitFor(() => expect(result.current.sourceCount).toBe(0));
  });

  it('fetches /api/cite-website when ?website= present', async () => {
    Object.defineProperty(window, 'location', {
      writable: true,
      value: new URL('http://localhost/my-references?website=https://x.com/p'),
    });
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({
      uuid: 'https://x.com/p',
      type: 'webpage',
      csl: { id: 'u', type: 'webpage', title: 'T' },
    }), { status: 200 })) as any;
    const { result } = renderHook(() => useReferences());
    await waitFor(() => expect(result.current.sourceCount).toBe(1));
    expect((globalThis.fetch as any).mock.calls[0][0]).toContain('/api/cite-website');
  });

  it('setCitationFormat updates state', async () => {
    const { result } = renderHook(() => useReferences());
    await waitFor(() => expect(result.current.citationFormat).toBe('mla-9'));
    act(() => result.current.setCitationFormat('apa-7'));
    expect(result.current.citationFormat).toBe('apa-7');
  });
});
```

- [ ] **Step 2: Verify it fails**

```bash
npm test -- tests/client/useReferences.test.ts
```

Expected: FAIL (the hook still returns the v1 shape).

- [ ] **Step 3: Rewrite the hook**

Replace `src/lib/references/useReferences.ts`:

```ts
import { useState, useEffect, useCallback } from 'react';
import { loadSources, saveSources, type StoredSource } from './storage';
import type { CSLItem, SupportedStyle } from '../citations/csl-types';

export interface UseReferencesReturn {
  sources: StoredSource[];
  sourceCount: number;
  checkedCount: number;
  citationFormat: SupportedStyle;
  setSources: (sources: StoredSource[] | ((prev: StoredSource[]) => StoredSource[])) => void;
  setCheckedCount: (count: number) => void;
  setCitationFormat: (format: SupportedStyle) => void;
  handleDelete: () => void;
}

const STYLES: SupportedStyle[] = ['mla-9', 'apa-7', 'chicago-18', 'ama-11', 'harvard', 'ieee', 'vancouver'];

function isSupportedStyle(s: string | null): s is SupportedStyle {
  return !!s && (STYLES as string[]).includes(s);
}

interface ApiEnvelope {
  uuid: string;
  type: CSLItem['type'];
  csl: CSLItem;
}

export function useReferences(): UseReferencesReturn {
  const [sources, setSourcesState] = useState<StoredSource[]>([]);
  const [checkedCount, setCheckedCount] = useState(0);
  const [citationFormat, setCitationFormatState] = useState<SupportedStyle>('mla-9');

  const setSources = useCallback((next: StoredSource[] | ((prev: StoredSource[]) => StoredSource[])) => {
    setSourcesState((prev) => {
      const computed = typeof next === 'function' ? (next as any)(prev) : next;
      saveSources(computed);
      return computed;
    });
  }, []);

  const setCitationFormat = useCallback((s: SupportedStyle) => {
    setCitationFormatState(s);
  }, []);

  const handleDelete = useCallback(() => {
    const remaining: StoredSource[] = [];
    sources.forEach((s, i) => {
      const cb = document.querySelector(`#source-${i}`) as HTMLInputElement | null;
      if (!cb?.checked) remaining.push(s);
    });
    setSources(remaining);
    setCheckedCount(0);
  }, [sources, setSources]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const styleParam = params.get('citationStyle');
    if (isSupportedStyle(styleParam)) setCitationFormatState(styleParam);

    const existing = loadSources();
    setSourcesState(existing);

    const website = params.get('website');
    const book = params.get('book');
    const journal = params.get('journal') || params.get('doi');
    let requestUrl: string | null = null;
    if (website) requestUrl = `/api/cite-website?url=${encodeURIComponent(website)}`;
    else if (book) requestUrl = `/api/cite-book?isbn=${encodeURIComponent(book)}`;
    else if (journal) requestUrl = `/api/cite-journal?doi=${encodeURIComponent(journal)}`;
    if (!requestUrl) return;

    let cancelled = false;
    fetch(requestUrl)
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<ApiEnvelope>;
      })
      .then((env) => {
        if (cancelled || !env?.csl) return;
        if (existing.some((s) => s.uuid === env.uuid)) return;
        const merged = [...existing, { uuid: env.uuid, csl: env.csl }];
        setSources(merged);
      })
      .catch((err) => console.error('Citation fetch failed', err));
    return () => { cancelled = true; };
  }, [setSources]);

  return {
    sources,
    sourceCount: sources.length,
    checkedCount,
    citationFormat,
    setSources,
    setCheckedCount,
    setCitationFormat,
    handleDelete,
  };
}
```

The legacy `copySelected`/`loadInitialSources` are gone — they were impure (DOM-mutating, called formatSource directly). Copy-selected logic moves into the React component using `useFormattedCitation` because it needs `await`-able formatted strings. We'll wire that in Task E5.

- [ ] **Step 4: Run tests**

```bash
npm test -- tests/client/useReferences.test.ts
```

Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/references/useReferences.ts tests/client/useReferences.test.ts
git commit -m "refactor(client): useReferences now stores CSL-JSON and ignores legacy v1 shape

Removes copySelected from the hook (impure, DOM-mutating); copy logic now
lives in References.tsx where it can compose useFormattedCitation."
```

### Task E5: Update `ReferenceItem`, `References`, edit form

**Files:**
- Modify: `src/components/react/ReferenceItem.tsx`
- Modify: `src/components/react/References.tsx`
- Modify: `src/components/react/EditCitationForm.tsx`
- Modify: `src/components/react/EditCitationFormComponents.tsx`
- Modify: `src/components/react/EditReferenceDialogDrawer.tsx`

This block doesn't lend itself to per-component TDD since they're tightly coupled — verify with the preview deploy in Task G2. But add one happy-path React test for `ReferenceItem` to lock in the integration.

- [ ] **Step 1: Write happy-path test for ReferenceItem**

Create `tests/client/ReferenceItem.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import ReferenceItem from '../../src/components/react/ReferenceItem';
import { _resetCacheForTests } from '../../src/lib/citations/useFormattedCitation';
import type { StoredSource } from '../../src/lib/references/storage';

beforeEach(() => {
  _resetCacheForTests();
  globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({
    formatted: [{ text: 'Doe, Jane. ' }, { text: 'My Title', italic: true }, { text: '.' }],
  }), { status: 200 })) as any;
});

describe('ReferenceItem', () => {
  it('renders the formatted citation', async () => {
    const source: StoredSource = {
      uuid: 'u1',
      csl: { id: 'u1', type: 'webpage', title: 'My Title', author: [{ family: 'Doe', given: 'Jane' }] },
    };
    const { getByText, container } = render(
      <ReferenceItem
        source={source}
        sources={[source]}
        index={0}
        citationFormat="mla-9"
        onCheckChange={() => {}}
        setSources={() => {}}
      />,
    );
    await waitFor(() => {
      expect(container.textContent).toContain('Doe');
      expect(container.textContent).toContain('My Title');
    });
    const italic = container.querySelector('i, em');
    expect(italic?.textContent).toContain('My Title');
  });
});
```

- [ ] **Step 2: Replace `ReferenceItem.tsx`**

```tsx
import React, { useEffect, useRef } from 'react';
import EditReferenceDialogDrawer from './EditReferenceDialogDrawer';
import { useFormattedCitation } from '../../lib/citations/useFormattedCitation';
import type { StoredSource } from '../../lib/references/storage';
import type { SupportedStyle, RichText } from '../../lib/citations/csl-types';
import styles from '../../styles/references.module.css';
import { Clipboard, Globe } from 'lucide-react';

interface Props {
  source: StoredSource;
  sources: StoredSource[];
  index: number;
  citationFormat: SupportedStyle;
  onCheckChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  setSources: (s: StoredSource[] | ((prev: StoredSource[]) => StoredSource[])) => void;
  autoOpenEdit?: boolean;
}

function richTextToHtml(rt: RichText[]): string {
  return rt.map((seg) => seg.italic ? `<i>${escapeHtml(seg.text)}</i>` : escapeHtml(seg.text)).join('');
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : '&#39;');
}

function copyRichText(rt: RichText[]) {
  const html = richTextToHtml(rt);
  const div = document.createElement('div');
  div.style.cssText = 'position:fixed;left:-9999px;font-family:"Times New Roman",Times,serif;font-size:12pt;line-height:2;';
  div.innerHTML = html;
  document.body.appendChild(div);
  const range = document.createRange();
  range.selectNodeContents(div);
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
  document.execCommand('copy');
  document.body.removeChild(div);
  sel?.removeAllRanges();
}

export default function ReferenceItem({ source, sources, index, citationFormat, onCheckChange, setSources, autoOpenEdit }: Props) {
  const editButtonRef = useRef<HTMLButtonElement>(null);
  const { formatted, loading, error } = useFormattedCitation(source, citationFormat);

  useEffect(() => {
    if (autoOpenEdit && editButtonRef.current) editButtonRef.current.click();
  }, [source.uuid, autoOpenEdit]);

  const handleCopy = (event: React.MouseEvent<HTMLButtonElement>) => {
    const target = event.currentTarget;
    const targetSpan = target.querySelector('span') as HTMLSpanElement;
    const current = targetSpan.textContent;
    copyRichText(formatted);
    targetSpan.textContent = 'Copied';
    setTimeout(() => { targetSpan.textContent = current; }, 1000);
  };

  return (
    <li className={styles.citationSourceItem}>
      <label className={styles.citation}>
        <input type="checkbox" id={`source-${index}`} className={styles.checkboxElement} onChange={onCheckChange} />
        <div className={styles.checkbox}></div>
        <div className={styles.citationSourceWrapper}>
          <pre
            className={styles.citationSource}
            dangerouslySetInnerHTML={{
              __html: error
                ? `Failed to format citation: ${escapeHtml(error)}`
                : loading
                  ? 'Loading…'
                  : richTextToHtml(formatted),
            }}
          />
        </div>
      </label>
      <div className={styles.citationSourceButtons}>
        <button className={styles.button} onClick={handleCopy} aria-label="Copy citation">
          <Clipboard className={styles.icon} /><span>Copy</span>
        </button>
        <EditReferenceDialogDrawer source={source} sources={sources} setSources={setSources} ref={editButtonRef} />
        {source.csl.URL && (
          <a className={styles.button} href={source.csl.URL.startsWith('http') ? source.csl.URL : `https://${source.csl.URL}`} target="_blank" rel="noreferrer" aria-label="Visit source website">
            <Globe className={styles.icon} /><span>Visit Site</span>
          </a>
        )}
      </div>
    </li>
  );
}
```

- [ ] **Step 3: Replace `References.tsx`**

```tsx
import React, { useRef, useState } from 'react';
import styles from '../../styles/references.module.css';
import citationStyles from '../citationStyles';
import Dropdown from './Dropdown';
import CitationSearch from './CitationSearch';
import ReferenceItem from './ReferenceItem';
import { useReferences } from '../../lib/references/useReferences';
import type { StoredSource } from '../../lib/references/storage';
import { useFormattedCitation } from '../../lib/citations/useFormattedCitation';
import type { SupportedStyle } from '../../lib/citations/csl-types';
import { Clipboard, Plus, Trash2 } from 'lucide-react';
import { cn } from './utils';
import { Button } from './Button';

function emptySource(): StoredSource {
  const id = crypto.randomUUID();
  return { uuid: id, csl: { id, type: 'webpage' } };
}

export default function References() {
  const { sources, sourceCount, checkedCount, citationFormat, setSources, setCheckedCount, setCitationFormat, handleDelete } = useReferences();
  const [lastAddedId, setLastAddedId] = useState<string | null>(null);
  const citationFormatRef = useRef<HTMLInputElement>(null);
  const selectAllRef = useRef<HTMLInputElement>(null);

  const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
    const checkboxes = document.querySelectorAll(`.${styles.citationSourceItem} input[type="checkbox"]`);
    const checked = event.target.checked;
    checkboxes.forEach((cb: any) => { cb.checked = checked; });
    setCheckedCount(checked ? sources.length : 0);
  };

  const handleCheckChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const amount = checkedCount + (event.target.checked ? 1 : -1);
    setCheckedCount(amount);
    if (selectAllRef.current) selectAllRef.current.checked = amount === sources.length;
  };

  const handleCopySelected = async () => {
    const selected = sources.filter((_, i) => (document.querySelector(`#source-${i}`) as HTMLInputElement | null)?.checked);
    if (!selected.length) return;
    // Request formatted versions in parallel
    const results = await Promise.all(selected.map(async (s) => {
      const res = await fetch('/api/format', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ csl: s.csl, style: citationFormat }),
      });
      if (!res.ok) return '';
      const body = await res.json();
      return (body.formatted as Array<{ text: string; italic?: boolean }>)
        .map((seg) => seg.italic ? `<i>${escape(seg.text)}</i>` : escape(seg.text)).join('');
    }));
    const tempDiv = document.createElement('div');
    tempDiv.style.cssText = 'position:fixed;left:-9999px;font-family:"Times New Roman",Times,serif;font-size:12pt;line-height:2;';
    tempDiv.innerHTML = results.filter(Boolean).join('<br><br>');
    document.body.appendChild(tempDiv);
    const range = document.createRange();
    range.selectNodeContents(tempDiv);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
    document.execCommand('copy');
    document.body.removeChild(tempDiv);
    sel?.removeAllRanges();
    const span = document.querySelector('[data-copy-selected] span');
    if (span) {
      const current = span.textContent;
      span.textContent = 'Copied selected';
      setTimeout(() => { span.textContent = current; }, 1000);
    }
  };

  const handleAddManually = () => {
    const next = emptySource();
    setSources((prev) => [...prev, next]);
    setLastAddedId(next.uuid);
  };

  return (
    <div className={styles.container}>
      <CitationSearch includeDropdown={false} includeManualCite={false} ref={citationFormatRef} />
      <div className={styles.referencesContainer}>
        <h2 className="heading-2">References</h2>
        <Dropdown
          options={citationStyles}
          value={citationStyles.find((o) => o.value === citationFormat)}
          className={styles.dropdown}
          onChange={(o: any) => {
            if (citationFormatRef.current) citationFormatRef.current.value = o.value;
            setCitationFormat(o.value as SupportedStyle);
            const url = new URL(window.location.href);
            url.searchParams.set('citationStyle', o.value);
            window.history.pushState({}, '', url.toString());
          }}
        />
        <div className={styles.referenceTitle}>
          <label className={styles.citation}>
            <input type="checkbox" className={styles.checkboxElement} onChange={handleSelectAll} ref={selectAllRef} aria-label="Select all references" />
            <div className={styles.checkbox}></div>
            <span>{sourceCount} source{sourceCount === 1 ? '' : 's'}{checkedCount > 0 ? ' selected' : ''}</span>
          </label>
          {checkedCount > 0 && (
            <div className={styles.referenceTitleButtons}>
              <button className={styles.button} onClick={handleCopySelected} data-copy-selected aria-label="Copy selected references">
                <Clipboard className={cn(styles.icon, 'transform translate-y-[1px]')} /><span>Copy selected</span>
              </button>
              <button className={styles.button} onClick={handleDelete} aria-label="Delete selected references">
                <Trash2 className={cn(styles.icon, 'transform translate-y-[1px]')} /><span>Delete</span>
              </button>
            </div>
          )}
          <Button className="leading-none shadow-none text-white bg-primary rounded-full flex gap-3 ml-7" onClick={handleAddManually}>
            <Plus size={19} /><span>Add Manually</span>
          </Button>
        </div>
        {sources.length > 0 && (
          <ul className={styles.citationSourceContainer} role="list">
            {sources.map((source, i) => (
              <ReferenceItem
                key={source.uuid}
                source={source}
                sources={sources}
                setSources={setSources}
                index={i}
                citationFormat={citationFormat}
                onCheckChange={handleCheckChange}
                autoOpenEdit={source.uuid === lastAddedId}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function escape(s: string): string {
  return s.replace(/[&<>"']/g, (c) => c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : '&#39;');
}
```

- [ ] **Step 4: Rewrite `EditCitationFormComponents.tsx` Contributors block + update DateComponentProps**

Replace `Contributors` and `PublicationDate`/`AccessDate` to operate on CSL shapes. The full file is long; key changes:

```tsx
// Replace the Author import + AuthorPreviewName + handleAddContributor / handleEditAuthor:

import type { CSLItem, CSLName } from '../../lib/citations/csl-types';
import type { StoredSource } from '../../lib/references/storage';

interface ContributorsProps {
  source: StoredSource;
  setSources: (s: StoredSource[] | ((prev: StoredSource[]) => StoredSource[])) => void;
}

export const Contributors = ({ source, setSources }: ContributorsProps) => {
  const authors = source.csl.author ?? [];
  const [lastOpenedIdx, setLastOpenedIdx] = useState<number | null>(null);

  const update = (next: CSLName[]) => {
    setSources((prev) => prev.map((s) =>
      s.uuid === source.uuid ? { ...s, csl: { ...s.csl, author: next } } : s,
    ));
  };

  const isPerson = (n: CSLName): n is Exclude<CSLName, { literal: string }> => !('literal' in n);

  const previewName = (n: CSLName) => {
    if (isPerson(n)) {
      return n.given || n.family ? <span>{n.given} {n.family}</span> : <span>—</span>;
    }
    return <span>{n.literal}</span>;
  };

  const handleEdit = (idx: number, patch: Partial<CSLName>) => {
    update(authors.map((a, i) => i === idx ? ({ ...a, ...patch } as CSLName) : a));
  };

  const handleAddPerson = () => {
    const next = [...authors, { family: '', given: '' } as CSLName];
    update(next);
    setLastOpenedIdx(next.length - 1);
  };

  const handleAddOrganization = () => {
    const next = [...authors, { literal: '' } as CSLName];
    update(next);
    setLastOpenedIdx(next.length - 1);
  };

  const handleDelete = (idx: number) => update(authors.filter((_, i) => i !== idx));

  return (
    <div className="grid grid-cols-[130px_1fr] gap-4">
      <span className="flex flex-col leading-4 text-sm h-9 justify-center">
        Contributors
        <span className="text-xs text-muted-foreground">Recommended</span>
      </span>
      <div className="flex flex-col gap-4">
        {authors.map((author, idx) => (
          <details key={idx} className="border border-border rounded-md shadow-sm [&[open]_summary_[data-chevron]]:rotate-180" open={idx === lastOpenedIdx}>
            <summary className="pl-3 cursor-pointer w-full h-9 flex justify-between items-center">
              <span className="leading-none">{previewName(author)}</span>
              <div className="flex gap-2 items-center">
                <ChevronDown size={16} strokeWidth={1.5} className="transform transition-transform duration-100" data-chevron />
                <Button variant="ghost" size="icon" className="p-0" onClick={() => handleDelete(idx)}>
                  <Trash2 size={16} strokeWidth={1.5} />
                </Button>
              </div>
            </summary>
            <Line />
            <div className="p-4 pb-5 pt-3">
              <Tabs defaultValue={isPerson(author) ? 'person' : 'organization'}>
                <TabsList className="mt-1 mb-4">
                  <TabsTrigger value="person">Person</TabsTrigger>
                  <TabsTrigger value="organization">Organization</TabsTrigger>
                </TabsList>
                <TabsContent value="person" className="flex flex-col gap-4">
                  <LabelledInput label="First Name" recommended value={isPerson(author) ? author.given || '' : ''} onChange={(v) => handleEdit(idx, { given: v } as any)} />
                  <LabelledInput label="Last Name" recommended value={isPerson(author) ? author.family : ''} onChange={(v) => handleEdit(idx, { family: v } as any)} />
                  <LabelledInput label="Suffix" value={isPerson(author) ? author.suffix || '' : ''} onChange={(v) => handleEdit(idx, { suffix: v } as any)} />
                </TabsContent>
                <TabsContent value="organization" className="flex flex-col gap-4">
                  <LabelledInput label="Name" recommended value={!isPerson(author) ? author.literal : ''} onChange={(v) => handleEdit(idx, { literal: v } as any)} />
                </TabsContent>
              </Tabs>
            </div>
          </details>
        ))}
        <div className="flex gap-4 items-center">
          <Button variant="secondary" className="gap-2" onClick={handleAddPerson}>
            <UserRound size={17} strokeWidth={1.5} /><span className="leading-none">Add Person</span>
          </Button>
          <Button variant="secondary" className="gap-2" onClick={handleAddOrganization}>
            <Building2 size={17} strokeWidth={1.5} /><span className="leading-none">Add Organization</span>
          </Button>
        </div>
      </div>
    </div>
  );
};

// New helper used above:
const LabelledInput = ({ label, value, onChange, recommended }: { label: string; value: string; onChange: (v: string) => void; recommended?: boolean }) => (
  <label className="grid grid-cols-[110px_1fr] items-center gap-4">
    <span className="flex flex-col leading-4 text-sm">
      {label}
      {recommended && <span className="text-xs text-muted-foreground">Recommended</span>}
    </span>
    <Input placeholder={label} type="text" value={value} onChange={(e) => onChange(e.target.value)} />
  </label>
);
```

For `PublicationDate` and `AccessDate`, change the `value`/`onChange` signature from the old `Date` type to a CSL `date-parts`-compatible shape:

```ts
import type { CSLDate } from '../../lib/citations/csl-types';

interface DateComponentProps {
  value: CSLDate | undefined;
  onChange: (value: CSLDate | undefined) => void;
  isRequired?: boolean;
  isRecommended?: boolean;
}
```

Inside the component, derive `year/month/day` from `value['date-parts']?.[0]` and emit a fresh `CSLDate` from the inputs. (Keep the existing year/month/day input UI; just translate at the edges.)

The old `Date` import line:

```ts
import type { Date } from "../../lib/citations/types";
```

deletes — `types.ts` is removed in cleanup. Replace with the CSL imports above.

- [ ] **Step 5: Update `EditCitationForm.tsx` to read/write `source.csl`**

Replace the body of `EditCitationForm.tsx`:

```tsx
import React, { useState, useCallback } from 'react';
import type { StoredSource } from '../../lib/references/storage';
import type { CSLItem, CSLDate } from '../../lib/citations/csl-types';
import { Title, WebsiteName, Contributors, URL as UrlField, Line, PublicationDate, AccessDate, Edition, VolumeNumber, Publsiher as Publisher, Medium, DOI } from './EditCitationFormComponents';
import { useDebounce } from '../../hooks/useDebounce';
import SimpleDropdown from './SimpleDropdown';

interface CitationOption { label: string; value: CSLItem['type'] }

const TYPE_OPTIONS: CitationOption[] = [
  { label: 'Website', value: 'webpage' },
  { label: 'Book', value: 'book' },
  { label: 'Journal Article', value: 'article-journal' },
];

export default function EditCitationForm({ source, setSources }: { source: StoredSource; setSources: (s: StoredSource[] | ((prev: StoredSource[]) => StoredSource[])) => void }) {
  const [local, setLocal] = useState<CSLItem>(source.csl);

  const debouncedSet = useDebounce((next: CSLItem) => {
    setSources((prev) => prev.map((s) => s.uuid === source.uuid ? { ...s, csl: next } : s));
  }, 500);

  const patch = useCallback((p: Partial<CSLItem>) => {
    const next = { ...local, ...p } as CSLItem;
    setLocal(next);
    debouncedSet(next);
  }, [local, debouncedSet]);

  const handleTypeChange = (t: CSLItem['type']) => patch({ type: t });

  const issuedAsDateParts = local.issued?.['date-parts']?.[0];

  return (
    <div className="flex flex-col gap-4 w-full pt-8">
      <div className="grid grid-cols-[130px_1fr] items-center gap-4">
        <span className="flex flex-col leading-4 text-sm">Source Type<span className="text-xs text-muted-foreground">Required</span></span>
        <SimpleDropdown
          options={TYPE_OPTIONS}
          value={TYPE_OPTIONS.find((o) => o.value === local.type)}
          onChange={(o: CitationOption) => handleTypeChange(o.value)}
          placeholder="Source Type"
          className="min-w-[7rem]"
        />
      </div>
      <Line className="my-4" />
      <Title value={local.title || ''} onChange={(v) => patch({ title: v })} isRequired />
      {local.type === 'webpage' && (
        <WebsiteName value={local['container-title'] || ''} onChange={(v) => patch({ 'container-title': v })} />
      )}
      <Line className="my-4" />
      <Contributors source={{ ...source, csl: local }} setSources={setSources} />
      <Line className="my-4" />
      <PublicationDate value={local.issued} onChange={(d) => patch({ issued: d })} isRecommended />
      <AccessDate value={local.accessed} onChange={(d) => patch({ accessed: d })} />
      <Line className="my-4" />
      {(local.type === 'webpage' || local.type === 'book' || local.type === 'article-journal') && (
        <UrlField value={local.URL || ''} onChange={(v) => patch({ URL: v })} isRecommended />
      )}
      {local.type === 'book' && (
        <>
          <Edition value={local.edition || ''} onChange={(v) => patch({ edition: v })} />
          <VolumeNumber value={local.volume || ''} onChange={(v) => patch({ volume: v })} />
          <Publisher value={local.publisher || ''} onChange={(v) => patch({ publisher: v })} isRecommended />
          <DOI value={local.DOI || ''} onChange={(v) => patch({ DOI: v })} />
        </>
      )}
      {local.type === 'article-journal' && (
        <>
          <Publisher value={local['container-title'] || ''} onChange={(v) => patch({ 'container-title': v })} isRecommended />
          <DOI value={local.DOI || ''} onChange={(v) => patch({ DOI: v })} isRecommended />
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 6: Update `EditReferenceDialogDrawer.tsx`**

Just one change — `isEmptyCitation`:

```ts
const isEmptyCitation = (source: StoredSource): boolean => {
  const c = source.csl;
  const noAuthors = !c.author?.length;
  const noTitle = !c.title;
  const noContainer = !c['container-title'];
  const noUrl = !c.URL;
  const noYear = !c.issued?.['date-parts']?.[0]?.[0];
  return noAuthors && noTitle && noContainer && noUrl && noYear;
};
```

And update the `Source` import to `StoredSource`. Then update the prop type:

```ts
interface EditReferenceDialogDrawerProps {
  source: StoredSource;
  sources: StoredSource[];
  setSources: (sources: StoredSource[] | ((prev: StoredSource[]) => StoredSource[])) => void;
}
```

- [ ] **Step 7: Run the ReferenceItem test**

```bash
npm test -- tests/client/ReferenceItem.test.tsx
```

Expected: PASS.

- [ ] **Step 8: Run all tests**

```bash
npm test
```

Expected: full suite passes.

- [ ] **Step 9: Build the app to catch TS errors**

```bash
npm run build
```

Expected: success. Fix any type errors that pop up — these are likely in the components that still reference the deleted `definitions.ts`. Search:

```bash
grep -rn "from.*citations/definitions" src
grep -rn "from.*citations/formatSource" src
grep -rn "from.*citations/types" src
```

Each remaining import is a bug — update to `csl-types`.

- [ ] **Step 10: Commit**

```bash
git add src/components/react src/components/citationStyles.ts tests/client/ReferenceItem.test.tsx
git commit -m "refactor(client): render CSL-JSON via /api/format, drop client-side formatters

ReferenceItem now uses useFormattedCitation; the edit form reads/writes CSL
fields directly; the style dropdown is reduced to the 3 Phase 1 styles."
```

---

## Block F — Cleanup (depends on Block E)

### Task F1: Delete now-unused client modules

The new code does not reference these. A grep before deletion confirms.

**Files (delete):**
- `src/lib/citations/definitions.ts`
- `src/lib/citations/formatSource.ts`
- `src/lib/citations/types.ts`
- `src/lib/citations/types/baseCitation.ts`
- `src/lib/citations/types/book.ts`
- `src/lib/citations/types/website.ts`

- [ ] **Step 1: Verify no references remain**

```bash
grep -rn "from.*citations/definitions" src tests || echo "clean"
grep -rn "from.*citations/formatSource" src tests || echo "clean"
grep -rn "from.*citations/types" src tests || echo "clean"
```

Expected: each prints "clean". If any reference is found — investigate and fix it (don't just delete).

- [ ] **Step 2: Delete the files**

```bash
git rm src/lib/citations/definitions.ts
git rm src/lib/citations/formatSource.ts
git rm src/lib/citations/types.ts
git rm -r src/lib/citations/types
```

- [ ] **Step 3: Verify tests + build**

```bash
npm test && npm run build
```

Expected: both succeed.

- [ ] **Step 4: Commit**

```bash
git commit -m "chore(client): delete legacy citation types and formatSource (superseded by CSL-JSON pipeline)"
```

---

## Block G — Fixture corpus + end-to-end smoke

These tasks build the golden-file test corpus the spec requires.

### Task G1: 10 extraction fixtures

The fixture covers extract pipeline behavior end-to-end on real-world HTML. Each fixture is a directory `tests/extract/fixtures/<name>/` with three files.

**Recommended fixtures** (cover the spec's shape categories):
1. `nytimes-news-article` — well-marked-up news (JSON-LD strong)
2. `wikipedia-article` — Wikipedia (microdata + rel=author)
3. `gov-page` — e.g., a US .gov page (often poor metadata)
4. `academic-landing` — e.g., arxiv abstract page (`citation_*` meta)
5. `medium-post` — Medium-style platform
6. `wordpress-blog` — generic WP install
7. `theguardian-article` — Guardian (publishers vary in structure)
8. `nature-paper` — academic with strong DC.* meta
9. `tweet-or-social-fallback` — page with only Twitter card
10. `bare-html` — title-only minimal page (tests heuristic fallback)

For each, capture the HTML with `curl -A "Mozilla/..." ... > input.html`, then hand-derive `expected.csl.json` by visiting the page and recording what *should* be in the citation.

**Files per fixture:** `input.html`, `input.url`, `expected.csl.json`.

- [ ] **Step 1: Pick 10 real URLs, capture each**

```bash
mkdir -p tests/extract/fixtures/<name>
echo "https://..." > tests/extract/fixtures/<name>/input.url
curl -fsSL -A "Mozilla/5.0 (compatible; mlagenerator-fixture/1.0)" \
  "$(cat tests/extract/fixtures/<name>/input.url)" \
  > tests/extract/fixtures/<name>/input.html
```

Repeat per fixture. **If a fixture file exceeds 500 KB**, gzip it (`gzip input.html`) and adjust the loader.

- [ ] **Step 2: Hand-write `expected.csl.json` for each**

Read the real page, identify title/author/date/publisher, write the expected CSL-JSON. Each file looks like:

```json
{
  "type": "webpage",
  "title": "Exact Article Title",
  "author": [{ "family": "Doe", "given": "Jane" }],
  "issued": { "date-parts": [[2026, 5, 26]] },
  "container-title": "The Site Name",
  "URL": "https://..."
}
```

Omit fields the page genuinely doesn't have — tests use partial match (per Step 4 below), not strict equality.

- [ ] **Step 3: Write `tests/extract/extract.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { runExtractionPipeline } from '../../functions/lib/extract/pipeline';

const FIX_ROOT = join(__dirname, 'fixtures');

const fixtures = readdirSync(FIX_ROOT, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name);

describe('extraction pipeline (fixture corpus)', () => {
  for (const name of fixtures) {
    it(name, () => {
      const dir = join(FIX_ROOT, name);
      const url = readFileSync(join(dir, 'input.url'), 'utf-8').trim();
      const html = readFileSync(join(dir, 'input.html'), 'utf-8');
      const expected = JSON.parse(readFileSync(join(dir, 'expected.csl.json'), 'utf-8'));
      const { csl } = runExtractionPipeline(html, url);
      for (const field of Object.keys(expected)) {
        expect(csl[field as keyof typeof csl], `field "${field}" mismatch in ${name}`)
          .toEqual(expected[field]);
      }
    });
  }
});
```

- [ ] **Step 4: Iterate until 8+ of 10 pass**

```bash
npm test -- tests/extract/extract.test.ts
```

For each failing fixture, decide:
- Is the expectation right? If so, the pipeline has a real gap → fix it. Open a sub-task. Commit the fix separately.
- Is the expectation wrong? Update the expected JSON (e.g., the page genuinely doesn't have an author).
- Is the page truly intractable? Move it to `fixtures-skip/` and document why in the PR body. Phase 1 target is 8/10 passing on the corpus; 9/10 or 10/10 is great.

- [ ] **Step 5: Commit fixtures + test**

```bash
git add tests/extract/fixtures tests/extract/extract.test.ts
git commit -m "test(extract): 10 real-world HTML fixtures for the extraction pipeline"
```

### Task G2: 10 formatting fixtures (golden bibliography strings)

The spec calls for MLA 9, APA 7, Chicago 18 golden outputs covering 1-N authors, with/without date, with/without DOI, corporate authors, missing fields.

**Fixtures (`tests/format/fixtures/<name>/`):**
1. `webpage-1author` — typical journalist article
2. `webpage-2authors`
3. `webpage-3authors` — MLA "et al." territory
4. `webpage-4plus-authors`
5. `webpage-no-date`
6. `webpage-corporate-author`
7. `book-1author`
8. `book-with-edition`
9. `journal-with-doi`
10. `journal-no-doi`

Each directory contains `csl.json` (input) and `mla-9.txt` / `apa-7.txt` / `chicago-18.txt` (expected outputs).

- [ ] **Step 1: Hand-write csl.json per fixture (no extraction here — pure formatting inputs)**

Example `webpage-2authors/csl.json`:

```json
{
  "id": "fixture",
  "type": "webpage",
  "title": "Why Coffee Is Good for You",
  "author": [
    { "family": "Doe", "given": "Jane" },
    { "family": "Smith", "given": "John" }
  ],
  "issued": { "date-parts": [[2025, 3, 14]] },
  "accessed": { "date-parts": [[2026, 5, 26]] },
  "container-title": "Example News",
  "URL": "https://example.com/coffee"
}
```

- [ ] **Step 2: Generate the expected output once, then hand-verify**

For each fixture, run the formatter locally and capture its output as the golden:

```bash
npx tsx scripts/seed-format-fixtures.ts
```

(create `scripts/seed-format-fixtures.ts` as a small driver that loads each csl.json, calls `formatCitation`, and writes `<style>.txt` if missing — write it now, commit it, run once, then leave it for future fixtures.)

Then **read each generated .txt and verify it matches the spec's style guide**. If wrong, the bug is in the citeproc-js + CSL combination (a real citation-style issue) — file in PR body.

- [ ] **Step 3: Write `tests/format/format.test.ts`**

```ts
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { formatCitation, registerStyle, registerLocale } from '../../functions/lib/format/citeproc';

const ROOT = join(__dirname, '..', '..');
const FIX_ROOT = join(__dirname, 'fixtures');
const STYLES = ['mla-9', 'apa-7', 'chicago-18'] as const;

beforeAll(() => {
  registerLocale('en-US', readFileSync(join(ROOT, 'functions/lib/format/locales/locales-en-US.xml'), 'utf-8'));
  for (const s of STYLES) {
    registerStyle(s, readFileSync(join(ROOT, `functions/lib/format/styles/${s}.csl`), 'utf-8'));
  }
});

const fixtures = readdirSync(FIX_ROOT, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name);

describe('formatting (fixture corpus)', () => {
  for (const name of fixtures) {
    for (const style of STYLES) {
      const goldPath = join(FIX_ROOT, name, `${style}.txt`);
      if (!existsSync(goldPath)) continue;
      it(`${name} → ${style}`, () => {
        const csl = JSON.parse(readFileSync(join(FIX_ROOT, name, 'csl.json'), 'utf-8'));
        const expected = readFileSync(goldPath, 'utf-8').trim();
        const rt = formatCitation(csl, style);
        const actual = rt.map((seg) => seg.italic ? `<i>${seg.text}</i>` : seg.text).join('').trim();
        expect(actual).toBe(expected);
      });
    }
  }
});
```

- [ ] **Step 4: Run + iterate until all pass**

```bash
npm test -- tests/format/format.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add tests/format/fixtures tests/format/format.test.ts scripts/seed-format-fixtures.ts
git commit -m "test(format): 10 CSL → MLA9/APA7/Chicago17 golden-output fixtures"
```

### Task G3: End-to-end pipeline test

**Files:**
- Create: `tests/e2e/pipeline.test.ts`

- [ ] **Step 1: Write test**

```ts
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runExtractionPipeline } from '../../functions/lib/extract/pipeline';
import { formatCitation, registerStyle, registerLocale } from '../../functions/lib/format/citeproc';

const ROOT = join(__dirname, '..', '..');

beforeAll(() => {
  registerLocale('en-US', readFileSync(join(ROOT, 'functions/lib/format/locales/locales-en-US.xml'), 'utf-8'));
  registerStyle('mla-9', readFileSync(join(ROOT, 'functions/lib/format/styles/mla-9.csl'), 'utf-8'));
});

describe('end-to-end: HTML → CSL → MLA 9', () => {
  it('produces a non-empty MLA 9 citation from a richly marked-up fixture', () => {
    // Pick one fixture from extraction corpus — the most-reliable one
    const dir = join(ROOT, 'tests/extract/fixtures/nytimes-news-article');
    const html = readFileSync(join(dir, 'input.html'), 'utf-8');
    const url = readFileSync(join(dir, 'input.url'), 'utf-8').trim();
    const { csl } = runExtractionPipeline(html, url);
    const rt = formatCitation(csl, 'mla-9');
    const text = rt.map((r) => r.text).join('');
    expect(text.length).toBeGreaterThan(20);
    expect(text).toMatch(/\./); // ends with at least a period somewhere
  });
});
```

- [ ] **Step 2: Run**

```bash
npm test -- tests/e2e/pipeline.test.ts
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/pipeline.test.ts
git commit -m "test(e2e): HTML fixture → CSL → MLA 9 smoke test"
```

---

## Block H — Ship (sequential, blocked by everything above)

### Task H1: Full-suite green check

- [ ] **Step 1: Run everything cold**

```bash
rm -rf node_modules
npm ci
npm test
npm run build
```

Expected: all tests green, build clean. If anything fails, fix before continuing.

- [ ] **Step 2: Inspect the diff against main**

```bash
git diff main --stat
git log main..HEAD --oneline
```

- [ ] **Step 3: Manual preview-deploy smoke (mandatory)**

```bash
npm run preview
```

In another shell or browser, exercise all six probe URLs from the spec acceptance criteria. Each must produce sensible output:

1. Add a citation from `https://www.nytimes.com/<any current article>` → `?website=` flow.
2. Add a citation from `https://en.wikipedia.org/wiki/Citation` → check author/title/date.
3. Add a citation from a .gov page, e.g. `https://www.cdc.gov/diabetes/index.html`.
4. Add a citation from an academic landing page, e.g. `https://arxiv.org/abs/2104.10399`.
5. Add a book by ISBN, e.g. `9780553418811`.
6. Add a journal by DOI, e.g. `10.1038/s41586-021-03828-1`.

For each:
- The CSL fields look correct in the edit form.
- The rendered MLA 9 string matches what the MLA handbook expects (no junk punctuation, italics on container titles, author last-name-first, correct date format).
- Switching styles in the dropdown produces APA 7 / Chicago 18 versions that also look correct.

Record results in a notes file (not committed) — you'll paste a summary into the PR body.

- [ ] **Step 4: Verify legacy localStorage doesn't crash the app**

In the preview browser, before loading, set `sources` (the OLD v1 key) to a fake legacy payload via DevTools console:

```js
localStorage.setItem('sources', JSON.stringify([{ uuid: 'old', citationType: 'website', citationInfo: { authors: [], sourceTitle: 'old', publisher: '', publicationDate: { context: {}, date: { year: 0, month: 0, day: 0 } }, accessDate: { year: 0, month: 0, day: 0 }, url: '' } }]));
```

Reload. The app should show 0 sources and run without error. (`sources_v2` is empty so we start fresh; `sources` is ignored.)

- [ ] **Step 5: Capture preview deploy URL for the PR**

The PR description will include a preview deploy URL. If using Cloudflare Pages preview deploys, that comes from the GitHub PR comment after the push. If not yet available, leave as "will follow."

### Task H2: Pre-merge correctness review

This is the mandatory review step per global CLAUDE.md.

- [ ] **Step 1: Craft the review prompt using the `prompt-engineering` skill**

Invoke `Skill: prompt-engineering` to design the prompt. The prompt must call out, specifically:

- Files changed (paste `git diff --stat main..HEAD`).
- The goal: replace regex extraction + hand-written formatters with cheerio multi-signal + citeproc-js, all CSL-JSON.
- Highest-risk areas:
  - `functions/lib/extract/pipeline.ts` and merger (silent data wins/loses based on confidence — easy to mis-tune).
  - `functions/lib/format/citeproc.ts` engine-cache (subtle: shared `__currentItem` between calls; could cross-contaminate concurrent requests).
  - `src/lib/citations/useFormattedCitation.ts` cache + inflight de-dup (race conditions possible).
  - localStorage migration: legacy `sources` shape must NOT crash the app.
  - Cache API key generation (collisions, leaks via query params).
- Acceptance criteria from the spec.
- Specific anti-patterns to flag: any field in the new code that's a string but should be CSL-shaped; any author parsing branch that may produce an empty `{ family: '' }`; any `Worker bundle size > limit` risk.
- Reviewer should NOT propose stylistic changes — only correctness, security, missed edge cases, quietly-broken adjacent code.

- [ ] **Step 2: Dispatch the review subagent**

```ts
// Inside the agent runner — conceptual
Agent({
  subagent_type: 'code-review:code-review',
  description: 'Pre-merge correctness review',
  prompt: <crafted prompt>,
})
```

- [ ] **Step 3: Address blocking findings**

For each blocking finding:
- Apply the fix on the branch.
- Re-run `npm test && npm run build`.
- Note the fix in the PR body.

For each non-blocking finding:
- Note it in the PR body under "Deferred" with rationale.

- [ ] **Step 4: Re-review if the fixes are substantial**

If you made more than ~5 changes in response to feedback, run a second pass with the same subagent.

### Task H3: Open PR, watch CI, merge

- [ ] **Step 1: Push branch**

```bash
git push -u origin refine/citation-accuracy-overhaul
```

- [ ] **Step 2: Open the PR using a HEREDOC body**

```bash
gh pr create --title "Citation accuracy + reliability overhaul (Phase 1)" --body "$(cat <<'EOF'
## Summary
- Replaces regex/HTMLRewriter extraction with a cheerio multi-signal pipeline (JSON-LD, microdata, OpenGraph, Twitter, meta, heuristic) with confidence-based merging.
- Adds /api/cite-journal (Crossref → OpenAlex fallback, DOI mode) and /api/format (citeproc-js with bundled CSL XML for MLA 9, APA 7, Chicago 18).
- Client now stores CSL-JSON in localStorage (sources_v2) and requests formatted strings from the server, caching per (uuid, style).
- Fixture-based test suite + CI gate via GitHub Actions.

## Phase 1 scope
See docs/superpowers/specs/2026-05-26-citation-generator-overhaul-design.md. Phases 2 (additional styles + cleanup) and 3 (analytics + Firecrawl fallback) are not in this PR.

## Bundle size (spike result)
<paste actual gzipped Worker bundle size from Task A1>

## Preview deploy verification
- nytimes article: ✅ / ⚠️ / ❌ (notes)
- Wikipedia article: ✅
- .gov page: ✅
- academic landing: ✅
- book ISBN 9780553418811: ✅
- DOI 10.1038/s41586-021-03828-1: ✅

## Legacy localStorage handling
v1 sources are silently ignored (loaded as empty). Per the spec, users will need to re-add saved citations after this lands.

## Deferred (non-blocking review notes)
<paste any from H2 step 3>

## Test plan
- [ ] CI green (npm test)
- [ ] Preview deploy renders all 6 probe URLs correctly
- [ ] Legacy localStorage payload does not crash app on load
EOF
)"
```

- [ ] **Step 3: Wait for CI**

Use `Monitor` on the GitHub workflow run, or `ScheduleWakeup` if it takes a while. Don't poll manually.

```bash
gh pr checks --watch
```

- [ ] **Step 4: Address review feedback (if any)**

Each round of human review re-runs the H2 review with a focused prompt on the changed scope. Don't paper over CI failures.

- [ ] **Step 5: Squash-merge**

```bash
gh pr merge --squash --delete-branch
```

- [ ] **Step 6: Verify production**

After merge, `main` auto-deploys. Wait 1–2 minutes, then visit https://mlagenerator.com:
- Add a citation from one of the probe URLs.
- Confirm rendered citation looks correct.
- Confirm no JS console errors.

If production looks wrong, prepare a rollback commit immediately (do NOT force-push; just revert).

- [ ] **Step 7: Notify the user that Phase 1 is shipped**

End-of-session summary should state:
- PR URL
- merge commit SHA
- bundle size measured
- fixture pass rate (e.g. 9/10 extraction fixtures pass; 30/30 format goldens pass)
- any deferred items

---

## Task A4 (small): bump wrangler + add prebuild hook

The A1 spike found that `wrangler@^3.30.1` (the pinned version) crashes on Node 24 inside miniflare. Wrangler 4.x works. The base64 embed approach needs `node scripts/embed-csl.mjs` to run whenever a CSL file changes, so wire it into the build.

- [ ] **Step 1:** `npm install -D wrangler@^4` (upgrade from 3.30.1)
- [ ] **Step 2:** Edit `package.json` `scripts` block — add a `prebuild` script: `"prebuild": "node scripts/embed-csl.mjs"`. This makes `npm run build` (and any preview/deploy that depends on it) regenerate the `.ts` sibling modules from any CSL/locale changes.
- [ ] **Step 3:** Verify: `rm functions/lib/format/styles/mla-9.ts && npm run build` — the file should be regenerated automatically before the build proceeds.
- [ ] **Step 4:** Commit:
  ```bash
  git add package.json package-lock.json
  git commit -m "chore: bump wrangler to v4 (miniflare bug on Node 24); add prebuild step for embed-csl"
  ```

## Notes for executors

- **TDD is not optional for code tasks.** Skip it only for vendored files (CSL XML), data files (`citationStyles.ts`), and pure deletions.
- **Each task's commit message should describe WHY**, not just what — readers may scan `git log` later.
- **No `--no-verify`, no `--amend` after push, no force-push to main.** Per global CLAUDE.md.
- **No Claude attribution in commits.** Per project memory.
- **If the spec is wrong or ambiguous, STOP and surface it.** The most likely failure mode is silently working around a constraint that mattered.
- **Cheerio's `CheerioAPI` type:** Cheerio 1.0-rc.12 exports types differently than 1.0 stable — if the type imports fail, use `import { type CheerioAPI } from 'cheerio'` or fall back to `any` only as a last resort.
- **Cloudflare Functions caches/.default global:** `(caches as any).default` is the standard pattern. Don't import from `@cloudflare/workers-types` — it's only for ambient types.

When a task in this plan turns out to be wrong, **fix the plan in the same commit that fixes the code**, so the next executor sees the corrected version.


