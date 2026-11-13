import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import {
  academicFileSchema,
  buildingsFileSchema,
  menuFileSchema,
  outletsFileSchema,
} from '@app/db/seed-schemas';
import type { z } from 'zod';
import { HISTORY_SEED, HISTORY_START_DATE, WEEK_LAYOUT } from './config.js';
import type { HistoryInput } from './generate.js';
import type { CampusBuildings } from './students.js';

function fromHere(relative: string): string {
  return fileURLToPath(new URL(relative, import.meta.url));
}

export const SEED_DATA_DIR = fromHere('../../../db/seed-data');
export const GENERATED_DIR = fromHere('../../../../data/generated');
export const ACCURACY_FILE = fromHere('../../../../apps/web/public/accuracy.json');

async function loadJson<T>(name: string, schema: z.ZodType<T, z.ZodTypeDef, unknown>): Promise<T> {
  return schema.parse(JSON.parse(await readFile(`${SEED_DATA_DIR}/${name}`, 'utf8')));
}

export async function loadHistoryInput(): Promise<HistoryInput> {
  const [outletsFile, menus, academic, buildings] = await Promise.all([
    loadJson('outlets.json', outletsFileSchema),
    loadJson('menus_generic.json', menuFileSchema),
    loadJson('academic_weeks.json', academicFileSchema),
    loadJson('buildings.json', buildingsFileSchema),
  ]);

  const menuByOutlet = new Map(menus.outlets.map((menu) => [menu.outletName, menu.items]));
  const campusNames = [...new Set(buildings.map((building) => building.campus))];
  const campuses: CampusBuildings[] = campusNames.map((campus) => ({
    campus,
    buildingNames: buildings.filter((b) => b.campus === campus).map((b) => b.name),
  }));

  return {
    seed: HISTORY_SEED,
    startDate: HISTORY_START_DATE,
    weekLayout: WEEK_LAYOUT,
    publicHolidays: academic.publicHolidays,
    campuses,
    outlets: outletsFile.outlets.map((outlet) => ({
      name: outlet.name,
      campus: outlet.campus,
      hours: outlet.hours,
      pickupEnabled: outlet.pickupEnabled,
      status: outlet.status,
      items: (menuByOutlet.get(outlet.name) ?? []).map((item) => ({
        name: item.name,
        prepPriorMin: item.prepPriorMin,
      })),
    })),
  };
}
