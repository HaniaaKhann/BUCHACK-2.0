import type { AcademicFile } from './schemas.js';

export type WeekType = AcademicFile['periods'][number]['type'];
export type WeekRow = { weekStart: string; type: WeekType };
export type HolidayRow = { date: string; name: string };

const DAY_MS = 86_400_000;
const PRIORITY: WeekType[] = ['exam', 'reading', 'teaching', 'holiday'];

function toMs(date: string): number {
  return Date.parse(`${date}T00:00:00Z`);
}

function toDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function mondayOf(date: string): string {
  const ms = toMs(date);
  const weekday = (new Date(ms).getUTCDay() + 6) % 7;
  return toDate(ms - weekday * DAY_MS);
}

export function expandHolidays(holidays: AcademicFile['publicHolidays']): HolidayRow[] {
  const rows: HolidayRow[] = [];
  for (const holiday of holidays) {
    for (let ms = toMs(holiday.from); ms <= toMs(holiday.to); ms += DAY_MS) {
      rows.push({ date: toDate(ms), name: holiday.name });
    }
  }
  return rows;
}

export function expandAcademicWeeks(periods: AcademicFile['periods']): WeekRow[] {
  if (periods.length === 0) return [];
  const first = Math.min(...periods.map((p) => toMs(mondayOf(p.from))));
  const last = Math.max(...periods.map((p) => toMs(p.to)));
  const rows: WeekRow[] = [];

  for (let weekMs = first; weekMs <= last; weekMs += 7 * DAY_MS) {
    const weekEnd = weekMs + 6 * DAY_MS;
    const overlapping = periods
      .filter((p) => toMs(p.from) <= weekEnd && toMs(p.to) >= weekMs)
      .map((p) => p.type);
    const type = PRIORITY.find((t) => overlapping.includes(t)) ?? 'holiday';
    rows.push({ weekStart: toDate(weekMs), type });
  }
  return rows;
}
