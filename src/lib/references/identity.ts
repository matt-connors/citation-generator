/**
 * Anonymous session / user identity for analytics.
 *
 * The browser mints two opaque random tags and keeps them in localStorage.
 * Neither is derived from anything about the user — no fingerprint, no IP, no
 * cookie — so they identify a browser profile, not a person, and clearing site
 * data resets them. They travel to the cite API as `?uid=` / `?sid=` query
 * params, which it records as trailing analytics dimensions (see
 * `sessionAttribution` in `functions/lib/analytics.ts`).
 *
 *   - User tag  (`cg_uid`) — persistent; one per browser profile. Lets the
 *     dashboard count unique users and detect return users across sessions.
 *   - Session tag (`cg_sid`) — rolls over after 30 minutes of inactivity, the
 *     conventional web-analytics session window. Lets the dashboard count
 *     sessions and citations-per-session.
 *
 * Every accessor is defensive: server-side render (no `window`), private-mode
 * storage that throws, or a corrupted value all degrade to '' so the caller
 * simply omits the param — analytics is never load-bearing for a citation.
 */

const USER_KEY = 'cg_uid';
const SESSION_KEY = 'cg_sid';

/** Inactivity window after which a new session tag is minted (30 minutes). */
export const SESSION_TTL_MS = 30 * 60 * 1000;

/** Shape accepted by the server (`^[a-z0-9]{8,32}$`). */
const TAG_RE = /^[a-z0-9]{8,32}$/;

interface SessionRecord {
  id: string;
  /** Epoch ms of the most recent activity that used this session. */
  ts: number;
}

/**
 * A random lowercase-alphanumeric tag (22 chars), collision-resistant enough
 * for anonymous counting. Uses the Web Crypto RNG when present and falls back
 * to `Math.random` — the value is a label, not a secret, so a weaker RNG only
 * marginally raises collision odds and never affects correctness of a citation.
 */
export function randomTag(): string {
  let out = '';
  try {
    const cryptoObj = typeof crypto !== 'undefined' ? crypto : undefined;
    if (cryptoObj?.getRandomValues) {
      const buf = new Uint32Array(5);
      cryptoObj.getRandomValues(buf);
      for (const n of buf) out += n.toString(36);
    }
  } catch {
    // fall through to Math.random
  }
  while (out.length < 22) out += Math.floor(Math.random() * 0xffffffff).toString(36);
  return out.slice(0, 22);
}

function readStorage(key: string): string | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(key, value);
  } catch {
    // private mode / quota / disabled storage — analytics tag is optional.
  }
}

/**
 * The persistent user tag for this browser profile, creating it on first call.
 * Returns '' only when storage is entirely unavailable (SSR, hard-disabled),
 * in which case the caller omits the `uid` param.
 */
export function getUserId(): string {
  const existing = readStorage(USER_KEY);
  if (existing && TAG_RE.test(existing)) return existing;
  const fresh = randomTag();
  writeStorage(USER_KEY, fresh);
  // Confirm the write actually stuck; if storage silently dropped it (SSR /
  // disabled), report '' rather than a tag the server will never see again.
  return readStorage(USER_KEY) === fresh ? fresh : '';
}

/**
 * The current session tag, rotating it when the previous activity is older
 * than {@link SESSION_TTL_MS}. Each call refreshes the activity timestamp, so
 * an active user keeps one session and a returning user starts a new one.
 */
export function getSessionId(now: number = Date.now()): string {
  const prev = parseSession(readStorage(SESSION_KEY));
  const id = prev && now - prev.ts < SESSION_TTL_MS ? prev.id : randomTag();
  const record: SessionRecord = { id, ts: now };
  writeStorage(SESSION_KEY, JSON.stringify(record));
  return readStorage(SESSION_KEY) ? id : '';
}

function parseSession(raw: string | null): SessionRecord | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (
      parsed && typeof parsed === 'object'
      && typeof parsed.id === 'string' && TAG_RE.test(parsed.id)
      && typeof parsed.ts === 'number' && Number.isFinite(parsed.ts)
    ) {
      return parsed as SessionRecord;
    }
  } catch {
    // corrupted record — treated as no session, a fresh one is minted.
  }
  return null;
}

/**
 * The `&sid=…&uid=…` query-string fragment to append to a cite request, or ''
 * when neither tag is available. Empty tags are omitted individually so a
 * partially-available environment still contributes what it can.
 */
export function sessionQueryParams(): string {
  const sid = getSessionId();
  const uid = getUserId();
  let out = '';
  if (sid) out += `&sid=${sid}`;
  if (uid) out += `&uid=${uid}`;
  return out;
}
