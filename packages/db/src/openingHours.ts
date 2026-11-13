import { z } from 'zod';

const hourRange = z.object({ open: z.string(), close: z.string() });

export const openingHoursSchema = z.object({
  mon: z.array(hourRange),
  tue: z.array(hourRange),
  wed: z.array(hourRange),
  thu: z.array(hourRange),
  fri: z.array(hourRange),
  sat: z.array(hourRange),
  sun: z.array(hourRange),
  publicHoliday: z.array(hourRange),
});
