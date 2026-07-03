import {
  CITATION_STYLES,
  DEFAULT_STYLE,
  HISTORY_STORAGE_KEY,
  REFERENCES_STORAGE_KEY,
  TAB_STATE_STORAGE_KEY,
  buildEditOnSiteUrl,
  buildFormatApiUrl,
  buildReferencesUrl,
  displayTitle,
  errorMessage,
  escapeHtml,
  historyEntryFromCitation,
  isCiteableUrl,
  isSupportedStyle,
  mergeHistoryEntries,
  richTextToHtml,
  richTextToPlain,
  sourceFromCsl,
  tabHost,
  tabStateKey,
} from './popup-core.mjs';
import { citationFromSnapshot, detailRows } from './page-extractor.mjs';

const COPY_STYLE = 'font-family:"Times New Roman",Times,serif;font-size:12pt;line-height:2;';

const els = {
  host: document.getElementById('tab-host'),
  title: document.getElementById('tab-title'),
  url: document.getElementById('tab-url'),
  status: document.getElementById('status'),
  style: document.getElementById('style-select'),
  history: document.getElementById('history-button'),
  historyPanel: document.getElementById('history-panel'),
  historyList: document.getElementById('history-list'),
  historyClear: document.getElementById('history-clear'),
  cite: document.getElementById('cite-button'),
  citeText: document.querySelector('#cite-button .button-text'),
  result: document.getElementById('result'),
  resultCount: document.getElementById('detail-count'),
  output: document.getElementById('citation-output'),
  details: document.getElementById('details-list'),
  copy: document.getElementById('copy-button'),
  edit: document.getElementById('edit-button'),
};

let currentTab = null;
let currentCsl = null;
let currentSegments = [];
let currentPlain = '';
let currentDetailCount = 0;
let currentPageLoadKey = '';
let currentPageUrl = '';

init().catch((error) => {
  setStatus(errorMessage(error), 'error');
  setBusy(false);
});

async function init() {
  populateStyles();
  const saved = await storageGet({ citationStyle: DEFAULT_STYLE });
  els.style.value = isSupportedStyle(saved.citationStyle) ? saved.citationStyle : DEFAULT_STYLE;
  els.style.addEventListener('change', async () => {
    storageSet({ citationStyle: els.style.value });
    if (currentCsl) await reformatCurrentCitation();
  });
  els.cite.addEventListener('click', () => citeCurrentTab());
  els.copy.addEventListener('click', () => copyCitation());
  els.edit.addEventListener('click', () => openOnSite());
  els.history.addEventListener('click', () => toggleHistory());
  els.historyList.addEventListener('click', (event) => restoreHistorySelection(event));
  els.historyClear.addEventListener('click', () => clearHistory());
  await renderHistory();

  currentTab = await activeTab();
  renderTab(currentTab);
  if (!isCiteableUrl(currentTab?.url || '')) {
    setStatus('Open an HTTP or HTTPS page to cite it.', 'error');
    els.cite.disabled = true;
  } else {
    const restored = await restoreTabCitationState(currentTab);
    setStatus(restored ? 'Citation ready.' : 'Ready to cite this page.');
    setBusy(false);
  }
}

function populateStyles() {
  for (const style of CITATION_STYLES) {
    const option = document.createElement('option');
    option.value = style.value;
    option.textContent = style.label;
    els.style.append(option);
  }
}

async function activeTab() {
  const tabs = await chromePromise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, resolve);
  });
  return tabs?.[0] || null;
}

function renderTab(tab) {
  const url = tab?.url || '';
  renderSourceSummary(displayTitle(tab), url);
}

function renderSourceSummary(title, url) {
  els.title.textContent = title || 'Current page';
  els.url.textContent = url || '';
  els.host.textContent = tabHost(url) || 'Current tab';
}

async function citeCurrentTab() {
  if (!isCiteableUrl(currentTab?.url || '')) return;
  setBusy(true);
  setStatus('Reading page details.');
  els.result.hidden = true;
  currentCsl = null;
  currentSegments = [];
  currentPlain = '';
  currentDetailCount = 0;

  try {
    const snapshot = await captureActivePageSnapshot(currentTab);
    currentPageLoadKey = snapshot.pageLoadKey || '';
    currentPageUrl = snapshot.url || currentTab.url || '';
    const extracted = citationFromSnapshot(snapshot, new Date());
    currentCsl = extracted.csl;
    currentDetailCount = extracted.detailCount;
    renderCapturedDetails();

    setStatus('Formatting citation.');
    await formatCurrentCitation();
    await saveCurrentToHistory();
    await saveCurrentToTabState();
    setStatus(currentDetailCount > 0
      ? `Citation ready. ${currentDetailCount} details captured.`
      : 'Citation ready.');
  } catch (error) {
    setStatus(errorMessage(error), 'error');
    els.result.hidden = true;
  } finally {
    setBusy(false);
  }
}

async function reformatCurrentCitation() {
  if (!currentCsl) return;
  setBusy(true);
  setStatus('Updating citation style.');
  try {
    await formatCurrentCitation();
    await saveCurrentToHistory();
    await saveCurrentToTabState();
    setStatus('Citation ready.');
  } catch (error) {
    setStatus(errorMessage(error), 'error');
  } finally {
    setBusy(false);
  }
}

async function formatCurrentCitation() {
  const formatted = await fetchJson(buildFormatApiUrl(), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ csl: currentCsl, style: els.style.value }),
  }, 15_000);
  currentSegments = formatted?.formatted || [];
  currentPlain = richTextToPlain(currentSegments);
  renderCurrentCitation();
}

async function saveCurrentToHistory() {
  if (!currentCsl) return;
  const current = await storageLocalGet({ [HISTORY_STORAGE_KEY]: [] });
  const entry = historyEntryFromCitation(currentCsl, els.style.value, currentPlain);
  await storageLocalSet({
    [HISTORY_STORAGE_KEY]: mergeHistoryEntries(current[HISTORY_STORAGE_KEY], entry),
  });
  await renderHistory();
}

async function restoreTabCitationState(tab) {
  try {
    const pageState = await captureActivePageState(tab);
    currentPageLoadKey = pageState.pageLoadKey || '';
    currentPageUrl = pageState.url || tab?.url || '';
    const stored = await storageEphemeralGet({ [TAB_STATE_STORAGE_KEY]: {} });
    const states = stored[TAB_STATE_STORAGE_KEY] || {};
    const saved = states[tabStateKey(tab.id, currentPageUrl)];
    if (!saved || saved.pageLoadKey !== currentPageLoadKey || !saved.csl || !Array.isArray(saved.segments)) {
      return false;
    }

    if (isSupportedStyle(saved.style)) els.style.value = saved.style;
    currentCsl = saved.csl;
    currentSegments = saved.segments;
    currentPlain = saved.plain || richTextToPlain(currentSegments);
    currentDetailCount = saved.detailCount || detailRows(currentCsl).length;
    renderSourceSummary(saved.title || currentCsl.title || pageState.title, currentCsl.URL || currentPageUrl);
    renderCapturedDetails();
    renderCurrentCitation();
    return true;
  } catch {
    return false;
  }
}

async function saveCurrentToTabState() {
  if (!currentTab?.id || !currentCsl || !currentPageLoadKey || !currentPageUrl || !currentSegments.length) return;
  const stored = await storageEphemeralGet({ [TAB_STATE_STORAGE_KEY]: {} });
  const states = stored[TAB_STATE_STORAGE_KEY] && typeof stored[TAB_STATE_STORAGE_KEY] === 'object'
    ? stored[TAB_STATE_STORAGE_KEY]
    : {};
  const key = tabStateKey(currentTab.id, currentPageUrl);
  const next = {
    ...states,
    [key]: {
      pageLoadKey: currentPageLoadKey,
      pageUrl: currentPageUrl,
      title: els.title.textContent || currentCsl.title || currentPageUrl,
      style: els.style.value,
      csl: currentCsl,
      segments: currentSegments,
      plain: currentPlain,
      detailCount: currentDetailCount,
      savedAt: new Date().toISOString(),
    },
  };
  await storageEphemeralSet({ [TAB_STATE_STORAGE_KEY]: pruneTabStates(next) });
}

function pruneTabStates(states, limit = 20) {
  return Object.fromEntries(Object.entries(states)
    .sort(([, a], [, b]) => String(b?.savedAt || '').localeCompare(String(a?.savedAt || '')))
    .slice(0, limit));
}

async function captureActivePageSnapshot(tab) {
  if (!tab?.id) throw new Error('The current tab cannot be accessed.');
  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: readPageSnapshot,
  });
  const snapshot = results?.[0]?.result;
  if (!snapshot?.url) throw new Error('The page details could not be read.');
  return snapshot;
}

async function captureActivePageState(tab) {
  if (!tab?.id) throw new Error('The current tab cannot be accessed.');
  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: readPageState,
  });
  const state = results?.[0]?.result;
  if (!state?.url) throw new Error('The page details could not be read.');
  return state;
}

function renderCurrentCitation() {
  els.output.innerHTML = richTextToHtml(currentSegments);
  currentPlain = richTextToPlain(currentSegments);
  els.result.hidden = currentSegments.length === 0;
}

function renderCapturedDetails() {
  const rows = detailRows(currentCsl);
  els.resultCount.textContent = currentDetailCount > 0 ? `${currentDetailCount} details` : '';
  els.details.innerHTML = rows
    .map((row) => `<dt>${escapeHtml(row.label)}</dt><dd title="${escapeHtml(row.value)}">${escapeHtml(row.value)}</dd>`)
    .join('');
}

async function renderHistory() {
  const current = await storageLocalGet({ [HISTORY_STORAGE_KEY]: [] });
  const entries = Array.isArray(current[HISTORY_STORAGE_KEY]) ? current[HISTORY_STORAGE_KEY] : [];
  els.historyClear.disabled = entries.length === 0;
  els.historyList.innerHTML = entries.length
    ? entries.map((entry) => `
      <li class="history-item">
        <button type="button" data-history-id="${escapeHtml(entry.id)}">
          <span>
            <span class="history-title">${escapeHtml(entry.title || 'Untitled source')}</span>
            <span class="history-url">${escapeHtml(entry.url || entry.id)}</span>
          </span>
          <span class="history-style">${escapeHtml(styleShortLabel(entry.style))}</span>
        </button>
      </li>
    `).join('')
    : '<li><p class="history-empty">No citations yet.</p></li>';
}

function toggleHistory(force) {
  const next = typeof force === 'boolean' ? force : els.historyPanel.hidden;
  els.historyPanel.hidden = !next;
  els.history.setAttribute('aria-expanded', String(next));
  if (next) announceHistoryState();
}

async function announceHistoryState() {
  const current = await storageLocalGet({ [HISTORY_STORAGE_KEY]: [] });
  const count = Array.isArray(current[HISTORY_STORAGE_KEY]) ? current[HISTORY_STORAGE_KEY].length : 0;
  setStatus(count > 0
    ? `${count} recent citation${count === 1 ? '' : 's'} in history.`
    : 'No recent citations yet.');
}

async function restoreHistorySelection(event) {
  const button = event.target.closest('[data-history-id]');
  if (!button) return;
  const current = await storageLocalGet({ [HISTORY_STORAGE_KEY]: [] });
  const entry = (current[HISTORY_STORAGE_KEY] || []).find((item) => item.id === button.dataset.historyId);
  if (!entry?.csl) return;

  setBusy(true);
  currentCsl = entry.csl;
  currentDetailCount = detailRows(currentCsl).length;
  renderSourceSummary(entry.title, entry.url);
  renderCapturedDetails();
  try {
    await formatCurrentCitation();
    await saveCurrentToTabState();
    toggleHistory(false);
    setStatus('Loaded from history.');
  } catch (error) {
    setStatus(errorMessage(error), 'error');
  } finally {
    setBusy(false);
  }
}

async function clearHistory() {
  await storageLocalSet({ [HISTORY_STORAGE_KEY]: [] });
  await renderHistory();
  setStatus('History cleared.');
}

async function copyCitation() {
  if (!currentSegments.length) return;
  const html = richTextToHtml(currentSegments);
  let copied = copyViaSelection(html);
  if (!copied) copied = await copyViaAsyncApi(html, currentPlain);
  if (!copied && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(currentPlain);
    copied = true;
  }
  setStatus(copied ? 'Copied.' : 'Copy failed.', copied ? undefined : 'error');
}

function copyViaSelection(html) {
  const div = document.createElement('div');
  div.style.cssText = `position:fixed;left:-9999px;${COPY_STYLE}`;
  div.innerHTML = html;
  document.body.appendChild(div);
  let ok = false;
  try {
    const range = document.createRange();
    range.selectNodeContents(div);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    ok = document.execCommand('copy');
    selection?.removeAllRanges();
  } catch {
    ok = false;
  }
  div.remove();
  return ok;
}

async function copyViaAsyncApi(html, plain) {
  try {
    if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') return false;
    const styledHtml = `<div style="${COPY_STYLE}">${html}</div>`;
    await navigator.clipboard.write([
      new ClipboardItem({
        'text/html': new Blob([styledHtml], { type: 'text/html' }),
        'text/plain': new Blob([plain], { type: 'text/plain' }),
      }),
    ]);
    return true;
  } catch {
    return false;
  }
}

async function openOnSite() {
  const pageUrl = currentCsl?.URL || currentTab?.url || '';
  if (!isCiteableUrl(pageUrl) || !currentCsl) return;
  const source = sourceFromCsl(currentCsl, pageUrl);
  const editUrl = buildEditOnSiteUrl(pageUrl, els.style.value, currentCsl);
  const cleanUrl = buildReferencesUrl(els.style.value);
  setBusy(true);
  setStatus('Opening My References.');
  try {
    const tab = await chromePromise((resolve) => chrome.tabs.create({ url: editUrl, active: false }, resolve));
    if (!tab?.id) throw new Error('My References could not be opened.');
    await waitForTabComplete(tab.id);
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: importSourceIntoReferencesPage,
      args: [source, cleanUrl, REFERENCES_STORAGE_KEY],
    });
    await chromePromise((resolve) => chrome.tabs.update(tab.id, { active: true }, resolve));
  } catch (error) {
    setStatus(errorMessage(error), 'error');
  } finally {
    setBusy(false);
  }
}

function setBusy(busy) {
  els.cite.disabled = busy || !isCiteableUrl(currentTab?.url || '');
  els.style.disabled = busy;
  els.history.disabled = busy;
  els.copy.disabled = busy || currentSegments.length === 0;
  els.edit.disabled = busy || !isCiteableUrl(currentCsl?.URL || currentTab?.url || '') || !currentCsl;
  els.citeText.textContent = busy ? 'Citing...' : 'Cite page';
}

function setStatus(message, tone) {
  els.status.textContent = message || '';
  if (tone) els.status.dataset.tone = tone;
  else delete els.status.dataset.tone;
}

async function fetchJson(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const text = await response.text();
    let body = null;
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        throw new Error('The citation service returned an invalid response.');
      }
    }
    if (!response.ok) {
      throw new Error(body?.error || `Request failed with HTTP ${response.status}.`);
    }
    return body;
  } finally {
    clearTimeout(timer);
  }
}

function storageGet(defaults) {
  return chromePromise((resolve) => chrome.storage.sync.get(defaults, resolve));
}

function storageSet(value) {
  return chromePromise((resolve) => chrome.storage.sync.set(value, resolve));
}

function storageLocalGet(defaults) {
  return chromePromise((resolve) => chrome.storage.local.get(defaults, resolve));
}

function storageLocalSet(value) {
  return chromePromise((resolve) => chrome.storage.local.set(value, resolve));
}

function storageEphemeralGet(defaults) {
  const area = chrome.storage.session || chrome.storage.local;
  return chromePromise((resolve) => area.get(defaults, resolve));
}

function storageEphemeralSet(value) {
  const area = chrome.storage.session || chrome.storage.local;
  return chromePromise((resolve) => area.set(value, resolve));
}

function chromePromise(run) {
  return new Promise((resolve, reject) => {
    run((value) => {
      const err = chrome.runtime?.lastError;
      if (err) reject(new Error(err.message));
      else resolve(value);
    });
  });
}

function waitForTabComplete(tabId, timeoutMs = 20_000) {
  return new Promise((resolve, reject) => {
    let done = false;
    const timer = setTimeout(() => {
      if (done) return;
      done = true;
      chrome.tabs.onUpdated.removeListener(onUpdated);
      reject(new Error('My References took too long to open.'));
    }, timeoutMs);

    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      chrome.tabs.onUpdated.removeListener(onUpdated);
      resolve();
    };

    const onUpdated = (updatedTabId, changeInfo) => {
      if (updatedTabId === tabId && changeInfo.status === 'complete') finish();
    };

    chrome.tabs.onUpdated.addListener(onUpdated);
    chrome.tabs.get(tabId, (tab) => {
      const err = chrome.runtime?.lastError;
      if (err) {
        clearTimeout(timer);
        chrome.tabs.onUpdated.removeListener(onUpdated);
        reject(new Error(err.message));
      } else if (tab?.status === 'complete') {
        finish();
      }
    });
  });
}

function styleShortLabel(style) {
  const label = CITATION_STYLES.find((item) => item.value === style)?.label || DEFAULT_STYLE;
  return label.replace(/\s+edition$/i, '').replace(/\s+/g, ' ');
}

function importSourceIntoReferencesPage(source, cleanUrl, storageKey) {
  const readSources = () => {
    try {
      const parsed = JSON.parse(localStorage.getItem(storageKey) || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };
  const sourceId = source?.uuid || source?.csl?.id;
  const existing = readSources();
  const next = existing.filter((item) => item?.uuid !== sourceId && item?.csl?.id !== sourceId);
  next.push(source);
  localStorage.setItem(storageKey, JSON.stringify(next));
  if (location.href === cleanUrl) location.reload();
  else location.replace(cleanUrl);
  return { count: next.length };
}

function readPageState() {
  const navigation = performance.getEntriesByType?.('navigation')?.[0];
  const pageLoadKey = [
    performance.timeOrigin || 0,
    navigation?.startTime || 0,
    navigation?.type || '',
  ].join(':');
  return {
    url: location.href,
    title: String(document.title || '').replace(/\s+/g, ' ').trim(),
    pageLoadKey,
  };
}

function readPageSnapshot() {
  const clean = (value) => String(value || '').replace(/\s+/g, ' ').trim();
  const firstText = (selectors) => {
    for (const selector of selectors) {
      const node = document.querySelector(selector);
      const text = clean(node?.textContent);
      if (text) return text;
    }
    return '';
  };
  const attr = (selector, name) => {
    const value = document.querySelector(selector)?.getAttribute(name);
    return clean(value);
  };
  const unique = (values) => {
    const seen = new Set();
    const out = [];
    for (const value of values.map(clean).filter(Boolean)) {
      const key = value.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(value);
    }
    return out;
  };

  const meta = Array.from(document.querySelectorAll('meta'))
    .map((node) => ({
      name: node.getAttribute('name') || '',
      property: node.getAttribute('property') || '',
      itemprop: node.getAttribute('itemprop') || '',
      content: node.getAttribute('content') || '',
    }))
    .filter((entry) => clean(entry.content));

  const bylineSelectors = [
    '[rel="author"]',
    '[itemprop="author"]',
    '.byline',
    '.author',
    '.article-author',
    '[data-testid*="byline"]',
    '[data-testid*="author"]',
  ];
  const bylineCandidates = unique(bylineSelectors
    .flatMap((selector) => Array.from(document.querySelectorAll(selector)))
    .map((node) => clean(node.textContent))
    .filter((value) => value && value.length <= 180));

  const timeCandidates = unique([
    ...Array.from(document.querySelectorAll('time')).flatMap((node) => [
      node.getAttribute('datetime'),
      node.getAttribute('content'),
      node.textContent,
    ]),
    ...Array.from(document.querySelectorAll('[itemprop="datePublished"], [itemprop="dateCreated"], [itemprop="dateModified"]'))
      .flatMap((node) => [node.getAttribute('datetime'), node.getAttribute('content'), node.textContent]),
  ]);

  const navigation = performance.getEntriesByType?.('navigation')?.[0];
  const pageLoadKey = [
    performance.timeOrigin || 0,
    navigation?.startTime || 0,
    navigation?.type || '',
  ].join(':');

  return {
    url: location.href,
    title: clean(document.title),
    h1: firstText(['article h1', 'main h1', 'h1']),
    lang: clean(document.documentElement.lang),
    canonicalUrl: attr('link[rel="canonical"]', 'href'),
    meta,
    jsonld: Array.from(document.querySelectorAll('script[type*="ld+json"]'))
      .map((node) => node.textContent || '')
      .filter((value) => clean(value)),
    bylineCandidates,
    timeCandidates,
    pageLoadKey,
  };
}
