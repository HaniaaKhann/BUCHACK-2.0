import { MS_PER_MINUTE, SLOT_MINUTES } from './config.js';
import type { WeekType } from './types.js';

const HKT_OFFSET_MS = 8 * 60 * MS_PER_MINUTE;
export const MS_PER_DAY = 24 * 60 * MS_PER_MINUTE;
const MS_PER_WEEK = 7 * MS_PER_DAY;
const DEFAULT_WEEK_TYPE: WeekType = 'teaching';

export function hktDate(ms: number): string {
  return new Date(ms + HKT_OFFSET_MS).toISOString().slice(0, 10);
}

export function hktMidnight(date: string): number {
  return Date.parse(`${date}T00:00:00Z`) - HKT_OFFSET_MS;
}

export function hktWeekday(ms: number): number {
  return new Date(ms + HKT_OFFSET_MS).getUTCDay();
}

export function hktMinuteOfDay(ms: number): number {
  return (ms - hktMidnight(hktDate(ms))) / MS_PER_MINUTE;
}

export function hktSlotIndex(ms: number): number {
  return Math.floor(hktMinuteOfDay(ms) / SLOT_MINUTES);
}

export function hktWeekIndex(ms: number): number {
  return Math.floor((ms + HKT_OFFSET_MS) / MS_PER_WEEK);
}

export function formatHktTime(ms: number): string {
  const minutes = Math.floor(hktMinuteOfDay(ms));
  const hours = Math.floor(minutes / 60);
  return `${String(hours).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

function mondayOf(ms: number): string {
  const daysSinceMonday = (hktWeekday(ms) + 6) % 7;
  return hktDate(hktMidnight(hktDate(ms)) - daysSinceMonday * MS_PER_DAY);
}

export interface AcademicWeekRow {
  weekStart: Date;
  type: WeekType;
}

export function weekTypeLookup(weeks: readonly AcademicWeekRow[]): (ms: number) => WeekType {
  const byMonday = new Map(
    weeks.map((week) => [week.weekStart.toISOString().slice(0, 10), week.type]),
  );
  return (ms) => byMonday.get(mondayOf(ms)) ?? DEFAULT_WEEK_TYPE;
}

export interface ClockRow {
  mode: 'real' | 'demo';
  currentTime: Date;
  speed: number;
  updatedAt: Date;
}

export function clockNowMs(row: ClockRow, realNowMs: number): number {
  if (row.mode === 'real') return realNowMs;
  return row.currentTime.getTime() + (realNowMs - row.updatedAt.getTime()) * row.speed;
}
