import { PrismaClient, DEMO_ACCOUNTS } from '@app/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { GET as getBuildings } from '../src/app/api/buildings/route';
import { DELETE as deleteWindow } from '../src/app/api/free-windows/[id]/route';
import { GET as getWindows, PUT as putWindows } from '../src/app/api/free-windows/route';
import { GET as getMenu } from '../src/app/api/menu-items/route';
import { DELETE as deleteMe, GET as getMe, PATCH as patchMe } from '../src/app/api/me/route';
import { GET as getVendors } from '../src/app/api/vendors/route';
import {
  ALL_ACCOUNTS,
  asAccount,
  jsonInit,
  prepareSessions,
  type AccountKey,
} from './support/session';

const db = new PrismaClient();
let cookies = new Map<AccountKey, string>();
let buildingA = '';
let buildingB = '';
let studentId = '';

const call = (path: string, key: AccountKey | null, init?: RequestInit): Request =>
  asAccount(cookies, path, key, init);
const windowContext = (id: string): { params: Promise<{ id: string }> } => ({
  params: Promise.resolve({ id }),
});

async function resetStudent(): Promise<void> {
  await db.freeWindow.deleteMany({ where: { userId: studentId } });
  await db.studentProfile.deleteMany({ where: { userId: studentId } });
}

beforeAll(async () => {
  cookies = await prepareSessions();
  const [first, second] = await db.building.findMany({ orderBy: { name: 'asc' }, take: 2 });
  buildingA = first?.id ?? '';
  buildingB = second?.id ?? '';
  const student = DEMO_ACCOUNTS.find((account) => account.role === 'student');
  studentId = student?.id ?? '';
  await resetStudent();
}, 180_000);

afterAll(async () => {
  await resetStudent();
  await db.session.deleteMany({
    where: { user: { email: { in: DEMO_ACCOUNTS.map((account) => account.email) } } },
  });
  await db.$disconnect();
});

describe('student-only routes', () => {
  it('give 200 to a student, 403 to the other roles and 401 to nobody', async () => {
    const calls: {
      name: string;
      run: (key: AccountKey | null) => Promise<Response>;
      ok: number;
    }[] = [
      { name: 'GET /api/me', run: (k) => getMe(call('/api/me', k)), ok: 200 },
      {
        name: 'PATCH /api/me',
        run: (k) => patchMe(call('/api/me', k, jsonInit('PATCH', { eatMinutes: 15 }))),
        ok: 200,
      },
      {
        name: 'DELETE /api/me',
        run: (k) => deleteMe(call('/api/me', k, { method: 'DELETE' })),
        ok: 501,
      },
      { name: 'GET /api/buildings', run: (k) => getBuildings(call('/api/buildings', k)), ok: 200 },
      {
        name: 'GET /api/free-windows',
        run: (k) => getWindows(call('/api/free-windows', k)),
        ok: 200,
      },
      {
        name: 'PUT /api/free-windows',
        run: (k) => putWindows(call('/api/free-windows', k, jsonInit('PUT', { windows: [] }))),
        ok: 200,
      },
      {
        name: 'DELETE /api/free-windows/:id',
        run: (k) =>
          deleteWindow(
            call('/api/free-windows/00000000-0000-4000-8000-000000000000', k, { method: 'DELETE' }),
            windowContext('00000000-0000-4000-8000-000000000000'),
          ),
        ok: 404,
      },
      { name: 'GET /api/menu-items', run: (k) => getMenu(call('/api/menu-items', k)), ok: 200 },
      { name: 'GET /api/vendors', run: (k) => getVendors(call('/api/vendors', k)), ok: 200 },
    ];
    await db.studentProfile.upsert({
      where: { userId: studentId },
      create: {
        userId: studentId,
        dietTags: [],
        allergens: [],
        eatMinutes: 15,
        currentBuildingId: buildingA,
      },
      update: {},
    });
    for (const item of calls) {
      for (const key of ALL_ACCOUNTS) {
        const response = await item.run(key);
        expect(response.status, `${item.name} as ${key}`).toBe(key === 'student' ? item.ok : 403);
      }
      expect((await item.run(null)).status, `${item.name} anonymous`).toBe(401);
    }
    await resetStudent();
  });
});

describe('profile', () => {
  it('starts without a profile and creates one with defaults on the first save', async () => {
    const before = await (await getMe(call('/api/me', 'student'))).json();
    expect(before).toMatchObject({ onboardingComplete: false, profile: null });

    const saved = await patchMe(
      call('/api/me', 'student', jsonInit('PATCH', { currentBuildingId: buildingA })),
    );
    expect(saved.status).toBe(200);
    expect(await saved.json()).toMatchObject({
      onboardingComplete: true,
      profile: {
        dietTags: [],
        allergens: [],
        eatMinutes: 15,
        chatLanguage: 'en',
        currentBuildingId: buildingA,
      },
    });
  });

  it('keeps unchanged fields, drops duplicates and accepts halal as a plain choice', async () => {
    const response = await patchMe(
      call(
        '/api/me',
        'student',
        jsonInit('PATCH', {
          dietTags: ['vegetarian', 'halal', 'vegetarian'],
          allergens: ['nuts', 'seafood'],
          goal: 'more_protein',
          eatMinutes: 0,
          chatLanguage: 'zh_HK',
        }),
      ),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      profile: {
        dietTags: ['vegetarian', 'halal'],
        allergens: ['nuts', 'seafood'],
        goal: 'more_protein',
        eatMinutes: 0,
        chatLanguage: 'zh_HK',
        currentBuildingId: buildingA,
      },
    });
  });

  it('rejects unknown options, unknown keys, bad numbers and unknown buildings', async () => {
    const bad: unknown[] = [
      { dietTags: ['carnivore'] },
      { allergens: ['tree_nut'] },
      { goal: 'bulk' },
      { eatMinutes: 90 },
      { eatMinutes: 1.5 },
      { chatLanguage: 'fr' },
      { currentBuildingId: '00000000-0000-4000-8000-000000000000' },
      { currentBuildingId: 'not-a-uuid' },
      { role: 'admin' },
      { email: 'someone@else.test' },
    ];
    for (const body of bad) {
      const response = await patchMe(call('/api/me', 'student', jsonInit('PATCH', body)));
      expect(response.status, JSON.stringify(body)).toBe(400);
    }
    const notJson = await patchMe(
      call('/api/me', 'student', {
        method: 'PATCH',
        body: '{nope',
        headers: { 'content-type': 'application/json' },
      }),
    );
    expect(notJson.status).toBe(400);
  });

  it('lists every seeded building for the picker', async () => {
    const { buildings } = (await (
      await getBuildings(call('/api/buildings', 'student'))
    ).json()) as {
      buildings: { id: string; campus: string; name: string }[];
    };
    expect(buildings.length).toBe(await db.building.count());
    expect(buildings.every((building) => building.campus && building.name)).toBe(true);
  });
});

describe('free windows', () => {
  const good = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
    weekday: 2,
    startMinute: 660,
    endMinute: 780,
    prevBuildingId: buildingA,
    nextBuildingId: buildingB,
    ...overrides,
  });

  it('replaces the whole set and returns only window fields', async () => {
    const first = await putWindows(
      call(
        '/api/free-windows',
        'student',
        jsonInit('PUT', { windows: [good(), good({ weekday: 3 })] }),
      ),
    );
    expect(first.status).toBe(200);
    const { windows } = (await first.json()) as { windows: Record<string, unknown>[] };
    expect(windows).toHaveLength(2);
    for (const window of windows) {
      expect(Object.keys(window).sort()).toEqual([
        'endMinute',
        'id',
        'nextBuildingId',
        'prevBuildingId',
        'startMinute',
        'weekday',
      ]);
    }

    const second = await putWindows(
      call('/api/free-windows', 'student', jsonInit('PUT', { windows: [good({ weekday: 5 })] })),
    );
    expect(((await second.json()) as { windows: unknown[] }).windows).toHaveLength(1);
    const listed = (await (await getWindows(call('/api/free-windows', 'student'))).json()) as {
      windows: { weekday: number }[];
    };
    expect(listed.windows.map((window) => window.weekday)).toEqual([5]);
  });

  it('never accepts course names or any other detail of a timetable', async () => {
    const bodies: unknown[] = [
      { windows: [good({ course: 'COMP1001' })] },
      { windows: [good({ title: 'Lecture' })] },
      { windows: [good()], classes: [{ course: 'COMP1001' }] },
    ];
    for (const body of bodies) {
      const response = await putWindows(
        call('/api/free-windows', 'student', jsonInit('PUT', body)),
      );
      expect(response.status, JSON.stringify(body)).toBe(400);
    }
  });

  it('rejects impossible windows and unknown buildings', async () => {
    const bad: unknown[] = [
      { windows: [good({ endMinute: 660 })] },
      { windows: [good({ endMinute: 600 })] },
      { windows: [good({ weekday: 7 })] },
      { windows: [good({ startMinute: -1 })] },
      { windows: [good({ endMinute: 1441 })] },
      { windows: [good({ prevBuildingId: '00000000-0000-4000-8000-000000000000' })] },
      { windows: Array.from({ length: 71 }, () => good()) },
      { windows: 'none' },
    ];
    for (const body of bad) {
      const response = await putWindows(
        call('/api/free-windows', 'student', jsonInit('PUT', body)),
      );
      expect(response.status, JSON.stringify(body).slice(0, 80)).toBe(400);
    }
  });

  it('deletes only the caller own windows', async () => {
    await putWindows(call('/api/free-windows', 'student', jsonInit('PUT', { windows: [good()] })));
    const mine = await db.freeWindow.findFirstOrThrow({ where: { userId: studentId } });
    const theirs = await db.freeWindow.create({
      data: {
        userId: 'demo-admin',
        weekday: 1,
        startMinute: 600,
        endMinute: 660,
        prevBuildingId: null,
        nextBuildingId: null,
      },
    });

    const refused = await deleteWindow(
      call(`/api/free-windows/${theirs.id}`, 'student', { method: 'DELETE' }),
      windowContext(theirs.id),
    );
    expect(refused.status).toBe(404);
    expect(await db.freeWindow.count({ where: { id: theirs.id } })).toBe(1);

    const removed = await deleteWindow(
      call(`/api/free-windows/${mine.id}`, 'student', { method: 'DELETE' }),
      windowContext(mine.id),
    );
    expect(removed.status).toBe(200);
    expect(await db.freeWindow.count({ where: { id: mine.id } })).toBe(0);

    const badId = await deleteWindow(
      call('/api/free-windows/nope', 'student', { method: 'DELETE' }),
      windowContext('nope'),
    );
    expect(badId.status).toBe(400);
    await db.freeWindow.delete({ where: { id: theirs.id } });
  });
});

describe('menu items before onboarding', () => {
  it('asks the student to finish onboarding instead of guessing', async () => {
    await resetStudent();
    const response = await getMenu(call('/api/menu-items', 'student'));
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: 'onboarding_required' });
  });
});
