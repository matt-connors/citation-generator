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
