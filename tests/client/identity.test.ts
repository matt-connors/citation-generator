// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  randomTag,
  getUserId,
  getSessionId,
  sessionQueryParams,
  SESSION_TTL_MS,
} from '../../src/lib/references/identity';

const TAG_RE = /^[a-z0-9]{8,32}$/;

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('randomTag', () => {
  it('produces a 22-char lowercase-alphanumeric tag the server accepts', () => {
    for (let i = 0; i < 50; i++) {
      const tag = randomTag();
      expect(tag).toHaveLength(22);
      expect(tag).toMatch(TAG_RE);
    }
  });

  it('is overwhelmingly unique across calls', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) seen.add(randomTag());
    expect(seen.size).toBe(200);
  });
});

describe('getUserId', () => {
  it('mints a valid tag and persists it across calls', () => {
    const first = getUserId();
    expect(first).toMatch(TAG_RE);
    expect(getUserId()).toBe(first);
    expect(localStorage.getItem('cg_uid')).toBe(first);
  });

  it('reuses a pre-existing valid tag', () => {
    localStorage.setItem('cg_uid', 'existinguid1234');
    expect(getUserId()).toBe('existinguid1234');
  });

  it('replaces a corrupted (wrong-shape) stored tag', () => {
    localStorage.setItem('cg_uid', 'NOT VALID!!');
    const id = getUserId();
    expect(id).toMatch(TAG_RE);
    expect(id).not.toBe('NOT VALID!!');
  });

  it('returns "" when storage writes silently fail', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {});
    vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(null);
    expect(getUserId()).toBe('');
  });
});

describe('getSessionId', () => {
  it('keeps the same session within the inactivity window', () => {
    const a = getSessionId(1_000);
    const b = getSessionId(1_000 + SESSION_TTL_MS - 1);
    expect(b).toBe(a);
  });

  it('rotates after the inactivity window elapses', () => {
    const a = getSessionId(1_000);
    // Activity refreshed at 1_000; jump past the window from that last touch.
    const b = getSessionId(1_000 + SESSION_TTL_MS + 1);
    expect(b).not.toBe(a);
    expect(b).toMatch(TAG_RE);
  });

  it('refreshes the activity timestamp so a steady stream stays one session', () => {
    let t = 0;
    const first = getSessionId(t);
    // Each call is within one window of the previous → never rotates.
    for (let i = 0; i < 10; i++) {
      t += SESSION_TTL_MS - 1;
      expect(getSessionId(t)).toBe(first);
    }
  });

  it('mints a fresh session when the stored record is corrupted', () => {
    localStorage.setItem('cg_sid', '{ not json');
    expect(getSessionId(0)).toMatch(TAG_RE);
  });
});

describe('sessionQueryParams', () => {
  it('returns both tags as URL params', () => {
    const params = sessionQueryParams();
    const m = params.match(/^&sid=([a-z0-9]{8,32})&uid=([a-z0-9]{8,32})$/);
    expect(m).not.toBeNull();
  });

  it('omits a tag that is unavailable', () => {
    // uid write fails (returns ''), sid succeeds.
    const real = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, k: string, v: string) {
      if (k === 'cg_uid') return; // drop the user tag write
      return real.call(this, k, v);
    });
    const params = sessionQueryParams();
    expect(params).toMatch(/^&sid=[a-z0-9]{8,32}$/);
    expect(params).not.toContain('uid=');
  });
});
