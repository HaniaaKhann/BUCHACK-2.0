import { z } from 'zod';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const clockTime = z.string().regex(/^\d{2}:\d{2}$/);

const hourRange = z.object({ open: clockTime, close: clockTime });

export const buildingSchema = z.object({
  campus: z.string().min(1),
  name: z.string().min(1),
  code: z.string().nullable(),
  source: z.string().min(1),
});

export const outletSchema = z.object({
  name: z.string().min(1),
  campus: z.string().min(1),
  buildingName: z.string().min(1),
  floor: z.string().min(1),
  foodType: z.string().min(1),
  officialDietaryOptions: z.array(z.string()),
  hours: z.object({
    monFri: z.array(hourRange),
    sat: z.array(hourRange),
    sun: z.array(hourRange),
    publicHoliday: z.array(hourRange),
  }),
  pickupEnabled: z.boolean(),
  status: z.enum(['open', 'closed_for_renovation']),
  page: z.string().min(1),
});

export const outletsFileSchema = z.object({
  retrievedAt: z.string().datetime({ offset: true }),
  sourceBaseUrl: z.string().url(),
  outlets: z.array(outletSchema).min(1),
});

export const walkTimeDefaultsSchema = z.object({
  source: z.enum(['estimate', 'measured']),
  sameBuildingMinutes: z.number().int().positive(),
  sameCampusMinutes: z.number().int().positive(),
  betweenMainCampusesMinutes: z.number().int().positive(),
  jc3Minutes: z.number().int().positive(),
  jc3Campus: z.string().min(1),
});

export const academicFileSchema = z.object({
  source: z.string().url(),
  retrievedAt: isoDate,
  periods: z.array(
    z.object({
      type: z.enum(['teaching', 'reading', 'exam', 'holiday']),
      from: isoDate,
      to: isoDate,
    }),
  ),
  publicHolidays: z.array(z.object({ from: isoDate, to: isoDate, name: z.string().min(1) })),
});

export const buildingsFileSchema = z.array(buildingSchema).min(1);

export const DIET_TAGS = ['vegetarian', 'vegan'] as const;
export const ALLERGENS = [
  'gluten',
  'egg',
  'dairy',
  'soy',
  'peanut',
  'tree_nut',
  'sesame',
  'fish',
  'shellfish',
] as const;

export const menuItemSchema = z.object({
  name: z.string().min(1),
  priceHkd: z.number().int().positive(),
  category: z.string().min(1),
  dietTags: z.array(z.enum(DIET_TAGS)),
  allergens: z.array(z.enum(ALLERGENS)),
  prepPriorMin: z.number().positive(),
  isSpecial: z.boolean().default(false),
  externalId: z.string().min(1).optional(),
});

export const menuFileSchema = z.object({
  isDemoData: z.literal(true),
  source: z.enum(['generic', 'kaggle']),
  description: z.string().min(1),
  outlets: z.array(
    z.object({
      outletName: z.string().min(1),
      items: z.array(menuItemSchema).min(1),
    }),
  ),
});

export type MenuItemSeed = z.infer<typeof menuItemSchema>;
export type MenuFile = z.infer<typeof menuFileSchema>;

export type BuildingSeed = z.infer<typeof buildingSchema>;
export type OutletSeed = z.infer<typeof outletSchema>;
export type HourRange = z.infer<typeof hourRange>;
export type WalkTimeDefaults = z.infer<typeof walkTimeDefaultsSchema>;
export type AcademicFile = z.infer<typeof academicFileSchema>;
