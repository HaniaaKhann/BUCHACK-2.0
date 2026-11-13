import { describe, expect, it } from 'vitest';
import { expandAcademicWeeks, expandHolidays, mondayOf } from '../src/seed/academicWeeks.js';

describe('mondayOf', () => {
  it('returns the Monday on or before a date', () => {
    expect(mondayOf('2026-09-01')).toBe('2026-08-31');
    expect(mondayOf('2026-08-31')).toBe('2026-08-31');
    expect(mondayOf('2026-11-29')).toBe('2026-11-23');
  });
});

describe('expandAcademicWeeks', () => {
  const periods = [
    { type: 'teaching' as const, from: '2026-09-01', to: '2026-09-19' },
    { type: 'exam' as const, from: '2026-09-14', to: '2026-09-18' },
  ];
  const weeks = expandAcademicWeeks(periods);

  it('emits one row per Monday-start week', () => {
    expect(weeks.map((w) => w.weekStart)).toEqual(['2026-08-31', '2026-09-07', '2026-09-14']);
  });

  it('prefers exam over teaching when periods overlap a week', () => {
    expect(weeks.map((w) => w.type)).toEqual(['teaching', 'teaching', 'exam']);
  });

  it('labels a week with no period as holiday', () => {
    const gap = expandAcademicWeeks([
      { type: 'teaching', from: '2026-09-01', to: '2026-09-04' },
      { type: 'teaching', from: '2026-09-14', to: '2026-09-18' },
    ]);
    expect(gap[1]).toEqual({ weekStart: '2026-09-07', type: 'holiday' });
  });
});

describe('expandHolidays', () => {
  it('expands a range into one row per day', () => {
    const rows = expandHolidays([{ from: '2026-12-25', to: '2026-12-26', name: 'Christmas' }]);
    expect(rows).toEqual([
      { date: '2026-12-25', name: 'Christmas' },
      { date: '2026-12-26', name: 'Christmas' },
    ]);
  });
});
