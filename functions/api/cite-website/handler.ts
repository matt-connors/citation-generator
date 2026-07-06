import { runExtractionPipeline } from '../../lib/extract/pipeline';
import { fetchHtml, FetchError } from '../../lib/extract/fetch';
import { normalizeUrl } from '../../lib/extract/url-normalize';
import { TTL } from '../../lib/cache';
import type { AcquisitionAttempt, AcquisitionSource, CSLDate, ExtractEnvelope } from '../../lib/csl-types';
import { writeEvent, fromAttribution, type AnalyticsBinding } from '../../lib/analytics';
import { analyzeHtmlReadiness, extractReadableText, shouldTryRenderedAcquisition, type PageReadiness } from '../../lib/acquisition/page-readiness';
import { renderHtmlWithBrowserRun, RenderError, type BrowserRunBinding } from '../../lib/acquisition/browser-run';
import { mergePipelineResults, addEvidenceToResult, type MergedCitationEvidence } from '../../lib/provenance/merge';
import { runOembedAssist, shouldRunOembedAssist } from '../../lib/extract/oembed';
import { validateCitationQuality } from '../../lib/validation/citation-quality';
import { runAiFieldAssist, type AiBinding } from '../../lib/ai/citation-assist';
import type { PipelineResult } from '../../lib/extract/pipeline';

export interface MinCache {
  get(key: string): Promise<Response | undefined>;
  put(key: string, response: Response, maxAgeSeconds: number): Promise<void>;
}

export interface CiteWebsiteDeps {
  browser?: BrowserRunBinding;
  ai?: AiBinding;
  aiModel?: string;
  acquisitionMode?: AcquisitionMode;
  aiAssistEnabled?: boolean;
  bypassCache?: boolean;
  renderingEnabled?: boolean;
}

type AcquisitionMode = 'auto' | 'fetch' | 'render';
const WEBSITE_CACHE_VERSION = 'citation-website-v2';

export async function handleCiteWebsite(
  requestUrl: URL,
  cache: MinCache | null,
  analytics?: AnalyticsBinding,
  now = new Date(),
  deps: CiteWebsiteDeps = {},
): Promise<Response> {
  const raw = requestUrl.searchParams.get('url');
  if (!raw) {
    writeEvent(analytics, 'error', { endpoint: 'cite_website', code: 'invalid_url' }, { count: 1 });
    return errorResponse(400, 'invalid_url', 'Missing url parameter', false);
  }

  let target: string;
  try {
    const decoded = decodeURIComponent(raw);
    target = normalizeUrl(decoded.startsWith('http') ? decoded : `https://${decoded}`);
  } catch {
    writeEvent(analytics, 'error', { endpoint: 'cite_website', code: 'invalid_url' }, { count: 1 });
    return errorResponse(400, 'invalid_url', 'Malformed URL', false);
  }

  const host = hostOf(target);
  const from = fromAttribution(requestUrl);
  const mode = deps.acquisitionMode ?? 'auto';
  const aiEnabled = deps.aiAssistEnabled !== false;

  const bypassCache = deps.bypassCache === true;
  const allowCache = mode !== 'render';
  const cacheKey = cacheKeyFor(target);
  if (cache && !bypassCache && allowCache) {
    const hit = await cache.get(cacheKey);
    if (hit) {
      const body = await hit.json() as ExtractEnvelope;
      body._cached = true;
      body._quality = body._quality ?? validateCitationQuality(body.csl, {
        provenance: body._provenance,
        acquisition: body._quality?.acquisition,
      });
      writeEvent(analytics, 'cite_website',
        {
          signal_winner_title: body._signals?.title ?? '',
          signal_winner_url: body._signals?.URL ?? '',
          host,
          url: target,
          from,
        },
        { html_size_kb: 0, extraction_ms: 0, cache_hit: 1, fetch_ms: 0 },
      );
      return jsonResponse(body);
    }
  }

  const acquiredAt = now.toISOString();
  const attempts: Partial<Record<AcquisitionSource, AcquisitionAttempt>> = {};
  const results: PipelineResult[] = [];
  let fetchedHtml = '';
  let renderedHtml = '';
  let fetchMs = 0;
  let extractionMs = 0;
  let finalUrl = target;
  let fetchReadiness: PageReadiness | undefined;

  if (mode !== 'render') {
    const fetchStart = Date.now();
    try {
      const fetched = await fetchHtml(target);
      fetchedHtml = fetched.html;
      finalUrl = fetched.finalUrl;
      fetchMs = Date.now() - fetchStart;
      const readiness = analyzeHtmlReadiness(fetchedHtml, finalUrl);
      fetchReadiness = readiness;
      const extractStart = Date.now();
      const result = runExtractionPipeline(fetchedHtml, finalUrl, { acquisition: 'fetch', acquiredAt });
      extractionMs += Date.now() - extractStart;
      attempts.fetch = attemptFromReadiness('fetch', readiness, target, finalUrl, fetchMs, fetchedHtml, result);
      results.push(result);
    } catch (err) {
      fetchMs = Date.now() - fetchStart;
      if (err instanceof FetchError) {
        attempts.fetch = {
          source: 'fetch',
          status: statusFromFetchError(err),
          reason: err.message,
          url: target,
          durationMs: fetchMs,
        };
        writeEvent(analytics, 'error', { endpoint: 'cite_website', code: err.code }, { count: 1 });
        if (!deps.browser || mode === 'fetch') {
          return errorResponse(400, err.code, err.message, err.retryable);
        }
      } else {
        attempts.fetch = {
          source: 'fetch',
          status: 'error',
          reason: String((err as Error).message),
          url: target,
          durationMs: fetchMs,
        };
        writeEvent(analytics, 'error', { endpoint: 'cite_website', code: 'internal' }, { count: 1 });
        if (!deps.browser || mode === 'fetch') {
          return errorResponse(500, 'internal', String((err as Error).message), false);
        }
      }
    }
  }

  const fetchResult = results[0];
  const renderWanted = deps.renderingEnabled !== false && shouldRender(mode, fetchResult, attempts.fetch, fetchReadiness);
  if (renderWanted) {
    if (!deps.browser) {
      attempts.render = {
        source: 'render',
        status: 'skipped',
        reason: 'Browser Run binding is not configured.',
        url: target,
      };
      if (!results.length) {
        return errorResponse(400, 'render_unavailable', 'Browser rendering is not configured.', true);
      }
    } else {
      const renderStart = Date.now();
      try {
        const rendered = await renderHtmlWithBrowserRun(deps.browser, target);
        renderedHtml = rendered.html;
        const readiness = analyzeHtmlReadiness(renderedHtml, target);
        const extractStart = Date.now();
        const result = runExtractionPipeline(renderedHtml, target, { acquisition: 'render', acquiredAt });
        extractionMs += Date.now() - extractStart;
        attempts.render = attemptFromReadiness(
          'render',
          readiness,
          target,
          target,
          Date.now() - renderStart,
          renderedHtml,
          result,
          rendered.browserMs,
        );
        results.push(result);
      } catch (err) {
        attempts.render = {
          source: 'render',
          status: err instanceof RenderError && err.code === 'render_timeout' ? 'timeout' : 'error',
          reason: (err as Error).message,
          url: target,
          durationMs: Date.now() - renderStart,
        };
        if (!results.length) {
          return errorResponse(400, err instanceof RenderError ? err.code : 'render_failed', (err as Error).message, true);
        }
      }
    }
  }

  let merged = mergePipelineResults(results, finalUrl || target);

  // Platform oEmbed rescue: X serves an empty JS shell to non-browsers, and
  // TikTok's bot wall can defeat both fetch and render — but their public
  // oEmbed APIs hand over the post's text, author, and (for X) date. Runs
  // before AI assist so the deterministic source wins and the LLM step can
  // usually be skipped entirely.
  if (shouldRunOembedAssist(merged.csl, target)) {
    const oembedStart = Date.now();
    const assist = await runOembedAssist(target, { acquiredAt });
    attempts.authority = {
      source: 'authority',
      status: assist ? 'success' : 'error',
      reason: assist
        ? 'Platform oEmbed supplied citation fields.'
        : 'Platform oEmbed returned no usable fields.',
      url: target,
      durationMs: Date.now() - oembedStart,
      fieldsFound: assist ? assist.evidence.map((item) => String(item.field)) : [],
    };
    if (assist) {
      if (assist.social && !merged.csl.custom?.social) {
        merged.csl.custom = { ...merged.csl.custom, social: assist.social };
      }
      merged = addEvidenceToResult(merged, assist.evidence);
    }
  }

  if (deps.ai && aiEnabled && shouldRunAiAssist(merged.csl, fetchedHtml, renderedHtml)) {
    const aiStart = Date.now();
    try {
      const evidence = await runAiFieldAssist({
        ai: deps.ai,
        model: deps.aiModel,
        csl: merged.csl,
        fetchedText: extractReadableText(fetchedHtml),
        renderedText: extractReadableText(renderedHtml),
        url: finalUrl || target,
        acquiredAt,
      });
      attempts.ai = {
        source: 'ai',
        status: evidence.length ? 'success' : 'partial',
        reason: evidence.length ? 'AI suggested evidence-backed fields.' : 'AI returned no usable evidence-backed fields.',
        url: target,
        durationMs: Date.now() - aiStart,
        fieldsFound: evidence.map((item) => String(item.field)),
      };
      if (evidence.length) merged = addEvidenceToResult(merged, evidence);
    } catch (err) {
      attempts.ai = {
        source: 'ai',
        status: 'error',
        reason: (err as Error).message,
        url: target,
        durationMs: Date.now() - aiStart,
      };
    }
  }

  merged = withAccessDate(merged, now);
  const quality = validateCitationQuality(merged.csl, {
    provenance: merged.provenance,
    acquisition: attempts,
  });

  const envelope: ExtractEnvelope = {
    uuid: target,
    type: merged.csl.type,
    csl: merged.csl,
    _signals: merged.signals,
    _provenance: merged.provenance,
    _quality: quality,
    _cached: false,
  };
  const response = jsonResponse(envelope);

  // Emit before cache.put so a cache-write failure (network blip into the
  // Cache API) doesn't swallow the analytics event for an otherwise-
  // successful request — those slow-tail successes are precisely what the
  // dashboard wants to see.
  writeEvent(analytics, 'cite_website',
    {
      signal_winner_title: merged.signals.title ?? '',
      signal_winner_url: merged.signals.URL ?? '',
      host,
      url: target,
      from,
    },
    {
      html_size_kb: Math.round((fetchedHtml || renderedHtml).length / 1024),
      extraction_ms: extractionMs,
      cache_hit: 0,
      fetch_ms: fetchMs,
    },
  );
  writeAcquisitionEvents(analytics, host, attempts);

  if (cache && !bypassCache && allowCache) {
    await cache.put(cacheKey, response.clone(), TTL.WEBSITE);
  }
  return response;
}

function hostOf(url: string): string {
  try { return new URL(url).hostname; } catch { return ''; }
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { 'content-type': 'application/json' },
  });
}

function dateFrom(date: Date): CSLDate {
  return {
    'date-parts': [[date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate()]],
  };
}

function errorResponse(status: number, code: string, message: string, retryable: boolean): Response {
  return new Response(JSON.stringify({ error: message, code, retryable }), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

export function acquisitionMode(value: string | null): AcquisitionMode {
  return value === 'fetch' || value === 'render' || value === 'auto' ? value : 'auto';
}

function cacheKeyFor(target: string): string {
  return `https://cache.mlagenerator.local/${WEBSITE_CACHE_VERSION}?url=${encodeURIComponent(target)}`;
}

function statusFromFetchError(err: FetchError): AcquisitionAttempt['status'] {
  if (err.code === 'blocked') return 'blocked';
  if (err.code === 'timeout') return 'timeout';
  return err.retryable ? 'partial' : 'error';
}

function attemptFromReadiness(
  source: AcquisitionSource,
  readiness: PageReadiness,
  url: string,
  finalUrl: string,
  durationMs: number,
  html: string,
  result: PipelineResult,
  browserMs?: number,
): AcquisitionAttempt {
  const status = readiness.status === 'ready' ? 'success' : readiness.status;
  return {
    source,
    status,
    reason: readiness.reason,
    url,
    finalUrl,
    durationMs,
    htmlSizeKb: Math.round(html.length / 1024),
    browserMs,
    fieldsFound: Object.keys(result.signals),
  };
}

function shouldRender(
  mode: AcquisitionMode,
  result: PipelineResult | undefined,
  fetchAttempt: AcquisitionAttempt | undefined,
  readiness: PageReadiness | undefined,
): boolean {
  if (mode === 'render') return true;
  if (mode === 'fetch') return false;
  if (!result) return fetchAttempt?.status === 'blocked' || fetchAttempt?.status === 'timeout' || fetchAttempt?.status === 'partial';
  const fallbackReadiness: PageReadiness = {
    status: fetchAttempt?.status === 'success' ? 'ready' : fetchAttempt?.status === 'blocked' ? 'blocked' : 'partial',
    title: '',
    textLength: 0,
    metadataFieldCount: result.provenance ? Object.keys(result.provenance).length : 0,
    articleLikeTextLength: 0,
    scriptTextLength: 0,
    blockerSignals: [],
    stableSignals: [],
    reason: fetchAttempt?.reason || '',
  };
  return shouldTryRenderedAcquisition(result.csl, readiness ?? fallbackReadiness);
}

function shouldRunAiAssist(csl: MergedCitationEvidence['csl'], fetchedHtml: string, renderedHtml: string): boolean {
  if (!fetchedHtml && !renderedHtml) return false;
  const missingCore = !csl.title || !csl.author?.length || !csl.issued?.['date-parts']?.[0]?.[0];
  // Social posts have no publisher and their container is fixed by the
  // platform — asking the AI to fill those invites junk like publisher
  // "Google LLC" scraped from a YouTube page footer.
  if (csl.custom?.social) return missingCore;
  return missingCore || !csl.publisher || !csl['container-title'];
}

function withAccessDate(result: MergedCitationEvidence, now: Date): MergedCitationEvidence {
  return {
    ...result,
    csl: {
      ...result.csl,
      accessed: result.csl.accessed ?? dateFrom(now),
    },
  };
}

function writeAcquisitionEvents(
  analytics: AnalyticsBinding | undefined,
  host: string,
  attempts: Partial<Record<AcquisitionSource, AcquisitionAttempt>>,
): void {
  for (const attempt of Object.values(attempts)) {
    if (!attempt) continue;
    writeEvent(analytics, 'cite_website_acquisition',
      {
        host,
        source: attempt.source,
        status: attempt.status,
        reason: attempt.reason ?? '',
      },
      {
        duration_ms: attempt.durationMs ?? 0,
        html_size_kb: attempt.htmlSizeKb ?? 0,
        browser_ms: attempt.browserMs ?? 0,
      },
    );
  }
}
