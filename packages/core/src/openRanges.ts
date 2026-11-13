import { MS_PER_MINUTE } from './config.js';
import type { OpenRange } from './engine/busyMinutes.js';
import { hktMidnight, hktWeekday } from './time.js';

export interface HourRange {
  open: string;
  close: string;
}

export interface OpeningHours {
  mon: readonly HourRange[];
  tue: readonly HourRange[];
  wed: readonly HourRange[];
  thu: readonly HourRange[];
  fri: readonly HourRange[];
  sat: readonly HourRange[];
  sun: readonly HourRange[];
  publicHoliday: readonly HourRange[];
}

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

export function isOpenAt(ranges: readonly OpenRange[], ms: number): boolean {
  return ranges.some((range) => ms >= range.openAt && ms < range.closeAt);
}
