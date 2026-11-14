import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { DEMO_ACCOUNTS, DEMO_PASSWORD, PrismaClient } from '@app/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { GET as adminPing } from '../src/app/api/admin/ping/route';
import { POST as authPost } from '../src/app/api/auth/[...all]/route';
import { GET as getMe } from '../src/app/api/me/route';
import { GET as vendorOrders } from '../src/app/api/vendor/[id]/orders/route';

const BASE_URL = process.env['BETTER_AUTH_URL'] ?? 'http://localhost:3000';
const repoRoot = fileURLToPath(new URL('../../..', import.meta.url));
const db = new PrismaClient();

type AccountKey = 'student' | 'owner' | 'staff' | 'admin';
const cookies = new Map<AccountKey, string>();
let memberVendorId = '';
let otherVendorId = '';

function emailOf(key: AccountKey): string {
  const email = DEMO_ACCOUNTS.find((a) => a.email.startsWith(`${key}@`))?.email;
  if (!email) throw new Error(`no demo account ${key}`);
  return email;
}

async function signIn(email: string, password: string): Promise<Response> {
  return authPost(
    new Request(`${BASE_URL}/api/auth/sign-in/email`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: BASE_URL },
      body: JSON.stringify({ email, password }),
    }),
  );
}

function cookieHeader(response: Response): string {
  return response.headers
    .getSetCookie()
    .map((c) => c.split(';')[0])
    .join('; ');
}

function authed(path: string, key: AccountKey | null, init: RequestInit = {}): Request {
  const headers = new Headers(init.headers);
  headers.set('origin', BASE_URL);
  const cookie = key ? cookies.get(key) : undefined;
  if (cookie) headers.set('cookie', cookie);
  return new Request(`${BASE_URL}${path}`, { ...init, headers });
}

const ALL: readonly AccountKey[] = ['student', 'owner', 'staff', 'admin'];

function expectStatuses(
  results: Map<AccountKey, number>,
  allowed: readonly AccountKey[],
  unauthenticated: number,
): void {
  for (const key of ALL) {
    expect(results.get(key), key).toBe(allowed.includes(key) ? 200 : 403);
  }
  expect(unauthenticated).toBe(401);
}

async function statuses(
  call: (key: AccountKey | null) => Promise<Response>,
): Promise<{ byAccount: Map<AccountKey, number>; unauthenticated: number }> {
  const byAccount = new Map<AccountKey, number>();
  for (const key of ALL) byAccount.set(key, (await call(key)).status);
  return { byAccount, unauthenticated: (await call(null)).status };
}

beforeAll(async () => {
  const env = { ...process.env, DEMO_MODE: 'true' };
  execSync('pnpm --filter @app/db migrate:deploy', { cwd: repoRoot, env, stdio: 'pipe' });
  execSync('pnpm --filter @app/db seed', { cwd: repoRoot, env, stdio: 'pipe' });

  for (const key of ALL) {
    const response = await signIn(emailOf(key), DEMO_PASSWORD);
    expect(response.status, `sign-in ${key}`).toBe(200);
    cookies.set(key, cookieHeader(response));
  }

  const owner = await db.user.findUniqueOrThrow({ where: { email: emailOf('owner') } });
  const membership = await db.vendorMember.findFirstOrThrow({ where: { userId: owner.id } });
  memberVendorId = membership.vendorId;
  const other = await db.vendor.findFirstOrThrow({ where: { id: { not: memberVendorId } } });
  otherVendorId = other.id;
}, 180_000);

afterAll(async () => {
  await db.session.deleteMany({
    where: { user: { email: { in: DEMO_ACCOUNTS.map((a) => a.email) } } },
  });
  await db.$disconnect();
});

describe('sign-in with seeded password hashes', () => {
  it('rejects a wrong password', async () => {
    const response = await signIn(emailOf('student'), 'wrong-password');
    expect(response.status).toBe(401);
  });

  it('issues an httpOnly SameSite=Lax session cookie', async () => {
    const response = await signIn(emailOf('student'), DEMO_PASSWORD);
    const raw = response.headers.getSetCookie().join('\n').toLowerCase();
    expect(raw).toContain('httponly');
    expect(raw).toContain('samesite=lax');
  });
});

describe('role-gated routes with real sessions', () => {
  it('GET /api/me is student only', async () => {
    const { byAccount, unauthenticated } = await statuses((k) => getMe(authed('/api/me', k)));
    expectStatuses(byAccount, ['student'], unauthenticated);
  });

  it('GET /api/admin/ping is admin only', async () => {
    const { byAccount, unauthenticated } = await statuses((k) =>
      adminPing(authed('/api/admin/ping', k)),
    );
    expectStatuses(byAccount, ['admin'], unauthenticated);
  });

  it('GET /api/vendor/:id/orders allows vendor members of that vendor only', async () => {
    const path = `/api/vendor/${memberVendorId}/orders`;
    const context = { params: Promise.resolve({ id: memberVendorId }) };
    const { byAccount, unauthenticated } = await statuses((k) =>
      vendorOrders(authed(path, k), context),
    );
    expectStatuses(byAccount, ['owner', 'staff'], unauthenticated);
  });

  it('denies a vendor member access to a different vendor', async () => {
    const path = `/api/vendor/${otherVendorId}/orders`;
    const context = { params: Promise.resolve({ id: otherVendorId }) };
    for (const key of ['owner', 'staff'] as const) {
      const response = await vendorOrders(authed(path, key), context);
      expect(response.status, key).toBe(403);
    }
  });

  it('rejects a malformed vendor id with 400', async () => {
    const context = { params: Promise.resolve({ id: 'not-a-uuid' }) };
    const response = await vendorOrders(authed('/api/vendor/not-a-uuid/orders', 'owner'), context);
    expect(response.status).toBe(400);
  });
});

describe('demo accounts cannot be deleted', () => {
  it('blocks delete-user for every demo account and keeps sign-in working', async () => {
    for (const key of ALL) {
      const response = await authPost(
        authed('/api/auth/delete-user', key, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ password: DEMO_PASSWORD }),
        }),
      );
      expect(response.status, key).toBe(403);
      expect(await db.user.count({ where: { email: emailOf(key) } }), key).toBe(1);
    }
    const again = await signIn(emailOf('student'), DEMO_PASSWORD);
    expect(again.status).toBe(200);
  });

  it('still lets an ordinary user delete their own account', async () => {
    const email = `throwaway-${Date.now()}@example.test`;
    const password = 'throwaway-password-1';
    const signUp = await authPost(
      new Request(`${BASE_URL}/api/auth/sign-up/email`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: BASE_URL },
        body: JSON.stringify({ email, password, name: 'Throwaway' }),
      }),
    );
    expect(signUp.status).toBe(200);
    const created = await db.user.findUniqueOrThrow({ where: { email } });
    expect(created.role).toBe('student');
    const credit = await db.walletLedger.findMany({ where: { userId: created.id } });
    expect(credit.map((row) => [row.reason, row.deltaHkd])).toEqual([['seed', 300]]);

    const response = await authPost(
      new Request(`${BASE_URL}/api/auth/delete-user`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          origin: BASE_URL,
          cookie: cookieHeader(signUp),
        },
        body: JSON.stringify({ password }),
      }),
    );
    expect(response.status).toBe(200);
    expect(await db.user.count({ where: { email } })).toBe(0);
  });
});
