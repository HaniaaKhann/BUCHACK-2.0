import { HKT_OFFSET_MINUTES, type SimWeekType } from './config.js';

const MS_PER_MINUTE = 60_000;
const MS_PER_DAY = 24 * 60 * MS_PER_MINUTE;

export interface HourRange {
  open: string;
  close: string;
}

export interface OutletHours {
  monFri: readonly HourRange[];
  sat: readonly HourRange[];
  sun: readonly HourRange[];
  publicHoliday: readonly HourRange[];
}

export interface DateRange {
  from: string;
  to: string;
}

export interface SimDay {
  date: string;
  weekIndex: number;
  weekType: SimWeekType;
  weekday: number;
  isPublicHoliday: boolean;
  midnightMs: number;
}

export interface MinuteRange {
  openMinute: number;
  closeMinute: number;
}

export function hktMidnightMs(date: string): number {
  return Date.parse(`${date}T00:00:00Z`) - HKT_OFFSET_MINUTES * MS_PER_MINUTE;
}

export function hktDate(ms: number): string {
  return new Date(ms + HKT_OFFSET_MINUTES * MS_PER_MINUTE).toISOString().slice(0, 10);
}

function isWithin(date: string, range: DateRange): boolean {
  return date >= range.from && date <= range.to;
}

export function buildDays(
  startDate: string,
  layout: readonly SimWeekType[],
  publicHolidays: readonly DateRange[],
): SimDay[] {
  const start = hktMidnightMs(startDate);
  return Array.from({ length: layout.length * 7 }, (_, offset) => {
    const midnightMs = start + offset * MS_PER_DAY;
    const date = hktDate(midnightMs);
    const weekPosition = Math.floor(offset / 7);
    return {
      date,
      weekIndex: weekPosition + 1,
      weekType: layout[weekPosition] as SimWeekType,
      weekday: new Date(`${date}T00:00:00Z`).getUTCDay(),
      isPublicHoliday: publicHolidays.some((range) => isWithin(date, range)),
      midnightMs,
    };
  });
}

function toMinute(clock: string): number {
  const [hours, minutes] = clock.split(':').map(Number);
  return (hours ?? 0) * 60 + (minutes ?? 0);
}

function rangesFor(hours: OutletHours, day: SimDay): readonly HourRange[] {
  if (day.isPublicHoliday) return hours.publicHoliday;
  if (day.weekday === 0) return hours.sun;
  if (day.weekday === 6) return hours.sat;
  return hours.monFri;
}

export function openMinutes(hours: OutletHours, day: SimDay): MinuteRange[] {
  return rangesFor(hours, day).map((range) => ({
    openMinute: toMinute(range.open),
    closeMinute: toMinute(range.close),
  }));
}

export function minuteToMs(day: SimDay, minuteOfDay: number): number {
  return day.midnightMs + minuteOfDay * MS_PER_MINUTE;
}

export function minuteOfDay(day: SimDay, ms: number): number {
  return (ms - day.midnightMs) / MS_PER_MINUTE;
}
