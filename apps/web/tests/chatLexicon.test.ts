import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { correctInput, matchIntent } from '@app/core';
import { describe, expect, it } from 'vitest';

const outletsFile = fileURLToPath(
  new URL('../../../packages/db/seed-data/outlets.json', import.meta.url),
);
const names = (
  JSON.parse(readFileSync(outletsFile, 'utf8')) as { outlets: { name: string }[] }
).outlets.map((outlet) => outlet.name);

describe('the chat vocabulary and the real outlets', () => {
  it('reads every real outlet name as itself, with no correction and no question back', () => {
    for (const name of names) {
      const result = correctInput(`how long is the wait at ${name}`);
      expect(result.corrections, name).toEqual([]);
      expect(result.clarify, name).toBeNull();
    }
  });

  it('asks about the wait for every real outlet name', () => {
    for (const name of names) {
      expect(matchIntent(`how long is the wait at ${name}`).intent, name).toBe('wait_at_vendor');
    }
  });
});
