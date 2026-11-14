import { hktDate, type OpeningHours } from '@app/core';
import { describe, expect, it } from 'vitest';
import {
  completedDayBusyRates,
  toSnapshotOrder,
  type LoadedOrder,
} from '../../../apps/worker/src/jobs/engineSnapshot.js';
import { buildSnapshotPayload } from '../../../apps/worker/src/snapshotPayload.js';
import { runWalkForward } from '../src/backtest/walkForward.js';
import { TRAIN_WEEKS } from '../src/history/config.js';
import { generateHistory, type SimOrder, type VendorHistory } from '../src/history/generate.js';
import { smallInput } from './fixtures.js';

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

function expandHours(hours: VendorHistory['hours']): OpeningHours {
  return {
    mon: hours.monFri,
    tue: hours.monFri,
    wed: hours.monFri,
    thu: hours.monFri,
    fri: hours.monFri,
    sat: hours.sat,
    sun: hours.sun,
    publicHoliday: hours.publicHoliday,
  };
}

function loadedOrder(order: SimOrder): LoadedOrder {
  return {
    placedAt: new Date(order.placedAt),
    readyAt: order.tapAt === null ? null : new Date(order.tapAt),
    pickedUpAt: order.pickedUpAt === null ? null : new Date(order.pickedUpAt),
    slotStart: null,
    predictedPoint: new Date(order.placedAt),
    predictedBase: new Date(order.placedAt),
    backlogAtPlacement: 0,
    items: order.items.map((item) => ({
      qty: 1,
      prepPriorSnapshotMin: item.prepPriorMin,
      menuItem: { name: item.name },
    })),
  };
}

describe('worker backlog against the backtest backlog', () => {
  const history = generateHistory(smallInput());
  const vendor = history.vendors.find((candidate) => candidate.name === 'Deli');
  if (vendor === undefined) throw new Error('fixture has no Deli');
  const deli: VendorHistory = vendor;
  const appOrders = deli.orders.filter((order) => order.channel === 'app');
  const rows = runWalkForward(deli, history.days);
  const holidays = new Set(['2026-10-19']);
  const weekTypeByDate = new Map(history.days.map((day) => [day.date, day.weekType]));

  function workerBacklogAt(boundary: number): number {
    const loaded = appOrders.map(loadedOrder);
    const tickets = deli.tickets
      .map((row) => ({ slotStart: Date.parse(row.slotStart), count: row.count }))
      .filter((row) => row.slotStart + 15 * MINUTE <= boundary);
    const hours = expandHours(deli.hours);
    const openRanges = history.days
      .filter((day) => day.date === hktDate(boundary))
      .flatMap((day) => {
        const midnight = day.midnightMs;
        return (day.isPublicHoliday ? hours.publicHoliday : weekdayHours(hours, day.weekday)).map(
          (range) => ({
            openAt: midnight + minuteOf(range.open) * MINUTE,
            closeAt: midnight + minuteOf(range.close) * MINUTE,
          }),
        );
      });
    const payload = buildSnapshotPayload({
      boundary,
      ingestedFrom: boundary - 56 * DAY,
      capacityPriorPerMin: null,
      ticketsIncludeAppOrders: false,
      tickets,
      orders: loaded.map(toSnapshotOrder),
      appOrdersBySlot: new Map(),
      dayBusyRates: completedDayBusyRates(
        hours,
        holidays,
        loaded,
        tickets,
        boundary - 56 * DAY,
        boundary,
      ),
      openRanges,
      weekTypeOf: (ms) => weekTypeByDate.get(hktDate(ms)) ?? 'teaching',
    });
    return payload.backlog;
  }

  const testRows = rows.filter((row) => row.day.weekIndex > TRAIN_WEEKS);
  const busiestPerDay = [...new Set(testRows.map((row) => row.day.date))]
    .map((date) =>
      testRows
        .filter((row) => row.day.date === date)
        .reduce((best, row) =>
          row.fullBacklogAtPlacement > best.fullBacklogAtPlacement ? row : best,
        ),
    )
    .filter((row) => row.fullBacklogAtPlacement > 0.5)
    .slice(0, 5);

  it('has boundaries on several days where the backtest backlog is clearly above zero', () => {
    expect(busiestPerDay.length).toBeGreaterThanOrEqual(3);
  });

  it('gives the worker the same backlog as the backtest for the same outlet and boundary', () => {
    for (const row of busiestPerDay) {
      const boundary = Math.floor(row.order.placedAt / MINUTE) * MINUTE;
      expect(workerBacklogAt(boundary), row.day.date).toBeCloseTo(row.fullBacklogAtPlacement, 9);
    }
  });
});

function minuteOf(clock: string): number {
  const [hours, minutes] = clock.split(':').map(Number);
  return (hours ?? 0) * 60 + (minutes ?? 0);
}

function weekdayHours(hours: OpeningHours, weekday: number): OpeningHours['mon'] {
  const keys = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
  return hours[keys[weekday] ?? 'mon'];
}
