import { describe, expect, it } from 'vitest';
import { MS_PER_MINUTE } from '../src/config.js';
import { freeWindowsFromClasses, scheduleContext, type FreeWindowInput } from '../src/schedule.js';
import { hktMidnight } from '../src/time.js';

const TUESDAY = '2026-11-17';
const at = (hours: number, minutes = 0): number =>
  hktMidnight(TUESDAY) + (hours * 60 + minutes) * MS_PER_MINUTE;

const windows: FreeWindowInput[] = [
  { weekday: 2, startMinute: 480, endMinute: 600, prevBuildingId: null, nextBuildingId: 'A' },
  { weekday: 2, startMinute: 660, endMinute: 780, prevBuildingId: 'A', nextBuildingId: 'B' },
  { weekday: 2, startMinute: 870, endMinute: 1320, prevBuildingId: 'B', nextBuildingId: null },
];

describe('scheduleContext', () => {
  it('is free with the next class at the end of the current window', () => {
    expect(scheduleContext(windows, at(12, 15))).toEqual({
      freeNow: true,
      classEnd: null,
      classBuildingId: null,
      nextClass: { start: at(13), buildingId: 'B' },
    });
  });

  it('is in class between two windows, with the class end at the next window start', () => {
    expect(scheduleContext(windows, at(10, 30))).toEqual({
      freeNow: false,
      classEnd: at(11),
      classBuildingId: 'A',
      nextClass: { start: at(13), buildingId: 'B' },
    });
  });

  it('has no next class in the last window of the day', () => {
    expect(scheduleContext(windows, at(15)).nextClass).toBeNull();
    expect(scheduleContext(windows, at(15)).freeNow).toBe(true);
  });

  it('is free before the first class when the first window has no class before it', () => {
    const context = scheduleContext(windows, at(7));
    expect(context.freeNow).toBe(true);
    expect(context.nextClass).toEqual({ start: at(10), buildingId: 'A' });
  });

  it('is free with no next class after the last window of the day', () => {
    expect(scheduleContext(windows, at(23))).toEqual({
      freeNow: true,
      classEnd: null,
      classBuildingId: null,
      nextClass: null,
    });
  });

  it('is free all day when there are no windows for that weekday', () => {
    const sunday = hktMidnight('2026-11-15') + 12 * 60 * MS_PER_MINUTE;
    expect(scheduleContext(windows, sunday).freeNow).toBe(true);
    expect(scheduleContext([], at(12)).nextClass).toBeNull();
  });
});

describe('freeWindowsFromClasses', () => {
  const classes = [
    { weekday: 2, startMinute: 540, endMinute: 600, buildingId: 'A' },
    { weekday: 2, startMinute: 610, endMinute: 660, buildingId: 'B' },
    { weekday: 2, startMinute: 780, endMinute: 840, buildingId: 'C' },
  ];

  it('stores only the gaps, with the building before and after each', () => {
    expect(freeWindowsFromClasses(classes)).toEqual([
      { weekday: 2, startMinute: 480, endMinute: 540, prevBuildingId: null, nextBuildingId: 'A' },
      { weekday: 2, startMinute: 660, endMinute: 780, prevBuildingId: 'B', nextBuildingId: 'C' },
      { weekday: 2, startMinute: 840, endMinute: 1320, prevBuildingId: 'C', nextBuildingId: null },
    ]);
  });

  it('merges classes with a gap under 15 minutes into one block', () => {
    const merged = freeWindowsFromClasses(classes);
    expect(merged.some((window) => window.startMinute === 600)).toBe(false);
  });

  it('keeps a gap of exactly 15 minutes', () => {
    const result = freeWindowsFromClasses([
      { weekday: 1, startMinute: 540, endMinute: 600, buildingId: 'A' },
      { weekday: 1, startMinute: 615, endMinute: 660, buildingId: 'B' },
    ]);
    expect(result.some((window) => window.startMinute === 600 && window.endMinute === 615)).toBe(
      true,
    );
  });

  it('returns nothing for days without classes and for no classes at all', () => {
    expect(freeWindowsFromClasses([])).toEqual([]);
    expect(freeWindowsFromClasses(classes).every((window) => window.weekday === 2)).toBe(true);
  });

  it('never keeps course names or any class detail beyond the buildings', () => {
    const result = freeWindowsFromClasses([
      { weekday: 3, startMinute: 600, endMinute: 660, buildingId: 'A' },
    ]);
    for (const window of result) {
      expect(Object.keys(window).sort()).toEqual([
        'endMinute',
        'nextBuildingId',
        'prevBuildingId',
        'startMinute',
        'weekday',
      ]);
    }
  });

  it('round-trips into a schedule context', () => {
    const generated = freeWindowsFromClasses(classes);
    const context = scheduleContext(generated, at(10));
    expect(context.freeNow).toBe(false);
    expect(context.classEnd).toBe(at(11));
    expect(context.nextClass).toEqual({ start: at(13), buildingId: 'C' });
  });
});
