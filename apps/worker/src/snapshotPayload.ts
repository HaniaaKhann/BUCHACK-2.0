import {
  FORECAST_SLOTS,
  MODEL_VERSION,
  MS_PER_MINUTE,
  PREP_MAX_BACKLOG,
  RESIDUAL_WINDOW,
  SLOT_MINUTES,
  blendMu,
  detectBatchTaps,
  labelOrder,
  lambdaHist,
  latenessMinutes,
  latenessQuantiles,
  learnedPrep,
  median,
  muPrior,
  updateBias,
  walkIns,
  type PrepSample,
  type SlotObservation,
  type WeekType,
} from '@app/core';
import { z } from 'zod';
import { hktSlotIndex, hktWeekIndex, hktWeekday } from './hkt.js';

const SLOT_MS = SLOT_MINUTES * MS_PER_MINUTE;

export interface SnapshotOrder {
  placedAt: number;
  readyAt: number | null;
  pickedUpAt: number | null;
  slotStart: number | null;
  predictedPoint: number;
  predictedBase: number;
  backlogAtPlacement: number;
  singleItemName: string | null;
}

export interface TicketRow {
  slotStart: number;
  count: number;
}

export interface DayBusyRates {
  dayEnd: number;
  rates: number[];
}

export interface SnapshotInput {
  boundary: number;
  ingestedFrom: number;
  capacityPriorPerMin: number | null;
  ticketsIncludeAppOrders: boolean;
  tickets: readonly TicketRow[];
  orders: readonly SnapshotOrder[];
  appOrdersBySlot: ReadonlyMap<number, number>;
  dayBusyRates: readonly DayBusyRates[];
  weekTypeOf: (ms: number) => WeekType;
}

export const snapshotPayloadSchema = z.object({
  computedAt: z.string(),
  ingestedFrom: z.string(),
  modelVersion: z.string(),
  forecast: z.array(
    z.object({
      slotStart: z.string(),
      lambdaPerMinute: z.number(),
      lambdaSource: z.enum(['matching_weeks', 'all_weekdays', 'vendor_average']),
      expectedWalkIns: z.number(),
    }),
  ),
  mu: z.object({ prior: z.number(), perMinute: z.number(), busyMinutes: z.number() }),
  bias: z.object({ value: z.number().nullable(), samples: z.number() }),
  residuals: z.array(z.number()),
  prep: z.record(z.object({ minutes: z.number(), samples: z.number() })),
  lateness: z.object({ q50: z.number(), q90: z.number(), samples: z.number() }),
});

export type SnapshotPayload = z.infer<typeof snapshotPayloadSchema>;

function labelAt(order: SnapshotOrder): number {
  return order.readyAt ?? order.pickedUpAt ?? Number.POSITIVE_INFINITY;
}

function observationsFor(input: SnapshotInput): SlotObservation[] {
  return input.tickets
    .filter((row) => row.slotStart >= input.ingestedFrom && row.slotStart < input.boundary)
    .map((row) => ({
      weekIndex: hktWeekIndex(row.slotStart),
      weekday: hktWeekday(row.slotStart),
      slot: hktSlotIndex(row.slotStart),
      weekType: input.weekTypeOf(row.slotStart),
      walkIns: walkIns({
        tickets: row.count,
        appOrdersInSlot: input.appOrdersBySlot.get(row.slotStart) ?? 0,
        ticketsIncludeAppOrders: input.ticketsIncludeAppOrders,
      }),
    }));
}

interface LearnedState {
  bias: number | null;
  biasSamples: number;
  residuals: number[];
  prepSamples: Map<string, PrepSample[]>;
}

function learnFromOrders(
  orders: readonly SnapshotOrder[],
  ingestedFrom: number,
  boundary: number,
): LearnedState {
  const known = orders.filter(
    (order) =>
      order.placedAt >= ingestedFrom && order.placedAt < boundary && labelAt(order) <= boundary,
  );
  const taps = known.filter((order) => order.readyAt !== null);
  const flags = detectBatchTaps(taps.map((order) => order.readyAt ?? 0));
  const batched = new Set(taps.filter((_, index) => flags[index]));
  const pickupLags = known
    .filter(
      (order) =>
        order.readyAt !== null && order.pickedUpAt !== null && order.pickedUpAt <= boundary,
    )
    .map((order) => ((order.pickedUpAt ?? 0) - (order.readyAt ?? 0)) / MS_PER_MINUTE);
  const medianLag = pickupLags.length > 0 ? median(pickupLags) : 0;

  const state: LearnedState = {
    bias: null,
    biasSamples: 0,
    residuals: [],
    prepSamples: new Map(),
  };
  const ordered = [...known].sort((a, b) => labelAt(a) - labelAt(b) || a.placedAt - b.placedAt);
  for (const order of ordered) {
    const predicted = (order.predictedPoint - order.placedAt) / MS_PER_MINUTE;
    const base = (order.predictedBase - order.placedAt) / MS_PER_MINUTE;
    const label = labelOrder({
      times: { placedAt: order.placedAt, readyAt: order.readyAt, pickedUpAt: order.pickedUpAt },
      predictedMinutes: predicted,
      medianPickupLagMinutes: medianLag,
      inBatch: batched.has(order),
    });
    if (label === null) continue;
    state.bias = updateBias({
      previous: state.bias,
      error: label.actualMinutes - base,
      weight: label.weight,
    });
    state.biasSamples += 1;
    state.residuals.push(label.actualMinutes - predicted);
    if (order.singleItemName !== null) {
      const samples = state.prepSamples.get(order.singleItemName) ?? [];
      samples.push({
        placedToReadyMinutes: label.actualMinutes,
        backlogAtPlacement: order.backlogAtPlacement,
      });
      state.prepSamples.set(order.singleItemName, samples);
    }
  }
  return state;
}

function prepStats(
  samplesByItem: ReadonlyMap<string, readonly PrepSample[]>,
): SnapshotPayload['prep'] {
  const stats: SnapshotPayload['prep'] = {};
  for (const [name, samples] of samplesByItem) {
    const minutes = learnedPrep(samples);
    if (minutes === null) continue;
    stats[name] = {
      minutes,
      samples: samples.filter((sample) => sample.backlogAtPlacement <= PREP_MAX_BACKLOG).length,
    };
  }
  return stats;
}

function scheduledLateness(
  orders: readonly SnapshotOrder[],
  ingestedFrom: number,
  boundary: number,
): number[] {
  return orders.flatMap((order) =>
    order.slotStart !== null &&
    order.readyAt !== null &&
    order.placedAt >= ingestedFrom &&
    order.readyAt <= boundary
      ? [latenessMinutes(order.slotStart, order.readyAt)]
      : [],
  );
}

export function buildSnapshotPayload(input: SnapshotInput): SnapshotPayload {
  const observations = observationsFor(input);
  const busyRates = input.dayBusyRates
    .filter((day) => day.dayEnd > input.ingestedFrom && day.dayEnd <= input.boundary)
    .flatMap((day) => day.rates);
  const prior = muPrior({
    vendorSetting: input.capacityPriorPerMin,
    slotTicketRatesPerMinute: observations.map((o) => o.walkIns / SLOT_MINUTES),
  });
  const learned = learnFromOrders(input.orders, input.ingestedFrom, input.boundary);
  const lateness = scheduledLateness(input.orders, input.ingestedFrom, input.boundary);

  const forecast = Array.from({ length: FORECAST_SLOTS }, (_, index) => {
    const slotStart = input.boundary + index * SLOT_MS;
    const estimate = lambdaHist(observations, {
      weekday: hktWeekday(slotStart),
      slot: hktSlotIndex(slotStart),
      weekType: input.weekTypeOf(slotStart),
    });
    return {
      slotStart: new Date(slotStart).toISOString(),
      lambdaPerMinute: estimate.perMinute,
      lambdaSource: estimate.source,
      expectedWalkIns: estimate.perMinute * SLOT_MINUTES,
    };
  });

  return {
    computedAt: new Date(input.boundary).toISOString(),
    ingestedFrom: new Date(input.ingestedFrom).toISOString(),
    modelVersion: MODEL_VERSION,
    forecast,
    mu: {
      prior,
      perMinute: blendMu({ prior, readyTapsPerBusyMinute: busyRates }),
      busyMinutes: busyRates.length,
    },
    bias: { value: learned.bias, samples: learned.biasSamples },
    residuals: learned.residuals.slice(-RESIDUAL_WINDOW),
    prep: prepStats(learned.prepSamples),
    lateness: { ...latenessQuantiles(lateness), samples: lateness.length },
  };
}
