import { describe, expect, it } from 'vitest';
import {
  hktDate,
  hktMidnight,
  hktMinuteOfDay,
  hktSlotIndex,
  hktWeekday,
  weekTypeLookup,
} from '../src/hkt.js';

const tuesdayNoon = Date.UTC(2026, 10, 17, 4, 15);

describe('hkt helpers', () => {
  it('uses the Hong Kong date, not the UTC date', () => {
    expect(hktDate(Date.UTC(2026, 10, 16, 17, 0))).toBe('2026-11-17');
    expect(hktDate(Date.UTC(2026, 10, 16, 15, 59))).toBe('2026-11-16');
  });

  it('finds HKT midnight', () => {
    expect(hktMidnight('2026-11-17')).toBe(Date.UTC(2026, 10, 16, 16, 0));
  });

  it('gives weekday, minute of day and slot index', () => {
    expect(hktWeekday(tuesdayNoon)).toBe(2);
    expect(hktMinuteOfDay(tuesdayNoon)).toBe(12 * 60 + 15);
    expect(hktSlotIndex(tuesdayNoon)).toBe(49);
  });
});

describe('weekTypeLookup', () => {
  const lookup = weekTypeLookup([
    { weekStart: new Date('2026-11-09T00:00:00Z'), type: 'exam' },
    { weekStart: new Date('2026-11-16T00:00:00Z'), type: 'reading' },
  ]);

  it('maps any day to the week that starts on its Monday', () => {
    expect(lookup(tuesdayNoon)).toBe('reading');
    expect(lookup(Date.UTC(2026, 10, 15, 4, 0))).toBe('exam');
    expect(lookup(Date.UTC(2026, 10, 16, 0, 0))).toBe('reading');
  });

  it('treats a day outside the calendar as teaching', () => {
    expect(lookup(Date.UTC(2027, 5, 1, 4, 0))).toBe('teaching');
  });
});
