import { DEMO_ACCOUNTS, PrismaClient } from '@app/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { POST as authPost } from '../src/app/api/auth/[...all]/route';
import { GET as getClasses, PUT as putClasses } from '../src/app/api/classes/route';
import { PATCH as patchMe } from '../src/app/api/me/route';
import { BASE_URL, asAccount, jsonInit, prepareSessions, type AccountKey } from './support/session';

const db = new PrismaClient();
const STAMP = Date.now();
const PASSWORD = 'classes-password-1';

let cookies = new Map<AccountKey, string>();
let studentId = '';
let buildingA = '';
let buildingB = '';
let hadProfile = false;

interface ClassBody {
  classes: {
    id: string;
    weekday: number;
    startMinute: number;
    endMinute: number;
    buildingId: string;
  }[];
  gapsWithoutClasses: boolean;
}

const put = (body: unknown, key: AccountKey | null = 'student'): Promise<Response> =>
  putClasses(asAccount(cookies, '/api/classes', key, jsonInit('PUT', body)));
const get = (key: AccountKey | null = 'student'): Promise<Response> =>
  getClasses(asAccount(cookies, '/api/classes', key));
const entry = (weekday: number, start: number, end: number, buildingId: string) => ({
  weekday,
  startMinute: start,
  endMinute: end,
  buildingId,
});

beforeAll(async () => {
  cookies = await prepareSessions();
  const student = DEMO_ACCOUNTS.find((account) => account.email.startsWith('student@'));
  studentId = student?.id ?? '';
  const buildings = await db.building.findMany({ take: 2, orderBy: { name: 'asc' } });
  buildingA = buildings[0]?.id ?? '';
  buildingB = buildings[1]?.id ?? '';
  hadProfile = (await db.studentProfile.findUnique({ where: { userId: studentId } })) !== null;
  await db.classEntry.deleteMany({ where: { userId: studentId } });
  await db.freeWindow.deleteMany({ where: { userId: studentId } });
}, 180_000);

afterAll(async () => {
  await db.classEntry.deleteMany({ where: { userId: studentId } });
  await db.freeWindow.deleteMany({ where: { userId: studentId } });
  if (!hadProfile) await db.studentProfile.deleteMany({ where: { userId: studentId } });
  await db.session.deleteMany({
    where: { user: { email: { in: DEMO_ACCOUNTS.map((account) => account.email) } } },
  });
  await db.$disconnect();
});

describe('classes api access', () => {
  it('needs a signed-in student', async () => {
    expect((await get(null)).status).toBe(401);
    expect((await put({ classes: [] }, null)).status).toBe(401);
    for (const key of ['owner', 'staff', 'admin'] as const) {
      expect((await get(key)).status, key).toBe(403);
      expect((await put({ classes: [] }, key)).status, key).toBe(403);
    }
  });

  it('rejects bad input', async () => {
    for (const body of [
      {},
      { classes: [{ ...entry(1, 600, 540, buildingA) }] },
      { classes: [{ ...entry(9, 540, 600, buildingA) }] },
      { classes: [{ ...entry(1, 540, 600, 'not-a-uuid') }] },
      { classes: [{ ...entry(1, 540, 600, buildingA), course: 'COMP1001' }] },
      { classes: [entry(1, 540, 600, '00000000-0000-4000-8000-000000000000')] },
    ]) {
      expect((await put(body)).status, JSON.stringify(body)).toBe(400);
    }
    const body = (await (await get()).json()) as ClassBody;
    expect(body.classes).toEqual([]);
  });
});

describe('classes stay until the student deletes them', () => {
  it('saves classes, derives the free gaps, and returns them again on the next visit', async () => {
    const saved = await put({
      classes: [entry(2, 540, 600, buildingA), entry(2, 840, 900, buildingB)],
    });
    expect(saved.status).toBe(200);
    const body = (await (await get()).json()) as ClassBody;
    expect(body.classes.map((row) => [row.weekday, row.startMinute, row.endMinute])).toEqual([
      [2, 540, 600],
      [2, 840, 900],
    ]);
    expect(body.gapsWithoutClasses).toBe(false);
    const gaps = await db.freeWindow.findMany({ where: { userId: studentId, weekday: 2 } });
    expect(gaps.length).toBeGreaterThan(0);
    expect(gaps.some((gap) => gap.startMinute === 600 && gap.endMinute === 840)).toBe(true);
  });

  it('keeps them when the profile is saved again', async () => {
    const response = await patchMe(
      asAccount(cookies, '/api/me', 'student', jsonInit('PATCH', { dietTags: ['vegan'] })),
    );
    expect(response.status).toBe(200);
    const body = (await (await get()).json()) as ClassBody;
    expect(body.classes).toHaveLength(2);
    expect(await db.freeWindow.count({ where: { userId: studentId } })).toBeGreaterThan(0);
  });

  it('edits a class, and the gaps follow', async () => {
    const before = (await (await get()).json()) as ClassBody;
    const edited = before.classes.map((row, index) =>
      index === 0
        ? entry(row.weekday, 540, 660, row.buildingId)
        : entry(row.weekday, row.startMinute, row.endMinute, row.buildingId),
    );
    expect((await put({ classes: edited })).status).toBe(200);
    const after = (await (await get()).json()) as ClassBody;
    expect(after.classes[0]?.endMinute).toBe(660);
    const gaps = await db.freeWindow.findMany({ where: { userId: studentId, weekday: 2 } });
    expect(gaps.some((gap) => gap.startMinute === 660 && gap.endMinute === 840)).toBe(true);
    expect(gaps.some((gap) => gap.startMinute === 600)).toBe(false);
  });

  it('removes a class, and an empty list removes them all and the gaps too', async () => {
    const one = (await (await get()).json()) as ClassBody;
    const first = one.classes[0];
    expect(first).toBeDefined();
    const kept = one.classes
      .slice(1)
      .map((row) => entry(row.weekday, row.startMinute, row.endMinute, row.buildingId));
    expect((await put({ classes: kept })).status).toBe(200);
    expect(((await (await get()).json()) as ClassBody).classes).toHaveLength(1);
    expect((await put({ classes: [] })).status).toBe(200);
    expect(((await (await get()).json()) as ClassBody).classes).toEqual([]);
    expect(await db.freeWindow.count({ where: { userId: studentId } })).toBe(0);
  });

  it('flags old gaps that have no classes behind them, and leaves them alone', async () => {
    await db.freeWindow.create({
      data: { userId: studentId, weekday: 3, startMinute: 720, endMinute: 780 },
    });
    const body = (await (await get()).json()) as ClassBody;
    expect(body.classes).toEqual([]);
    expect(body.gapsWithoutClasses).toBe(true);
    const response = await patchMe(
      asAccount(cookies, '/api/me', 'student', jsonInit('PATCH', { eatMinutes: 10 })),
    );
    expect(response.status).toBe(200);
    expect(await db.freeWindow.count({ where: { userId: studentId } })).toBe(1);
    await db.freeWindow.deleteMany({ where: { userId: studentId } });
  });
});

describe('classes belong to one student', () => {
  it('never shows or changes another student, and goes with the account', async () => {
    const email = `classes-${STAMP}@example.test`;
    const signUp = await authPost(
      new Request(`${BASE_URL}/api/auth/sign-up/email`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: BASE_URL },
        body: JSON.stringify({ email, password: PASSWORD, name: 'Classes Tester' }),
      }),
    );
    expect(signUp.status).toBe(200);
    const otherCookie = signUp.headers
      .getSetCookie()
      .map((cookie) => cookie.split(';')[0])
      .join('; ');
    const other = await db.user.findUniqueOrThrow({ where: { email } });

    expect((await put({ classes: [entry(1, 540, 600, buildingA)] })).status).toBe(200);
    const asOther = (body: unknown, method: string): Request =>
      new Request(`${BASE_URL}/api/classes`, {
        method,
        headers: { 'content-type': 'application/json', origin: BASE_URL, cookie: otherCookie },
        ...(method === 'PUT' ? { body: JSON.stringify(body) } : {}),
      });
    const theirs = (await (await getClasses(asOther(null, 'GET'))).json()) as ClassBody;
    expect(theirs.classes).toEqual([]);
    expect(
      (await putClasses(asOther({ classes: [entry(4, 600, 660, buildingB)] }, 'PUT'))).status,
    ).toBe(200);
    const mine = (await (await get()).json()) as ClassBody;
    expect(mine.classes.map((row) => row.weekday)).toEqual([1]);

    const deleted = await authPost(
      new Request(`${BASE_URL}/api/auth/delete-user`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: BASE_URL, cookie: otherCookie },
        body: JSON.stringify({ password: PASSWORD }),
      }),
    );
    expect(deleted.status).toBe(200);
    expect(await db.classEntry.count({ where: { userId: other.id } })).toBe(0);
    expect(await db.freeWindow.count({ where: { userId: other.id } })).toBe(0);
    expect(await db.classEntry.count({ where: { userId: studentId } })).toBe(1);
  });
});
