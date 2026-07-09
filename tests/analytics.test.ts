import { describe, it, expect, vi } from 'vitest';
import { writeEvent, sessionAttribution, fromAttribution } from '../functions/lib/analytics';

describe('writeEvent', () => {
  it('writes blobs, doubles, indexes in positional order', () => {
    const writeDataPoint = vi.fn();
    writeEvent(
      { writeDataPoint },
      'cite_website',
      { signal_winner_title: 'jsonld', signal_winner_url: 'opengraph', host: 'example.com' },
      { html_size_kb: 42, extraction_ms: 17, cache_hit: 0 },
    );
    expect(writeDataPoint).toHaveBeenCalledTimes(1);
    expect(writeDataPoint).toHaveBeenCalledWith({
      blobs: ['cite_website', 'jsonld', 'opengraph', 'example.com'],
      doubles: [42, 17, 0],
      indexes: ['cite_website'],
    });
  });

  it('is a no-op when the binding is undefined', () => {
    // Pre-deploy and pre-dataset-creation: env.ANALYTICS is undefined.
    // Handlers must keep working unchanged.
    expect(() =>
      writeEvent(undefined, 'cite_book', { source: 'openlibrary' }, { latency_ms: 100, cache_hit: 1 }),
    ).not.toThrow();
  });

  it('preserves insertion order even when keys would not sort the same way', () => {
    // Object property iteration in JS is insertion order for string keys.
    // The writer relies on this to keep dimension column order stable.
    const writeDataPoint = vi.fn();
    writeEvent(
      { writeDataPoint },
      'err',
      { z_last: 'zzz', a_first: 'aaa' },
      { z_metric: 1, a_metric: 2 },
    );
    expect(writeDataPoint.mock.calls[0][0].blobs).toEqual(['err', 'zzz', 'aaa']);
    expect(writeDataPoint.mock.calls[0][0].doubles).toEqual([1, 2]);
  });

  it('emits event name into both blobs[0] and indexes[0]', () => {
    const writeDataPoint = vi.fn();
    writeEvent({ writeDataPoint }, 'format', { style: 'mla-9' }, { latency_ms: 8 });
    const point = writeDataPoint.mock.calls[0][0];
    expect(point.blobs[0]).toBe('format');
    expect(point.indexes[0]).toBe('format');
  });

  it('handles zero-dimension / zero-metric calls', () => {
    const writeDataPoint = vi.fn();
    writeEvent({ writeDataPoint }, 'noop', {}, {});
    expect(writeDataPoint).toHaveBeenCalledWith({
      blobs: ['noop'],
      doubles: [],
      indexes: ['noop'],
    });
  });
});

describe('sessionAttribution', () => {
  const at = (qs: string) => new URL(`https://m.com/api/cite-website?url=https://x.com${qs}`);

  it('returns validated sid/uid when both are well-shaped', () => {
    expect(sessionAttribution(at('&sid=abc12345&uid=xyz98765def0'))).toEqual({
      sid: 'abc12345',
      uid: 'xyz98765def0',
    });
  });

  it('returns empty strings when the params are absent', () => {
    expect(sessionAttribution(at(''))).toEqual({ sid: '', uid: '' });
  });

  it('rejects tags shorter than 8 chars', () => {
    expect(sessionAttribution(at('&sid=short&uid=seven77'))).toEqual({ sid: '', uid: '' });
  });

  it('rejects tags longer than 32 chars', () => {
    const long = 'a'.repeat(33);
    expect(sessionAttribution(at(`&sid=${long}`)).sid).toBe('');
  });

  it('rejects tags with illegal characters (uppercase, dash, dot, slash)', () => {
    expect(sessionAttribution(at('&sid=ABCD1234')).sid).toBe('');
    expect(sessionAttribution(at('&sid=has-a-dash1')).sid).toBe('');
    expect(sessionAttribution(at('&sid=has.a.dot1')).sid).toBe('');
    expect(sessionAttribution(at('&uid=' + encodeURIComponent('a/b/c/d/e'))).uid).toBe('');
  });

  it('validates sid and uid independently', () => {
    expect(sessionAttribution(at('&sid=validsid123&uid=BAD'))).toEqual({
      sid: 'validsid123',
      uid: '',
    });
  });

  it('does not interfere with fromAttribution on the same URL', () => {
    const url = at('&from=how-to-cite-a-tweet&sid=validsid123&uid=validuid456');
    expect(fromAttribution(url)).toBe('how-to-cite-a-tweet');
    expect(sessionAttribution(url)).toEqual({ sid: 'validsid123', uid: 'validuid456' });
  });
});
