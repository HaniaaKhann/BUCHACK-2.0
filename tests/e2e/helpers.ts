import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { APIRequestContext, Page } from '@playwright/test';

export const BASE_URL = process.env['PLAYWRIGHT_BASE_URL'] ?? 'http://localhost:3000';
export const PASSWORD = 'demo-password-1';

export const ACCOUNTS = {
  student: 'student@demo.example',
  owner: 'owner@demo.example',
  staff: 'staff@demo.example',
  admin: 'admin@demo.example',
} as const;

export type Role = keyof typeof ACCOUNTS;

const LANDING: Record<Role, string> = {
  student: '/',
  owner: '/vendor',
  staff: '/vendor',
  admin: '/admin',
};

export async function signIn(page: Page, role: Role): Promise<void> {
  await page.goto('/sign-in');
  await page.fill('input[name=email]', ACCOUNTS[role]);
  await page.fill('input[name=password]', PASSWORD);
  await page.click('button[type=submit]');
  await page.waitForURL((url) => url.pathname === LANDING[role], { timeout: 30_000 });
}

export async function signInApi(request: APIRequestContext, role: Role): Promise<void> {
  const response = await request.post('/api/auth/sign-in/email', {
    data: { email: ACCOUNTS[role], password: PASSWORD },
    headers: { origin: BASE_URL },
  });
  if (!response.ok()) throw new Error(`sign-in as ${role} failed with ${response.status()}`);
}

export async function startClock(request: APIRequestContext): Promise<void> {
  await signInApi(request, 'admin');
  const response = await request.patch('/api/admin/clock', {
    data: { kind: 'start' },
    headers: { origin: BASE_URL },
  });
  if (!response.ok()) throw new Error(`resetting the demo clock failed with ${response.status()}`);
}

export async function prepareStudent(request: APIRequestContext): Promise<void> {
  await signInApi(request, 'student');
  const vendors = (await (await request.get('/api/vendors')).json()) as {
    vendors: { name: string; building: { id: string } }[];
  };
  const bistro = vendors.vendors.find((vendor) => vendor.name === 'Bistro NTT');
  if (bistro === undefined) throw new Error('Bistro NTT is not in the vendor list');
  const response = await request.patch('/api/me', {
    data: { currentBuildingId: bistro.building.id, dietTags: [], allergens: [] },
    headers: { origin: BASE_URL },
  });
  if (!response.ok()) throw new Error(`onboarding the student failed with ${response.status()}`);
}

export function longestOutletName(): string {
  const file = join(process.cwd(), 'packages', 'db', 'seed-data', 'outlets.json');
  const parsed = JSON.parse(readFileSync(file, 'utf8')) as { outlets: { name: string }[] };
  const names = parsed.outlets.map((outlet) => outlet.name);
  return names.reduce((longest, name) => (name.length > longest.length ? name : longest), '');
}
