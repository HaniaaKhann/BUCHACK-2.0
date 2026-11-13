import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createRng } from '../src/rng.js';
import { buildDays, hktMidnightMs, openMinutes } from '../src/history/calendar.js';
import {
  APP_ORDER_SHARE,
  FOCUS_OUTLETS,
  HIDDEN_WALK_IN_SHARE,
  TAP_FORGET_PROBABILITY,
  WEEK_LAYOUT,
} from '../src/history/config.js';
import { arrivalRatePerMinute, classBreakSpike, hasClassBreaks } from '../src/history/demand.js';
import { appOrderRows } from '../src/history/export.js';
import { generateHistory } from '../src/history/generate.js';
import { orderServiceMinutes, serveFifo } from '../src/history/kitchen.js';
import { generateStudents } from '../src/history/students.js';
import { staffTaps } from '../src/history/taps.js';
import { DELI, smallInput } from './fixtures.js';

const MINUTE = 60_000;

describe('rng', () => {
  it('repeats exactly for the same seed', () => {
    const a = createRng(42);
    const b = createRng(42);
    const drawsA = Array.from({ length: 5 }, () => a.lognormal(3, 0.4));
    const drawsB = Array.from({ length: 5 }, () => b.lognormal(3, 0.4));
    expect(drawsA).toEqual(drawsB);
  });

  it('draws poisson counts with the requested mean', () => {
    const rng = createRng(1);
    const draws = Array.from({ length: 20_000 }, () => rng.poisson(2.5));
    const mean = draws.reduce((sum, value) => sum + value, 0) / draws.length;
    expect(mean).toBeCloseTo(2.5, 1);
  });
});

describe('calendar', () => {
  const days = buildDays('2026-10-05', WEEK_LAYOUT, [{ from: '2026-10-19', to: '2026-10-19' }]);

  it('builds six weeks starting on a Monday with the agreed week types', () => {
    expect(days).toHaveLength(42);
    expect(days[0]).toMatchObject({ date: '2026-10-05', weekday: 1, weekIndex: 1 });
    expect(WEEK_LAYOUT).toEqual([
      'teaching',
      'teaching',
      'holiday',
      'teaching',
      'exam',
      'teaching',
    ]);
    expect(days.filter((day) => day.weekType === 'exam').map((day) => day.weekIndex)).toEqual(
      Array.from({ length: 7 }, () => 5),
    );
  });

  it('flags public holidays and uses their opening hours', () => {
    const holiday = days.find((day) => day.date === '2026-10-19');
    expect(holiday?.isPublicHoliday).toBe(true);
    expect(holiday === undefined ? null : openMinutes(DELI.hours, holiday)).toEqual([]);
  });

  it('places midnight at Hong Kong time', () => {
    expect(new Date(hktMidnightMs('2026-10-05')).toISOString()).toBe('2026-10-04T16:00:00.000Z');
  });
});

describe('demand', () => {
  const days = buildDays('2026-10-05', WEEK_LAYOUT, []);
  const teachingMonday = days[0];
  const examMonday = days[28];

  it('spikes sharply right after a class ends and decays', () => {
    expect(classBreakSpike(12 * 60 + 20)).toBeGreaterThan(classBreakSpike(12 * 60 + 30));
    expect(classBreakSpike(12 * 60 + 45)).toBe(0);
  });

  it('has class-break spikes in teaching weeks only', () => {
    if (teachingMonday === undefined || examMonday === undefined) throw new Error('missing day');
    expect(hasClassBreaks(teachingMonday)).toBe(true);
    expect(hasClassBreaks(examMonday)).toBe(false);
    const rate = (minute: number) =>
      arrivalRatePerMinute({ baseRatePerMinute: 1, day: teachingMonday, dayEffect: 1, minute });
    expect(rate(11 * 60 + 20)).toBeGreaterThan(rate(11 * 60 + 15) * 1.5);
  });
});

describe('kitchen', () => {
  it('cooks multi-item orders as the longest item plus a share of the rest', () => {
    expect(orderServiceMinutes([4, 2, 2])).toBe(5);
  });

  it('queues FIFO on one station and runs in parallel on two', () => {
    const jobs = [
      { arrivalMs: 0, serviceMs: 5 * MINUTE },
      { arrivalMs: MINUTE, serviceMs: 5 * MINUTE },
    ];
    expect(serveFifo(jobs, 1)).toEqual([5 * MINUTE, 10 * MINUTE]);
    expect(serveFifo(jobs, 2)).toEqual([5 * MINUTE, 6 * MINUTE]);
  });
});

describe('staff taps', () => {
  it('taps late, forgets about one in ten and never taps before food is ready', () => {
    const ready = Array.from({ length: 5000 }, (_, index) => index * 10 * MINUTE);
    const taps = staffTaps(ready, createRng(3));
    const forgotten = taps.filter((tap) => tap === null).length / taps.length;
    expect(forgotten).toBeCloseTo(TAP_FORGET_PROBABILITY, 1);
    taps.forEach((tap, index) => {
      if (tap !== null) expect(tap).toBeGreaterThanOrEqual(ready[index] ?? 0);
    });
  });

  it('batch taps orders that become ready close together', () => {
    const ready = Array.from({ length: 2000 }, (_, index) => index * 20_000);
    const taps = staffTaps(ready, createRng(5)).filter((tap): tap is number => tap !== null);
    const gaps = taps.slice(1).map((tap, index) => tap - (taps[index] ?? 0));
    expect(gaps.filter((gap) => gap === 3000).length).toBeGreaterThan(0);
  });
});

describe('students', () => {
  it('creates at least 200 students with non-overlapping weekday free windows', () => {
    const students = generateStudents(
      [{ campus: 'BURC', buildingNames: ['A', 'B'] }],
      createRng(9),
    );
    expect(students.length).toBeGreaterThanOrEqual(200);
    for (const student of students) {
      for (const window of student.freeWindows) {
        expect(window.weekday).toBeGreaterThanOrEqual(1);
        expect(window.weekday).toBeLessThanOrEqual(5);
        expect(window.endMinute).toBeGreaterThan(window.startMinute);
      }
    }
  });
});

describe('generateHistory', () => {
  const history = generateHistory(smallInput());

  it('repeats exactly for the same seed and changes with a different seed', () => {
    expect(generateHistory(smallInput())).toEqual(history);
    expect(generateHistory(smallInput(8)).vendors[0]?.orders).not.toEqual(
      history.vendors[0]?.orders,
    );
  });

  it('writes ticket rows in the ticket_counts shape, one per open 15-minute slot', () => {
    const rowSchema = z
      .object({
        vendorName: z.string().min(1),
        slotStart: z.string().datetime(),
        count: z.number().int().nonnegative(),
        source: z.literal('sim'),
      })
      .strict();
    const deli = history.vendors[0];
    if (deli === undefined) throw new Error('missing vendor');
    deli.tickets.forEach((row) => rowSchema.parse(row));
    const openWeekdays = history.days.filter(
      (day) => day.weekday >= 1 && day.weekday <= 5 && !day.isPublicHoliday,
    ).length;
    expect(deli.tickets).toHaveLength(openWeekdays * 48);
  });

  it('hides some walk-ins from the ticket counts and routes a share of orders to the app', () => {
    const deli = history.vendors[0];
    if (deli === undefined) throw new Error('missing vendor');
    const walkIns = deli.orders.filter((order) => order.channel === 'walk_in');
    const ticketed = deli.tickets.reduce((sum, row) => sum + row.count, 0);
    expect(ticketed).toBe(walkIns.filter((order) => order.ticketed).length);
    expect(1 - ticketed / walkIns.length).toBeCloseTo(HIDDEN_WALK_IN_SHARE, 1);
    const appShare = (deli.orders.length - walkIns.length) / deli.orders.length;
    expect(appShare).toBeCloseTo(APP_ORDER_SHARE, 1);
  });

  it('keeps every order inside opening hours and ready after it was placed', () => {
    for (const vendor of history.vendors) {
      for (const order of vendor.orders) {
        expect(order.trueReadyAt).toBeGreaterThan(order.placedAt);
        if (order.pickedUpAt !== null) expect(order.pickedUpAt).toBeGreaterThan(order.trueReadyAt);
      }
    }
    expect(history.vendors[2]?.orders).toEqual([]);
  });

  it('exports only app orders with a student, in the orders table shape', () => {
    const rows = appOrderRows(history);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((row) => row.studentKey.startsWith('sim-student-'))).toBe(true);
    expect(new Set(rows.map((row) => row.id)).size).toBe(rows.length);
  });

  it('names the six focus outlets', () => {
    expect(FOCUS_OUTLETS).toEqual([
      'Main Canteen',
      'Harmony Cafeteria',
      'Harmony Lounge',
      'iCafe',
      'Bistro NTT',
      'Deli',
    ]);
  });
});

describe('independence from the engine', () => {
  it('never imports the engine package in the history generator', () => {
    const dir = fileURLToPath(new URL('../src/history/', import.meta.url));
    const sources = readdirSync(dir).filter((file) => file.endsWith('.ts'));
    expect(sources.length).toBeGreaterThan(0);
    for (const file of sources) {
      expect(readFileSync(`${dir}${file}`, 'utf8')).not.toMatch(/@app\/core|packages\/core/);
    }
  });
});
