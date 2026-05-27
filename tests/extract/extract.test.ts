import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { runExtractionPipeline } from '../../functions/lib/extract/pipeline';

const FIX_ROOT = join(__dirname, 'fixtures');

const fixtures = readdirSync(FIX_ROOT).filter((d) => {
  const p = join(FIX_ROOT, d);
  return statSync(p).isDirectory();
});

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
