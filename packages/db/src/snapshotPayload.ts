import { z } from 'zod';

const base = z.object({
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

export const snapshotPayloadSchema = base.extend({ backlog: z.number() });
export type SnapshotPayload = z.infer<typeof snapshotPayloadSchema>;

const storedSchema = base.extend({ backlog: z.number().optional() });
export type StoredSnapshotPayload = z.infer<typeof storedSchema>;

export function readSnapshotPayload(json: unknown): StoredSnapshotPayload | null {
  const parsed = storedSchema.safeParse(json);
  return parsed.success ? parsed.data : null;
}

export function isStaleSnapshot(payload: StoredSnapshotPayload): boolean {
  return payload.backlog === undefined;
}

export interface WaitSnapshotData {
  computedAt: number;
  backlog: number | null;
  muPerMinute: number;
  bias: number | null;
  biasSamples: number;
  residuals: readonly number[];
  forecast: readonly { slotStart: number; lambdaPerMinute: number }[];
}

export function toWaitSnapshot(payload: StoredSnapshotPayload): WaitSnapshotData {
  return {
    computedAt: Date.parse(payload.computedAt),
    backlog: payload.backlog ?? null,
    muPerMinute: payload.mu.perMinute,
    bias: payload.bias.value,
    biasSamples: payload.bias.samples,
    residuals: payload.residuals,
    forecast: payload.forecast.map((slot) => ({
      slotStart: Date.parse(slot.slotStart),
      lambdaPerMinute: slot.lambdaPerMinute,
    })),
  };
}
