import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { summarizeInApp, type InAppAccuracy } from '@app/core';
import { SIM_EMAIL_DOMAIN } from '@app/db';
import { z } from 'zod';
import { prisma } from './db';

const metric = z.object({
  n: z.number(),
  maeMinutes: z.number().nullable(),
  onTimeRate: z.number().nullable(),
});

const perModel = z.object({ historical: metric, backlog: metric, full: metric });
const truths = z.object({ trueReady: perModel, tap: perModel });

export const accuracySchema = z.object({
  label: z.string(),
  seed: z.number(),
  modelVersion: z.string(),
  historyStart: z.string(),
  trainWeeks: z.array(z.number()),
  testWeeks: z.array(z.number()),
  models: z.array(z.object({ id: z.enum(['historical', 'backlog', 'full']), name: z.string() })),
  overall: truths,
  byWeekType: z.array(truths.extend({ weekType: z.string() })),
});

export type SimulatedAccuracy = z.infer<typeof accuracySchema>;

export type SimulatedResult =
  | { status: 'ok'; data: SimulatedAccuracy }
  | { status: 'missing' }
  | { status: 'invalid' };

export const ACCURACY_FILE = join(process.cwd(), 'public', 'accuracy.json');

export async function loadSimulatedAccuracy(
  path: string = ACCURACY_FILE,
): Promise<SimulatedResult> {
  let text: string;
  try {
    text = await readFile(path, 'utf8');
  } catch {
    return { status: 'missing' };
  }
  try {
    const parsed = accuracySchema.safeParse(JSON.parse(text));
    return parsed.success ? { status: 'ok', data: parsed.data } : { status: 'invalid' };
  } catch {
    return { status: 'invalid' };
  }
}

export async function loadInAppAccuracy(): Promise<InAppAccuracy> {
  const rows = await prisma.order.findMany({
    where: {
      readyAt: { not: null },
      slotStart: null,
      NOT: { student: { email: { endsWith: `@${SIM_EMAIL_DOMAIN}` } } },
    },
    select: {
      placedAt: true,
      readyAt: true,
      predictedLow: true,
      predictedPoint: true,
      predictedHigh: true,
    },
  });
  return summarizeInApp(
    rows.flatMap((row) =>
      row.readyAt === null
        ? []
        : [
            {
              placedAt: row.placedAt.getTime(),
              readyAt: row.readyAt.getTime(),
              predictedLow: row.predictedLow.getTime(),
              predictedPoint: row.predictedPoint.getTime(),
              predictedHigh: row.predictedHigh.getTime(),
            },
          ],
    ),
  );
}
