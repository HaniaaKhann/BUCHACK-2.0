import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';
import type { z } from 'zod';
import { DEMO_ACCOUNTS, seedDemoAccounts } from './accounts.js';
import { expandAcademicWeeks, expandHolidays } from './academicWeeks.js';
import { DEMO_CLOCK_START } from './clockStart.js';
import { verifyDemoMenus } from './demoVerification.js';
import { grantStartingCredit } from './wallet.js';
import { withMeatTags } from './dietTags.js';
import { writeSampleSales } from './sampleSales.js';
import { GENERATED_DIR, seedHistory } from './history.js';
import { mergeMenus } from './menus.js';
import { expandOpeningHours } from './openingHours.js';
import {
  academicFileSchema,
  buildingsFileSchema,
  menuFileSchema,
  outletsFileSchema,
  walkTimeDefaultsSchema,
} from './schemas.js';
import { buildWalkTimeRows } from './walkTimes.js';

async function loadJson<T>(name: string, schema: z.ZodType<T, z.ZodTypeDef, unknown>): Promise<T> {
  const url = new URL(`../../seed-data/${name}`, import.meta.url);
  return schema.parse(JSON.parse(await readFile(fileURLToPath(url), 'utf8')));
}

function toDate(date: string): Date {
  return new Date(`${date}T00:00:00Z`);
}

async function seedBuildings(db: PrismaClient): Promise<void> {
  const buildings = await loadJson('buildings.json', buildingsFileSchema);
  for (const b of buildings) {
    await db.building.upsert({
      where: { campus_name: { campus: b.campus, name: b.name } },
      create: b,
      update: { code: b.code, source: b.source },
    });
  }
}

async function seedVendors(db: PrismaClient): Promise<void> {
  const file = await loadJson('outlets.json', outletsFileSchema);
  const buildings = await db.building.findMany();
  const buildingId = new Map(buildings.map((b) => [`${b.campus}|${b.name}`, b.id]));

  for (const o of file.outlets) {
    const id = buildingId.get(`${o.campus}|${o.buildingName}`);
    if (!id) throw new Error(`Unknown building "${o.buildingName}" for outlet "${o.name}"`);
    const fields = {
      campus: o.campus,
      buildingId: id,
      floor: o.floor,
      foodType: o.foodType,
      officialDietaryOptions: o.officialDietaryOptions,
      openingHours: expandOpeningHours(o.hours),
      pickupEnabled: o.pickupEnabled,
      status: o.status,
      sourceUrl: `${file.sourceBaseUrl}${o.page}`,
      retrievedAt: new Date(file.retrievedAt),
    };
    await db.vendor.upsert({
      where: { name: o.name },
      create: { name: o.name, ...fields },
      update: fields,
    });
  }
}

async function loadOptionalJson<T>(
  name: string,
  schema: z.ZodType<T, z.ZodTypeDef, unknown>,
): Promise<T | null> {
  try {
    return await loadJson(name, schema);
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return null;
    throw error;
  }
}

async function seedMenus(db: PrismaClient): Promise<void> {
  const generic = await loadJson('menus_generic.json', menuFileSchema);
  const kaggle = await loadOptionalJson('menus.json', menuFileSchema);
  const vendors = await db.vendor.findMany({ select: { id: true, name: true } });
  const vendorId = new Map(vendors.map((v) => [v.name, v.id]));

  for (const item of mergeMenus(generic, kaggle)) {
    const id = vendorId.get(item.outletName);
    if (!id) throw new Error(`Unknown outlet "${item.outletName}" in menu file`);
    const fields = {
      priceHkd: item.priceHkd,
      category: item.category,
      dietTags: withMeatTags(item.name, item.dietTags),
      allergens: item.allergens,
      prepPriorMin: item.prepPriorMin,
      isSpecial: item.isSpecial,
      externalId: item.externalId ?? null,
      source: item.source,
      isDemo: item.isDemo,
    };
    await db.menuItem.upsert({
      where: { vendorId_name: { vendorId: id, name: item.name } },
      create: { vendorId: id, name: item.name, ...fields },
      update: fields,
    });
  }
}

async function seedWalkTimes(db: PrismaClient): Promise<void> {
  const defaults = await loadJson('walk_times.json', walkTimeDefaultsSchema);
  const buildings = await db.building.findMany({ select: { id: true, campus: true } });
  const vendors = await db.vendor.findMany({ select: { id: true, buildingId: true } });
  const rows = buildWalkTimeRows(buildings, vendors, defaults);
  await db.walkTime.createMany({ data: rows, skipDuplicates: true });
}

async function seedAcademicCalendar(db: PrismaClient): Promise<void> {
  const file = await loadJson('academic_weeks.json', academicFileSchema);
  for (const week of expandAcademicWeeks(file.periods)) {
    await db.academicWeek.upsert({
      where: { weekStart: toDate(week.weekStart) },
      create: { weekStart: toDate(week.weekStart), type: week.type },
      update: { type: week.type },
    });
  }
  for (const holiday of expandHolidays(file.publicHolidays)) {
    await db.publicHoliday.upsert({
      where: { date: toDate(holiday.date) },
      create: { date: toDate(holiday.date), name: holiday.name },
      update: { name: holiday.name },
    });
  }
}

async function seedClock(db: PrismaClient): Promise<void> {
  const demo = process.env['DEMO_MODE'] === 'true';
  await db.systemClock.upsert({
    where: { id: 1 },
    create: {
      id: 1,
      mode: demo ? 'demo' : 'real',
      currentTime: demo ? new Date(DEMO_CLOCK_START) : new Date(),
      speed: 1,
    },
    update: {},
  });
}

async function main(): Promise<void> {
  const db = new PrismaClient();
  try {
    await seedBuildings(db);
    await seedVendors(db);
    await seedMenus(db);
    if (process.env['DEMO_MODE'] === 'true') {
      await seedDemoAccounts(db);
      await verifyDemoMenus(db);
      await writeSampleSales(db, Date.parse(DEMO_CLOCK_START));
      for (const account of DEMO_ACCOUNTS.filter((entry) => entry.role === 'student')) {
        await grantStartingCredit(db, account.id);
      }
      await seedHistory(db, GENERATED_DIR);
    }
    await seedWalkTimes(db);
    await seedAcademicCalendar(db);
    await seedClock(db);
  } finally {
    await db.$disconnect();
  }
}

await main();
