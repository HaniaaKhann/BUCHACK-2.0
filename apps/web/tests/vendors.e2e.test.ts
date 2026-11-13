import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { DEMO_PASSWORD, DEMO_VENDOR_NAME, PrismaClient } from '@app/db';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { POST as authPost } from '../src/app/api/auth/[...all]/route';
import { GET as listVendors } from '../src/app/api/vendors/route';

const BASE_URL = process.env['BETTER_AUTH_URL'] ?? 'http://localhost:3000';
const repoRoot = fileURLToPath(new URL('../../..', import.meta.url));
const db = new PrismaClient();
let studentCookie = '';

beforeAll(async () => {
  const env = { ...process.env, DEMO_MODE: 'true' };
  execSync('pnpm --filter @app/db migrate:deploy', { cwd: repoRoot, env, stdio: 'pipe' });
  execSync('pnpm --filter @app/db seed', { cwd: repoRoot, env, stdio: 'pipe' });

  const signIn = await authPost(
    new Request(`${BASE_URL}/api/auth/sign-in/email`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: BASE_URL },
      body: JSON.stringify({ email: 'student@demo.example', password: DEMO_PASSWORD }),
    }),
  );
  expect(signIn.status).toBe(200);
  studentCookie = signIn.headers
    .getSetCookie()
    .map((c) => c.split(';')[0])
    .join('; ');
}, 180_000);

afterAll(async () => {
  await db.session.deleteMany({ where: { user: { email: 'student@demo.example' } } });
  await db.$disconnect();
});

it('leaves a vendor that is closed for renovation out of the student vendor list but keeps its row and walk times', async () => {
  const hidden = await db.vendor.findMany({ where: { status: { not: 'open' } } });
  expect(hidden.map((vendor) => vendor.name)).toContain('BU Fiesta');

  const response = await listVendors(
    new Request(`${BASE_URL}/api/vendors`, {
      headers: { origin: BASE_URL, cookie: studentCookie },
    }),
  );
  expect(response.status).toBe(200);
  const { vendors } = (await response.json()) as { vendors: { id: string; name: string }[] };
  const listed = new Set(vendors.map((vendor) => vendor.name));

  expect(listed.has('BU Fiesta')).toBe(false);
  expect(listed.has(DEMO_VENDOR_NAME)).toBe(true);
  for (const vendor of hidden) expect(listed.has(vendor.name)).toBe(false);

  const fiesta = hidden.find((vendor) => vendor.name === 'BU Fiesta');
  expect(await db.walkTime.count({ where: { toVendorId: fiesta?.id ?? '' } })).toBeGreaterThan(0);
});
