import { describe, it, expect, vi } from 'vitest';
import { handleQualityCheck } from '../../functions/api/quality/check/handler';

describe('handleQualityCheck', () => {
  it('returns deterministic quality warnings for a CSL item', async () => {
    const req = new Request('https://m.com/api/quality/check', {
      method: 'POST',
      body: JSON.stringify({
        csl: { id: 'https://example.com/p', type: 'webpage', title: 'Example', URL: 'https://example.com/p' },
        style: 'mla-9',
      }),
    });
    const res = await handleQualityCheck(req);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.quality.warnings.some((w: any) => w.code === 'author_not_found')).toBe(true);
  });

  it('can append AI sanity-check warnings without changing CSL', async () => {
    const ai = {
      run: vi.fn(async () => ({
        response: JSON.stringify({
          warnings: [{
            code: 'source_type_review',
            field: 'type',
            severity: 'review',
            message: 'Review whether this should be a journal article.',
          }],
        }),
      })),
    };
    const req = new Request('https://m.com/api/quality/check?ai=0', {
      method: 'POST',
      body: JSON.stringify({
        csl: { id: 'https://example.com/p', type: 'webpage', title: 'Example', URL: 'https://example.com/p' },
        style: 'mla-9',
      }),
    });
    const res = await handleQualityCheck(req, { ai, aiCheckEnabled: true });
    const body = await res.json() as any;
    expect(ai.run).toHaveBeenCalled();
    expect(body.quality.warnings.some((w: any) => w.code === 'ai_source_type_review')).toBe(true);
  });

  it('does not allow query params to force AI checks', async () => {
    const ai = { run: vi.fn() };
    const req = new Request('https://m.com/api/quality/check?ai=1', {
      method: 'POST',
      body: JSON.stringify({
        csl: { id: 'https://example.com/p', type: 'webpage', title: 'Example', URL: 'https://example.com/p' },
      }),
    });
    await handleQualityCheck(req, { ai });
    expect(ai.run).not.toHaveBeenCalled();
  });
});
