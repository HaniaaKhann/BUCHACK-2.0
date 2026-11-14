import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from '@app/db';
import { expect } from 'vitest';
import { POST as authPost } from '../../src/app/api/auth/[...all]/route';

export const BASE_URL = process.env['BETTER_AUTH_URL'] ?? 'http://localhost:3000';

export type AccountKey = 'student' | 'owner' | 'staff' | 'admin';
export const ALL_ACCOUNTS: readonly AccountKey[] = ['student', 'owner', 'staff', 'admin'];

const repoRoot = fileURLToPath(new URL('../../../..', import.meta.url));

export function emailOf(key: AccountKey): string {
  const email = DEMO_ACCOUNTS.find((account) => account.email.startsWith(`${key}@`))?.email;
  if (!email) throw new Error(`no demo account ${key}`);
  return email;
}

export async function prepareSessions(): Promise<Map<AccountKey, string>> {
  const env = { ...process.env, DEMO_MODE: 'true' };
  execSync('pnpm --filter @app/db migrate:deploy', { cwd: repoRoot, env, stdio: 'pipe' });
  execSync('pnpm --filter @app/db seed', { cwd: repoRoot, env, stdio: 'pipe' });

  const cookies = new Map<AccountKey, string>();
  for (const key of ALL_ACCOUNTS) {
    const response = await authPost(
      new Request(`${BASE_URL}/api/auth/sign-in/email`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: BASE_URL },
        body: JSON.stringify({ email: emailOf(key), password: DEMO_PASSWORD }),
      }),
    );
    expect(response.status, `sign-in ${key}`).toBe(200);
    cookies.set(
      key,
      response.headers
        .getSetCookie()
        .map((cookie) => cookie.split(';')[0])
        .join('; '),
    );
  }
  return cookies;
}

export function asAccount(
  cookies: ReadonlyMap<AccountKey, string>,
  path: string,
  key: AccountKey | null,
  init: RequestInit = {},
): Request {
  const headers = new Headers(init.headers);
  headers.set('origin', BASE_URL);
  const cookie = key ? cookies.get(key) : undefined;
  if (cookie) headers.set('cookie', cookie);
  return new Request(`${BASE_URL}${path}`, { ...init, headers });
}

export function jsonInit(method: string, body: unknown): RequestInit {
  return {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  };
}
