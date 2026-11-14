import { DEMO_ACCOUNTS, PrismaClient } from '@app/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { POST as authPost } from '../src/app/api/auth/[...all]/route';
import { GET as getMe } from '../src/app/api/me/route';
import { BASE_URL, prepareSessions } from './support/session';

const db = new PrismaClient();
const PASSWORD = 'delete-me-password-1';
const STAMP = Date.now();
const NOW = Date.UTC(2026, 10, 17, 4, 15);

interface Person {
  id: string;
  email: string;
  cookie: string;
}

let vendorId = '';
let menuItemId = '';
const people: Record<'alice' | 'bob' | 'carol', Person> = {
  alice: { id: '', email: '', cookie: '' },
  bob: { id: '', email: '', cookie: '' },
  carol: { id: '', email: '', cookie: '' },
};

async function signUp(name: string): Promise<Person> {
  const email = `${name}-${STAMP}@example.test`;
  const response = await authPost(
    new Request(`${BASE_URL}/api/auth/sign-up/email`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: BASE_URL },
      body: JSON.stringify({ email, password: PASSWORD, name }),
    }),
  );
  expect(response.status).toBe(200);
  const cookie = response.headers
    .getSetCookie()
    .map((entry) => entry.split(';')[0])
    .join('; ');
  const user = await db.user.findUniqueOrThrow({ where: { email } });
  return { id: user.id, email, cookie };
}

async function fillAccount(person: Person, status: 'completed' | 'placed'): Promise<string> {
  await db.studentProfile.create({
    data: { userId: person.id, dietTags: ['vegan'], allergens: [], eatMinutes: 15 },
  });
  await db.freeWindow.create({
    data: { userId: person.id, weekday: 2, startMinute: 720, endMinute: 780 },
  });
  await db.classEntry.create({
    data: {
      userId: person.id,
      weekday: 2,
      startMinute: 780,
      endMinute: 840,
      buildingId: (await db.building.findFirstOrThrow()).id,
    },
  });
  await db.notification.create({
    data: {
      userId: person.id,
      kind: 'order_ready',
      title: 'Order ready',
      body: 'Ready',
      link: null,
      createdAt: new Date(NOW),
    },
  });
  const order = await db.order.create({
    data: {
      studentId: person.id,
      vendorId,
      status,
      totalHkd: 20,
      placedAt: new Date(NOW),
      predictedPoint: new Date(NOW + 360_000),
      predictedLow: new Date(NOW + 240_000),
      predictedHigh: new Date(NOW + 540_000),
      predictedBase: new Date(NOW + 300_000),
      backlogAtPlacement: 0,
      modelVersion: 'v2',
      items: { create: [{ menuItemId, qty: 1, priceHkdSnapshot: 20, prepPriorSnapshotMin: 3 }] },
    },
  });
  await db.walletLedger.create({
    data: {
      userId: person.id,
      deltaHkd: -20,
      reason: 'pay',
      refOrderId: order.id,
      createdAt: new Date(NOW),
    },
  });
  return order.id;
}

async function remove(person: Person, body: Record<string, unknown>): Promise<Response> {
  return authPost(
    new Request(`${BASE_URL}/api/auth/delete-user`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: BASE_URL, cookie: person.cookie },
      body: JSON.stringify(body),
    }),
  );
}

interface AccountCounts {
  user: number;
  accounts: number;
  sessions: number;
  profile: number;
  windows: number;
  classes: number;
  notifications: number;
  wallet: number;
  orders: number;
  items: number;
}

async function counts(userId: string): Promise<AccountCounts> {
  const orders = await db.order.findMany({ where: { studentId: userId }, select: { id: true } });
  return {
    user: await db.user.count({ where: { id: userId } }),
    accounts: await db.account.count({ where: { userId } }),
    sessions: await db.session.count({ where: { userId } }),
    profile: await db.studentProfile.count({ where: { userId } }),
    windows: await db.freeWindow.count({ where: { userId } }),
    classes: await db.classEntry.count({ where: { userId } }),
    notifications: await db.notification.count({ where: { userId } }),
    wallet: await db.walletLedger.count({ where: { userId } }),
    orders: orders.length,
    items: await db.orderItem.count({
      where: { orderId: { in: orders.map((order) => order.id) } },
    }),
  };
}

beforeAll(async () => {
  await prepareSessions();
  const owner = DEMO_ACCOUNTS.find((account) => account.role === 'vendor_owner');
  vendorId = (await db.vendorMember.findFirstOrThrow({ where: { userId: owner?.id ?? '' } }))
    .vendorId;
  menuItemId = (await db.menuItem.findFirstOrThrow({ where: { vendorId } })).id;
  people.alice = await signUp('alice');
  people.bob = await signUp('bob');
  people.carol = await signUp('carol');
  await fillAccount(people.alice, 'completed');
  await fillAccount(people.bob, 'completed');
  await fillAccount(people.carol, 'placed');
}, 180_000);

afterAll(async () => {
  await db.user.deleteMany({ where: { email: { endsWith: `-${STAMP}@example.test` } } });
  await db.session.deleteMany({
    where: { user: { email: { in: DEMO_ACCOUNTS.map((account) => account.email) } } },
  });
  await db.$disconnect();
});

describe('deleting an account', () => {
  it('needs a signed-in user and the right password', async () => {
    const anonymous = await authPost(
      new Request(`${BASE_URL}/api/auth/delete-user`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: BASE_URL },
        body: JSON.stringify({ password: PASSWORD }),
      }),
    );
    expect(anonymous.status).toBe(401);
    expect((await remove(people.alice, { password: 'not the password' })).status).toBe(400);
    expect((await counts(people.alice.id)).user).toBe(1);
  });

  it('refuses while there is an active order, and keeps everything', async () => {
    const before = await counts(people.carol.id);
    const response = await remove(people.carol, { password: PASSWORD });
    expect(response.status).toBe(409);
    expect(await counts(people.carol.id)).toEqual(before);
    expect(before.orders).toBe(1);
  });

  it('deletes the profile, classes, free windows, notifications, wallet, orders and sessions of that user only', async () => {
    const aliceBefore = await counts(people.alice.id);
    const bobBefore = await counts(people.bob.id);
    expect(aliceBefore).toMatchObject({
      user: 1,
      accounts: 1,
      profile: 1,
      windows: 1,
      classes: 1,
      notifications: 1,
      wallet: 2,
      orders: 1,
      items: 1,
    });
    expect(aliceBefore.sessions).toBeGreaterThan(0);
    const sampleBefore = await db.sampleVendorOrder.count();
    expect(sampleBefore).toBeGreaterThan(0);

    const response = await remove(people.alice, {
      password: PASSWORD,
      userId: people.bob.id,
      email: people.bob.email,
    });
    expect(response.status).toBe(200);
    expect(await db.sampleVendorOrder.count()).toBe(sampleBefore);

    expect(await counts(people.alice.id)).toEqual({
      user: 0,
      accounts: 0,
      sessions: 0,
      profile: 0,
      windows: 0,
      classes: 0,
      notifications: 0,
      wallet: 0,
      orders: 0,
      items: 0,
    });
    expect(await counts(people.bob.id)).toEqual(bobBefore);
  });

  it('signs the deleted user out everywhere', async () => {
    const response = await getMe(
      new Request(`${BASE_URL}/api/me`, {
        headers: { cookie: people.alice.cookie, origin: BASE_URL },
      }),
    );
    expect(response.status).toBe(401);
  });

  it('lets a user delete once the active order is finished', async () => {
    await db.order.updateMany({
      where: { studentId: people.carol.id },
      data: { status: 'completed' },
    });
    expect((await remove(people.carol, { password: PASSWORD })).status).toBe(200);
    expect((await counts(people.carol.id)).user).toBe(0);
  });

  it('never deletes a demo account', async () => {
    const student = DEMO_ACCOUNTS.find((account) => account.role === 'student');
    const cookies = await prepareSessions();
    const cookie = cookies.get('student') ?? '';
    const response = await remove(
      { id: student?.id ?? '', email: student?.email ?? '', cookie },
      { password: 'demo-password-1' },
    );
    expect(response.status).toBe(403);
    expect(await db.user.count({ where: { id: student?.id ?? '' } })).toBe(1);
  });
});
