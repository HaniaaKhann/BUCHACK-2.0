import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { APP_NAME, APP_TAGLINE } from '../src/brand';

const srcRoot = fileURLToPath(new URL('../src', import.meta.url));

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(path) ? [path] : [];
  });
}

describe('brand constants', () => {
  it('has the product name and tagline', () => {
    expect(APP_NAME).toBe('UniBowl');
    expect(APP_TAGLINE).toBe('Food that fits your diet, ready before your next class');
  });

  it('is the only place that spells the name or the tagline, so a rename is one line', () => {
    const offenders = sourceFiles(srcRoot).filter((file) => {
      if (file.endsWith('brand.ts')) return false;
      const text = readFileSync(file, 'utf8');
      return text.includes(`'${APP_NAME}'`) || text.includes(APP_TAGLINE);
    });
    expect(offenders).toEqual([]);
  });

  it('does not read the name from an environment variable', () => {
    const readers = sourceFiles(srcRoot).filter((file) =>
      readFileSync(file, 'utf8').includes("env['APP_NAME']"),
    );
    expect(readers).toEqual([]);
  });
});
