import {
  SLOT_MINUTES,
  blendMu,
  detectBatchTaps,
  itemPrep,
  labelOrder,
  lambdaHist,
  lambdaLive,
  learnedPrep,
  median,
  muPrior,
  orderPrep,
  predictWait,
  stepBacklog,
  updateBias,
  walkIns,
  type PrepSample,
  type SlotObservation,
} from '@app/core';
import {
  hktDate,
  minuteOfDay,
  minuteToMs,
  openMinutes,
  type MinuteRange,
  type SimDay,
} from '../history/calendar.js';
import type { SimOrder, TicketCountRow, VendorHistory } from '../history/generate.js';
import { historicalPrediction, type HistoricalLabel, type RangePrediction } from './historical.js';

const MS_PER_MINUTE = 60_000;

export const MODEL_IDS = ['historical', 'backlog', 'full'] as const;
export type ModelId = (typeof MODEL_IDS)[number];

export interface OrderPredictions {
  order: SimOrder;
  day: SimDay;
  predictions: Record<ModelId, RangePrediction>;
}

interface FullPrediction {
  base: number;
  point: number;
  backlogAtPlacement: number;
}

interface FullState {
  bias: number | null;
  biasSamples: number;
  residuals: number[];
  prepSamples: Map<string, PrepSample[]>;
  pickupLags: number[];
  busyRates: number[];
}

export function labelAvailableAt(order: SimOrder): number {
  return order.tapAt ?? order.pickedUpAt ?? Number.POSITIVE_INFINITY;
}

function groupByDate<T>(items: readonly T[], at: (item: T) => number): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const date = hktDate(at(item));
    groups.set(date, [...(groups.get(date) ?? []), item]);
  }
  return groups;
}

function batchFlags(appOrders: readonly SimOrder[]): Map<string, boolean> {
  const tapped = appOrders.filter((order) => order.tapAt !== null);
  const flags = detectBatchTaps(tapped.map((order) => order.tapAt ?? 0));
  return new Map(tapped.map((order, index) => [order.id, flags[index] ?? false]));
}

function slotOf(day: SimDay, ms: number): number {
  return Math.floor(minuteOfDay(day, ms) / SLOT_MINUTES);
}

function inMinute(ms: number | null, start: number): boolean {
  return ms !== null && ms >= start && ms < start + MS_PER_MINUTE;
}

function slotObservations(
  day: SimDay,
  tickets: readonly TicketCountRow[],
  appOrders: readonly SimOrder[],
): SlotObservation[] {
  return tickets.map((row) => {
    const slot = slotOf(day, Date.parse(row.slotStart));
    return {
      weekIndex: day.weekIndex,
      weekday: day.weekday,
      slot,
      weekType: day.weekType,
      walkIns: walkIns({
        tickets: row.count,
        appOrdersInSlot: appOrders.filter((o) => slotOf(day, o.placedAt) === slot).length,
        ticketsIncludeAppOrders: false,
      }),
    };
  });
}

export function busyMinuteRates(
  day: SimDay,
  ranges: readonly MinuteRange[],
  appOrders: readonly SimOrder[],
  tickets: readonly TicketCountRow[],
): number[] {
  const ticketsBySlot = new Map(
    tickets.map((row) => [slotOf(day, Date.parse(row.slotStart)), row.count]),
  );
  const rates: number[] = [];
  for (const range of ranges) {
    const first = Math.floor(range.openMinute / SLOT_MINUTES) * SLOT_MINUTES;
    for (let slotMinute = first; slotMinute < range.closeMinute; slotMinute += SLOT_MINUTES) {
      let busyMinutes = 0;
      let taps = 0;
      for (let minute = slotMinute; minute < slotMinute + SLOT_MINUTES; minute += 1) {
        const start = minuteToMs(day, minute);
        const waiting = appOrders.some(
          (o) =>
            o.placedAt + priorOrderPrep(o) * MS_PER_MINUTE < start + MS_PER_MINUTE &&
            labelAvailableAt(o) > start,
        );
        if (!waiting) continue;
        busyMinutes += 1;
        taps += appOrders.filter((o) => inMinute(o.tapAt, start)).length;
      }
      const slot = slotMinute / SLOT_MINUTES;
      const apps = appOrders.filter((o) => slotOf(day, o.placedAt) === slot).length;
      const share = apps / (apps + (ticketsBySlot.get(slot) ?? 0));
      if (busyMinutes === 0 || apps === 0) continue;
      const rate = taps / busyMinutes / share;
      for (let n = 0; n < busyMinutes; n += 1) rates.push(rate);
    }
  }
  return rates;
}

function priorOrderPrep(order: SimOrder): number {
  return orderPrep(order.items.map((item) => item.prepPriorMin));
}

function learnedOrderPrep(order: SimOrder, state: FullState): number {
  return orderPrep(
    order.items.map((item) =>
      itemPrep({
        learned: learnedPrep(state.prepSamples.get(item.name) ?? []),
        vendorPrior: item.prepPriorMin,
        categoryPrior: item.prepPriorMin,
      }),
    ),
  );
}

export function runWalkForward(vendor: VendorHistory, days: readonly SimDay[]): OrderPredictions[] {
  const appOrders = vendor.orders.filter((order) => order.channel === 'app');
  const appByDate = groupByDate(appOrders, (order) => order.placedAt);
  const ticketsByDate = groupByDate(vendor.tickets, (row) => Date.parse(row.slotStart));
  const inBatch = batchFlags(appOrders);
  const labelQueue = [...appOrders].sort((a, b) => labelAvailableAt(a) - labelAvailableAt(b));
  const dayByDate = new Map(days.map((day) => [day.date, day]));

  const pastObservations: SlotObservation[] = [];
  const historyLabels: HistoricalLabel[] = [];
  const fullPredictions = new Map<string, FullPrediction>();
  const state: FullState = {
    bias: null,
    biasSamples: 0,
    residuals: [],
    prepSamples: new Map(),
    pickupLags: [],
    busyRates: [],
  };
  const results: OrderPredictions[] = [];
  let labelCursor = 0;

  const processLabels = (upTo: number): void => {
    while (labelCursor < labelQueue.length) {
      const order = labelQueue[labelCursor];
      if (order === undefined || labelAvailableAt(order) > upTo) return;
      labelCursor += 1;
      const predicted = fullPredictions.get(order.id);
      const day = dayByDate.get(hktDate(order.placedAt));
      if (predicted === undefined || day === undefined) continue;
      if (order.tapAt !== null && order.pickedUpAt !== null && order.pickedUpAt <= upTo) {
        state.pickupLags.push((order.pickedUpAt - order.tapAt) / MS_PER_MINUTE);
      }
      const label = labelOrder({
        times: { placedAt: order.placedAt, readyAt: order.tapAt, pickedUpAt: order.pickedUpAt },
        predictedMinutes: predicted.point,
        medianPickupLagMinutes: state.pickupLags.length > 0 ? median(state.pickupLags) : 0,
        inBatch: inBatch.get(order.id) ?? false,
      });
      if (label === null) continue;
      state.bias = updateBias({
        previous: state.bias,
        error: label.actualMinutes - predicted.base,
        weight: label.weight,
      });
      state.biasSamples += 1;
      state.residuals.push(label.actualMinutes - predicted.point);
      const [onlyItem] = order.items;
      if (order.items.length === 1 && onlyItem !== undefined) {
        const samples = state.prepSamples.get(onlyItem.name) ?? [];
        samples.push({
          placedToReadyMinutes: label.actualMinutes,
          backlogAtPlacement: predicted.backlogAtPlacement,
        });
        state.prepSamples.set(onlyItem.name, samples);
      }
      historyLabels.push({
        weekday: day.weekday,
        slot: slotOf(day, order.placedAt),
        weekType: day.weekType,
        actualMinutes: label.actualMinutes,
      });
    }
  };

  for (const day of days) {
    const ranges = openMinutes(vendor.hours, day);
    if (ranges.length === 0) continue;
    const dayApps = appByDate.get(day.date) ?? [];
    const dayTickets = ticketsByDate.get(day.date) ?? [];
    const lambdaCache = new Map<number, number>();
    const lambdaFor = (slot: number): number => {
      const cached = lambdaCache.get(slot);
      if (cached !== undefined) return cached;
      const value =
        pastObservations.length === 0
          ? 0
          : lambdaHist(pastObservations, { weekday: day.weekday, slot, weekType: day.weekType })
              .perMinute;
      lambdaCache.set(slot, value);
      return value;
    };
    const prior =
      pastObservations.length === 0
        ? 0
        : muPrior({
            vendorSetting: null,
            slotTicketRatesPerMinute: pastObservations.map((o) => o.walkIns / SLOT_MINUTES),
          });
    const muBacklog = blendMu({ prior, readyTapsPerBusyMinute: [] });
    const muFull = blendMu({ prior, readyTapsPerBusyMinute: state.busyRates });

    for (const range of ranges) {
      let backlogModel = 0;
      let backlogFull = 0;
      for (let minute = range.openMinute; minute < range.closeMinute; minute += 1) {
        const start = minuteToMs(day, minute);
        if (minute % SLOT_MINUTES === 0 || minute === range.openMinute) processLabels(start);
        const slot = Math.floor(minute / SLOT_MINUTES);
        const arrivals = dayApps.filter((o) => inMinute(o.placedAt, start));
        for (const order of arrivals) {
          const prepPrior = priorOrderPrep(order);
          const backlog = predictWait({
            backlog: backlogModel,
            muPerMinute: muBacklog,
            prep: prepPrior,
            bias: 0,
            biasSamples: 0,
            residuals: [],
          });
          const full = predictWait({
            backlog: backlogFull,
            muPerMinute: muFull,
            prep: learnedOrderPrep(order, state),
            bias: state.bias ?? 0,
            biasSamples: state.biasSamples,
            residuals: state.residuals,
          });
          fullPredictions.set(order.id, {
            base: full.baseMinutes,
            point: full.pointMinutes,
            backlogAtPlacement: backlogFull,
          });
          results.push({
            order,
            day,
            predictions: {
              historical: historicalPrediction(
                historyLabels,
                { weekday: day.weekday, slot, weekType: day.weekType },
                prepPrior,
              ),
              backlog: {
                point: backlog.pointMinutes,
                low: backlog.lowMinutes,
                high: backlog.highMinutes,
              },
              full: { point: full.pointMinutes, low: full.lowMinutes, high: full.highMinutes },
            },
          });
        }
        const lambda = lambdaLive({
          lambdaHistPerMinute: lambdaFor(slot),
          busyState: 'normal',
          walkInsLast10Min: null,
        });
        backlogModel = stepBacklog(backlogModel, lambda, arrivals.length, muBacklog);
        backlogFull = stepBacklog(backlogFull, lambda, arrivals.length, muFull);
      }
    }

    pastObservations.push(...slotObservations(day, dayTickets, dayApps));
    state.busyRates.push(...busyMinuteRates(day, ranges, dayApps, dayTickets));
  }
  return results;
}
