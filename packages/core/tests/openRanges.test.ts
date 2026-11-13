import { describe, expect, it } from 'vitest';
import { hktMidnight } from '../src/time.js';
import { isOpenAt, openRangesOn, type OpeningHours } from '../src/openRanges.js';

const day = [{ open: '08:00', close: '17:30' }];
const hours: OpeningHours = {
  mon: day,
  tue: day,
  wed: day,
  thu: day,
  fri: day,
  sat: [{ open: '09:00', close: '14:00' }],
  sun: [],
  publicHoliday: [],
};

describe('openRangesOn', () => {
  it('converts the weekday hours to timestamps', () => {
    const midnight = hktMidnight('2026-11-17');
    expect(openRangesOn(hours, '2026-11-17', new Set())).toEqual([
      { openAt: midnight + 8 * 3_600_000, closeAt: midnight + 17.5 * 3_600_000 },
    ]);
  });

  it('uses the public holiday hours on a public holiday', () => {
    expect(openRangesOn(hours, '2026-11-17', new Set(['2026-11-17']))).toEqual([]);
  });

  it('uses the weekend hours on a Saturday', () => {
    expect(openRangesOn(hours, '2026-11-14', new Set())).toHaveLength(1);
    expect(openRangesOn(hours, '2026-11-15', new Set())).toEqual([]);
  });
});

describe('isOpenAt', () => {
  const midnight = hktMidnight('2026-11-17');
  const ranges = openRangesOn(hours, '2026-11-17', new Set());

  it('is open from opening time up to but not including closing time', () => {
    expect(isOpenAt(ranges, midnight + 8 * 3_600_000)).toBe(true);
    expect(isOpenAt(ranges, midnight + 17.5 * 3_600_000 - 1)).toBe(true);
    expect(isOpenAt(ranges, midnight + 17.5 * 3_600_000)).toBe(false);
    expect(isOpenAt(ranges, midnight + 7 * 3_600_000)).toBe(false);
  });
});
