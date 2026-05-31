import { describe, it, expect, beforeEach } from 'vitest';
import { loadSources, saveSources, type StoredSource } from '../../src/lib/references/storage';

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

  it('drops entries with a corrupted (non-array) author, keeps valid ones', () => {
    localStorage.setItem('sources_v2', JSON.stringify([
      { uuid: 'good', csl: { id: 'good', type: 'webpage', title: 'T', author: [{ family: 'X' }] } },
      { uuid: 'bad', csl: { id: 'bad', type: 'webpage', author: 'not-an-array' } },
    ]));
    const loaded = loadSources();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].uuid).toBe('good');
  });

  it('drops entries with an invalid csl.type', () => {
    localStorage.setItem('sources_v2', JSON.stringify([
      { uuid: 'bad', csl: { id: 'bad', type: 'not-a-type' } },
    ]));
    expect(loadSources()).toEqual([]);
  });
});
