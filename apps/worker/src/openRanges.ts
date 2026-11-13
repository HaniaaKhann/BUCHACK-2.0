import { MS_PER_MINUTE, type OpenRange } from '@app/core';
import { z } from 'zod';
import { hktMidnight, hktWeekday } from './hkt.js';

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

export type OpeningHours = z.infer<typeof openingHoursSchema>;

const WEEKDAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

function toMinute(clock: string): number {
  const [hours, minutes] = clock.split(':').map(Number);
  return (hours ?? 0) * 60 + (minutes ?? 0);
}

export function openRangesOn(
  hours: OpeningHours,
  date: string,
  publicHolidays: ReadonlySet<string>,
): OpenRange[] {
  const midnight = hktMidnight(date);
  const key = WEEKDAY_KEYS[hktWeekday(midnight)] ?? 'mon';
  const ranges = publicHolidays.has(date) ? hours.publicHoliday : hours[key];
  return ranges.map((range) => ({
    openAt: midnight + toMinute(range.open) * MS_PER_MINUTE,
    closeAt: midnight + toMinute(range.close) * MS_PER_MINUTE,
  }));
}
