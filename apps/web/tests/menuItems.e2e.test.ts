import { DEMO_ACCOUNTS, PrismaClient } from '@app/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { GET as getMenu } from '../src/app/api/menu-items/route';
import { PUT as putWindows } from '../src/app/api/free-windows/route';
import { PATCH as patchMe } from '../src/app/api/me/route';
import { GET as getVendors } from '../src/app/api/vendors/route';
import { asAccount, jsonInit, prepareSessions, type AccountKey } from './support/session';

const db = new PrismaClient();
let cookies = new Map<AccountKey, string>();
let studentId = '';
let mainCanteenId = '';
let mainCanteenBuilding = '';
let otherCampusBuilding = '';
let otherCampus = '';
let originalClock: { mode: 'real' | 'demo'; currentTime: Date; speed: number } | null = null;

const NOON_TUESDAY = new Date('2026-11-17T04:15:00Z');
const MINUTE = 60_000;
const DEMO_VERIFIED = ['Bistro NTT', 'Main Canteen', 'Harmony Cafeteria'];

interface Item {
  id: string;
  vendorId: string;
  vendorName: string;
  name: string;
  priceHkd: number;
  dietTags: string[];
  allergens: string[];
  tagsStatus: 'verified' | 'unverified';
  notVerified: boolean;
  fit: { status: 'fits' | 'tight' | 'late'; lateByMinutes: number };
  vendorOpenNow: boolean;
  orderable: boolean;
  wait: { lowMinutes: number; highMinutes: number; source: string };
  leaveNow: boolean;
  leaveAt: number;
  cookedFor: { slotStart: number } | null;
  chips: { text: string; tone: string }[];
}

interface Menu {
  items: Item[];
  meta: {
    emptyState: string | null;
    vendorsWithoutWalk: number;
    needsBuilding: boolean;
    staleVendorIds: string[];
    schedule: { freeNow: boolean; classEnd: number | null; nextClassStart: number | null };
  };
}

async function menu(query = ''): Promise<{ status: number; body: Menu }> {
  const response = await getMenu(
    asAccount(cookies, `/api/menu-items${query === '' ? '' : `?${query}`}`, 'student'),
  );
  return { status: response.status, body: (await response.json()) as Menu };
}

async function saveProfile(body: Record<string, unknown>): Promise<void> {
  const response = await patchMe(asAccount(cookies, '/api/me', 'student', jsonInit('PATCH', body)));
  expect(response.status).toBe(200);
}

async function saveWindows(windows: Record<string, unknown>[]): Promise<void> {
  const response = await putWindows(
    asAccount(cookies, '/api/free-windows', 'student', jsonInit('PUT', { windows })),
  );
  expect(response.status).toBe(200);
}

const ticks = (item: Item): string[] =>
  item.chips.filter((chip) => chip.text.includes('✓')).map((c) => c.text);
const order = { fits: 0, tight: 1, late: 2 } as const;

function snapshotPayload(overrides: Record<string, unknown>): Record<string, unknown> {
  return {
    computedAt: '2026-11-17T04:00:00.000Z',
    ingestedFrom: '2026-09-22T04:00:00.000Z',
    modelVersion: 'v2',
    forecast: [
      {
        slotStart: '2026-11-17T04:00:00.000Z',
        lambdaPerMinute: 0,
        lambdaSource: 'matching_weeks',
        expectedWalkIns: 0,
      },
    ],
    mu: { prior: 1, perMinute: 1, busyMinutes: 0 },
    bias: { value: null, samples: 0 },
    residuals: [],
    prep: {},
    lateness: { q50: 0, q90: 3, samples: 0 },
    backlog: 20,
    ...overrides,
  };
}

async function setupSnapshot(computedAt: string, payload: Record<string, unknown>): Promise<void> {
  await db.engineSnapshot.create({
    data: {
      vendorId: mainCanteenId,
      computedAt: new Date(computedAt),
      modelVersion: 'v2',
      payload: payload as never,
    },
  });
}

beforeAll(async () => {
  cookies = await prepareSessions();
  studentId = DEMO_ACCOUNTS.find((account) => account.role === 'student')?.id ?? '';
  const clock = await db.systemClock.findUniqueOrThrow({ where: { id: 1 } });
  originalClock = { mode: clock.mode, currentTime: clock.currentTime, speed: clock.speed };
  await db.systemClock.update({
    where: { id: 1 },
    data: { mode: 'demo', currentTime: NOON_TUESDAY, speed: 0 },
  });

  const mainCanteen = await db.vendor.findUniqueOrThrow({ where: { name: 'Main Canteen' } });
  mainCanteenId = mainCanteen.id;
  mainCanteenBuilding = mainCanteen.buildingId;
  const other = await db.building.findFirstOrThrow({
    where: { campus: { not: mainCanteen.campus } },
  });
  otherCampusBuilding = other.id;
  otherCampus = other.campus;
  await db.engineSnapshot.deleteMany({});
  await db.freeWindow.deleteMany({ where: { userId: studentId } });
  await db.studentProfile.deleteMany({ where: { userId: studentId } });
  await saveProfile({ currentBuildingId: mainCanteenBuilding, eatMinutes: 15 });
}, 180_000);

afterAll(async () => {
  await db.engineSnapshot.deleteMany({});
  await db.order.deleteMany({ where: { id: { startsWith: 'e2e-' } } });
  await db.freeWindow.deleteMany({ where: { userId: studentId } });
  await db.studentProfile.deleteMany({ where: { userId: studentId } });
  if (originalClock) await db.systemClock.update({ where: { id: 1 }, data: originalClock });
  await db.session.deleteMany({
    where: { user: { email: { in: DEMO_ACCOUNTS.map((account) => account.email) } } },
  });
  await db.$disconnect();
});

describe('what the student sees by default', () => {
  it('marks items of a vendor that takes no app orders as not orderable', async () => {
    const { body } = await menu();
    const noPickup = await db.vendor.findMany({ where: { pickupEnabled: false, status: 'open' } });
    expect(noPickup.length).toBeGreaterThan(0);
    for (const vendor of noPickup) {
      const items = body.items.filter((item) => item.vendorId === vendor.id);
      expect(items.length).toBeGreaterThan(0);
      expect(items.every((item) => item.orderable === false)).toBe(true);
    }
    expect(body.items.some((item) => item.orderable)).toBe(true);
  });

  it('lists open vendors only and never the vendor closed for renovation', async () => {
    const { status, body } = await menu();
    expect(status).toBe(200);
    expect(body.items.length).toBeGreaterThan(20);
    const vendors = new Set(body.items.map((item) => item.vendorName));
    expect(vendors.has('BU Fiesta')).toBe(false);
    expect(vendors.has('Main Canteen')).toBe(true);
    expect(vendors.size).toBeGreaterThan(3);
  });

  it('labels every unverified item Not verified and gives it no tick, ever', async () => {
    for (const diet of [
      '',
      'diet=vegetarian,vegan,halal,no_pork,no_beef,gluten_free,dairy_free&off=diet',
    ]) {
      const { body } = await menu(diet);
      const unverified = body.items.filter((item) => item.tagsStatus === 'unverified');
      expect(unverified.length).toBeGreaterThan(0);
      for (const item of unverified) {
        expect(item.notVerified).toBe(true);
        expect(item.chips.map((chip) => chip.text)).toContain('Not verified');
        expect(ticks(item)).toEqual([]);
      }
    }
  });

  it('shows ready ranges built from the shared clock, with the vendor wait range attached', async () => {
    const { body } = await menu();
    for (const item of body.items.slice(0, 20)) {
      expect(item.wait.lowMinutes).toBeLessThanOrEqual(item.wait.highMinutes);
      expect(
        item.chips.some((chip) => chip.text.startsWith('Ready ') || chip.text === 'Closed now'),
      ).toBe(true);
    }
  });
});

describe('diet and allergen filters', () => {
  it('keeps only vendor-verified vegetarian items when vegetarian is on', async () => {
    await saveProfile({ dietTags: ['vegetarian'] });
    const { body } = await menu();
    expect(body.items.length).toBeGreaterThan(0);
    for (const item of body.items) {
      expect(item.tagsStatus).toBe('verified');
      expect(item.dietTags).toContain('vegetarian');
      expect(DEMO_VERIFIED).toContain(item.vendorName);
      expect(ticks(item)).toContain('Vegetarian ✓');
    }
  });

  it('brings the unverified items back, labelled, when the diet filter is turned off', async () => {
    const { body } = await menu('off=diet');
    expect(body.items.some((item) => item.notVerified)).toBe(true);
    expect(
      body.items.filter((item) => item.notVerified).every((item) => ticks(item).length === 0),
    ).toBe(true);
  });

  it('drops items with a selected allergen and anything unverified when an allergen filter is on', async () => {
    await saveProfile({ dietTags: [], allergens: ['dairy', 'seafood'] });
    const { body } = await menu();
    expect(body.items.length).toBeGreaterThan(0);
    for (const item of body.items) {
      expect(item.tagsStatus).toBe('verified');
      for (const banned of ['dairy', 'fish', 'shellfish'])
        expect(item.allergens).not.toContain(banned);
    }
  });

  it('treats gluten free as an allergen rule and ticks it only where verified', async () => {
    await saveProfile({ dietTags: ['gluten_free'], allergens: [] });
    const { body } = await menu();
    expect(body.items.length).toBeGreaterThan(0);
    for (const item of body.items) {
      expect(item.allergens).not.toContain('gluten');
      expect(ticks(item)).toContain('Gluten free ✓');
    }
  });

  it('shows the halal empty state, never a halal tick, and no halal tag exists in the data', async () => {
    expect(await db.menuItem.count({ where: { dietTags: { has: 'halal' } } })).toBe(0);
    await saveProfile({ dietTags: ['halal'], allergens: [] });
    const { body } = await menu();
    expect(body.items).toEqual([]);
    expect(body.meta.emptyState).toBe('halal_unconfirmed');

    const off = await menu('off=diet');
    expect(off.body.meta.emptyState).toBeNull();
    for (const item of off.body.items) {
      expect(item.chips.map((chip) => chip.text).join(' ')).not.toContain('Halal');
    }
  });

  it('accepts extra filters from the query instead of the profile', async () => {
    await saveProfile({ dietTags: ['halal'], allergens: [] });
    const { body } = await menu('diet=vegan');
    expect(body.items.length).toBeGreaterThan(0);
    for (const item of body.items) expect(item.dietTags).toContain('vegan');
    await saveProfile({ dietTags: [], allergens: [] });
  });
});

describe('other filters and sorting', () => {
  it('applies max price, vendor and sort', async () => {
    const cheap = await menu('maxPrice=30');
    expect(cheap.body.items.length).toBeGreaterThan(0);
    expect(cheap.body.items.every((item) => item.priceHkd <= 30)).toBe(true);

    const one = await menu(`vendor=${mainCanteenId}`);
    expect(one.body.items.length).toBeGreaterThan(0);
    expect(one.body.items.every((item) => item.vendorId === mainCanteenId)).toBe(true);

    const sorted = await menu(`vendor=${mainCanteenId}&sort=lowest_price`);
    const prices = sorted.body.items.map((item) => item.priceHkd);
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
  });

  it('applies max wait, fits only and open now', async () => {
    const quick = await menu('maxWait=240');
    const all = await menu();
    expect(quick.body.items).toHaveLength(all.body.items.length);
    const none = await menu('maxWait=1');
    expect(none.body.items.every((item) => item.wait.highMinutes <= 1)).toBe(true);

    const open = await menu('openNow=1');
    expect(open.body.items.every((item) => item.vendorOpenNow)).toBe(true);
    const fits = await menu('fits=1');
    expect(fits.body.items.every((item) => item.fit.status === 'fits')).toBe(true);
  });

  it('rejects bad parameters', async () => {
    for (const query of [
      'diet=carnivore',
      'maxPrice=abc',
      'sort=cheapest',
      'vendor=nope',
      'off=everything',
    ]) {
      expect((await menu(query)).status, query).toBe(400);
    }
  });
});

describe('fit groups, leave-at and cooked for when you arrive', () => {
  const window = (
    startMinute: number,
    endMinute: number,
    prev: string | null,
    next: string | null,
  ): Record<string, unknown> => ({
    weekday: 2,
    startMinute,
    endMinute,
    prevBuildingId: prev,
    nextBuildingId: next,
  });

  it('keeps late items visible and orders the groups fits, tight, late', async () => {
    await saveWindows([window(11 * 60, 12 * 60 + 30, null, mainCanteenBuilding)]);
    const soon = await menu();
    expect(soon.body.meta.schedule.nextClassStart).toBe(NOON_TUESDAY.getTime() + 15 * MINUTE);
    const late = soon.body.items.filter((item) => item.fit.status === 'late' && item.vendorOpenNow);
    expect(late.length).toBeGreaterThan(0);
    expect(late[0]?.chips.some((chip) => chip.text.startsWith('May make you late by'))).toBe(true);

    await saveWindows([window(11 * 60, 16 * 60, null, mainCanteenBuilding)]);
    const roomy = await menu();
    const ranks = roomy.body.items.map((item) => order[item.fit.status]);
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
    expect(roomy.body.items.some((item) => item.fit.status === 'fits')).toBe(true);
    expect(
      roomy.body.items.find((item) => item.fit.status === 'fits')?.chips.map((c) => c.text),
    ).toContain('Fits your 16:00 class');
  });

  it('says leave now when the walk equals the wait, and gives a later time otherwise', async () => {
    await saveWindows([]);
    const { body } = await menu(`vendor=${mainCanteenId}`);
    expect(body.items.every((item) => item.leaveAt >= NOON_TUESDAY.getTime())).toBe(true);
    expect(body.items.some((item) => item.leaveNow)).toBe(true);
  });

  it('suggests a cooked-for-arrival slot after class ends when the food would be ready too early', async () => {
    await saveWindows([window(13 * 60, 15 * 60, mainCanteenBuilding, mainCanteenBuilding)]);
    const { body } = await menu(`vendor=${mainCanteenId}`);
    expect(body.meta.schedule.freeNow).toBe(false);
    const classEnd = body.meta.schedule.classEnd ?? 0;
    expect(classEnd).toBe(NOON_TUESDAY.getTime() + 45 * MINUTE);
    const suggested = body.items.filter((item) => item.cookedFor !== null);
    expect(suggested.length).toBeGreaterThan(0);
    for (const item of suggested) {
      const slotStart = item.cookedFor?.slotStart ?? 0;
      expect(slotStart).toBeGreaterThanOrEqual(classEnd);
      expect(slotStart % (15 * MINUTE)).toBe(0);
    }
    await saveWindows([]);
  });
});

describe('walk times decide which vendors can be ranked', () => {
  it('ranks vendors on another campus too, using the longer walk between campuses', async () => {
    await saveProfile({ currentBuildingId: otherCampusBuilding });
    const { body } = await menu();
    expect(body.meta.vendorsWithoutWalk).toBe(0);
    const campuses = await db.vendor.findMany({
      where: { id: { in: [...new Set(body.items.map((item) => item.vendorId))] } },
      select: { campus: true },
    });
    expect(new Set(campuses.map((vendor) => vendor.campus)).size).toBeGreaterThan(1);
    expect(campuses.some((vendor) => vendor.campus === otherCampus)).toBe(true);
    await saveProfile({ currentBuildingId: mainCanteenBuilding });
  });

  it('leaves out a vendor that has no walk time from the student building and says so', async () => {
    const row = await db.walkTime.findFirstOrThrow({
      where: { fromBuildingId: mainCanteenBuilding, toVendorId: mainCanteenId },
    });
    await db.walkTime.delete({ where: { id: row.id } });
    try {
      const { body } = await menu();
      expect(body.meta.vendorsWithoutWalk).toBe(1);
      expect(body.items.some((item) => item.vendorId === mainCanteenId)).toBe(false);
      expect(body.items.length).toBeGreaterThan(0);
    } finally {
      await db.walkTime.create({
        data: {
          fromBuildingId: row.fromBuildingId,
          toBuildingId: row.toBuildingId,
          toVendorId: row.toVendorId,
          type: row.type,
          minutes: row.minutes,
          source: row.source,
        },
      });
    }
  });

  it('asks for a building when none is set', async () => {
    await saveProfile({ currentBuildingId: null });
    const { body } = await menu();
    expect(body.meta.needsBuilding).toBe(true);
    expect(body.items).toEqual([]);
    await saveProfile({ currentBuildingId: mainCanteenBuilding });
  });
});

describe('vendor list details', () => {
  it('shows each vendor walk time marked as an estimate', async () => {
    const response = await getVendors(asAccount(cookies, '/api/vendors', 'student'));
    const { vendors } = (await response.json()) as {
      vendors: { id: string; name: string; walk: { minutes: number; source: string } | null }[];
    };
    expect(vendors.some((vendor) => vendor.name === 'BU Fiesta')).toBe(false);
    const own = vendors.find((vendor) => vendor.id === mainCanteenId);
    expect(own?.walk?.source).toBe('estimate');
    expect(own?.walk?.minutes).toBeGreaterThanOrEqual(0);
    expect(vendors.every((vendor) => vendor.walk?.source === 'estimate')).toBe(true);
  });
});

describe('live waits and stale snapshots', () => {
  const mainCanteenWait = async (): Promise<{ high: number; source: string; stale: boolean }> => {
    const response = await getVendors(asAccount(cookies, '/api/vendors', 'student'));
    const { vendors } = (await response.json()) as {
      vendors: { id: string; wait: { highMinutes: number; source: string; stale: boolean } }[];
    };
    const wait = vendors.find((vendor) => vendor.id === mainCanteenId)?.wait;
    return {
      high: wait?.highMinutes ?? -1,
      source: wait?.source ?? 'none',
      stale: wait?.stale ?? false,
    };
  };

  it('uses the snapshot backlog plus app orders placed since it was written', async () => {
    const cold = await mainCanteenWait();
    expect(cold.source).toBe('cold');

    await setupSnapshot('2026-11-17T04:00:00.000Z', snapshotPayload({ backlog: 20 }));
    const live = await mainCanteenWait();
    expect(live).toMatchObject({ source: 'live', stale: false });
    expect(live.high).toBeGreaterThan(cold.high);

    await db.order.create({
      data: {
        id: 'e2e-since-snapshot',
        studentId,
        vendorId: mainCanteenId,
        status: 'placed',
        totalHkd: 30,
        placedAt: new Date('2026-11-17T04:10:00Z'),
        predictedPoint: NOON_TUESDAY,
        predictedLow: NOON_TUESDAY,
        predictedHigh: NOON_TUESDAY,
        predictedBase: NOON_TUESDAY,
        backlogAtPlacement: 0,
        modelVersion: 'v2',
      },
    });
    const withOrder = await mainCanteenWait();
    expect(withOrder.high).toBeGreaterThan(live.high);
    await db.order.delete({ where: { id: 'e2e-since-snapshot' } });
  });

  it('treats a snapshot without a backlog as stale, flags it, and does not throw', async () => {
    const { backlog: _backlog, ...older } = snapshotPayload({});
    await setupSnapshot('2026-11-17T04:10:00.000Z', older);

    const wait = await mainCanteenWait();
    expect(wait).toMatchObject({ source: 'stale', stale: true });

    const { status, body } = await menu();
    expect(status).toBe(200);
    expect(body.meta.staleVendorIds).toContain(mainCanteenId);
    expect(body.items.some((item) => item.vendorId === mainCanteenId)).toBe(true);
    await db.engineSnapshot.deleteMany({});
  });
});
