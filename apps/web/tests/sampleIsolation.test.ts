import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('../../..', import.meta.url));

function files(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    if (entry === 'node_modules' || entry === '.next' || entry === 'dist') return [];
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) return files(path);
    return /\.(ts|tsx|sql|prisma)$/.test(path) ? [path] : [];
  });
}

const NAMES =
  /sampleVendorOrder|SampleVendorOrder|sample_vendor_orders|writeSampleSales|buildSampleSales/;

const ALLOWED = new Set([
  'apps/web/src/server/salesService.ts',
  'apps/worker/src/demoReset.ts',
  'packages/db/src/index.ts',
  'packages/db/src/seed/run.ts',
  'packages/db/src/seed/sampleSales.ts',
  'packages/db/prisma/schema.prisma',
  'packages/db/prisma/migrations/20261115020000_sample_vendor_orders/migration.sql',
]);

describe('sample sales stay apart from the wait engine', () => {
  const sources = ['packages', 'apps']
    .flatMap((top) => readdirSync(join(root, top)).map((name) => join(root, top, name)))
    .flatMap((path) => (statSync(path).isDirectory() ? files(path) : []))
    .filter((path) => !path.includes(`${join('tests')}`) && !path.includes('tests-db'));

  it('is named only by the sales page, the seed, the demo reset and the schema', () => {
    const users = sources
      .filter((path) => NAMES.test(readFileSync(path, 'utf8')))
      .map((path) => relative(root, path).replace(/\\/g, '/'))
      .sort();
    expect(users.filter((path) => !ALLOWED.has(path))).toEqual([]);
    expect(users).toEqual(expect.arrayContaining(['apps/web/src/server/salesService.ts']));
  });

  it('is not read by the engine, the simulator, the snapshots or the live wait', () => {
    const engineFolders = [
      'packages/core/src',
      'packages/simulator/src',
      'apps/worker/src/jobs',
      'apps/worker/src/snapshotPayload.ts',
      'apps/web/src/server/waitEstimate.ts',
      'apps/web/src/server/studentData.ts',
      'apps/web/src/server/menuView.ts',
    ];
    for (const entry of engineFolders) {
      const path = join(root, entry);
      const list = statSync(path).isDirectory() ? files(path) : [path];
      for (const file of list) {
        expect(NAMES.test(readFileSync(file, 'utf8')), relative(root, file)).toBe(false);
      }
    }
  });

  it('has no link to students, orders or the wallet, so deleting an account cannot touch it', () => {
    const schema = readFileSync(join(root, 'packages/db/prisma/schema.prisma'), 'utf8');
    const model = schema.match(/model SampleVendorOrder \{([\s\S]*?)\n\}/)?.[1] ?? '';
    expect(model).toContain('vendor Vendor');
    expect(model).not.toMatch(/studentId|userId|User\b|Order\b|walletLedger/);
  });
});
