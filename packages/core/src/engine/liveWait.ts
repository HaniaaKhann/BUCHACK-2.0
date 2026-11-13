import { MS_PER_MINUTE, SLOT_MINUTES } from '../config.js';
import { stepBacklog } from './backlog.js';
import { predictWait, type Prediction } from './predict.js';

const SLOT_MS = SLOT_MINUTES * MS_PER_MINUTE;

export interface LiveBacklogInput {
  backlogAtStart: number;
  startAt: number;
  until: number;
  muPerMinute: number;
  lambdaAt: (minuteStart: number) => number;
  appArrivalTimes: readonly number[];
}

export function liveBacklog(input: LiveBacklogInput): number {
  const wholeMinutes = Math.max(0, Math.floor((input.until - input.startAt) / MS_PER_MINUTE));
  const arrivalsPerMinute = new Array<number>(wholeMinutes).fill(0);
  let tailArrivals = 0;
  for (const placedAt of input.appArrivalTimes) {
    if (placedAt < input.startAt || placedAt >= input.until) continue;
    const index = Math.floor((placedAt - input.startAt) / MS_PER_MINUTE);
    if (index < wholeMinutes) arrivalsPerMinute[index] = (arrivalsPerMinute[index] ?? 0) + 1;
    else tailArrivals += 1;
  }

  let backlog = input.backlogAtStart;
  for (let index = 0; index < wholeMinutes; index += 1) {
    const minuteStart = input.startAt + index * MS_PER_MINUTE;
    backlog = stepBacklog(
      backlog,
      input.lambdaAt(minuteStart),
      arrivalsPerMinute[index] ?? 0,
      input.muPerMinute,
    );
  }
  return backlog + tailArrivals;
}

export interface ForecastSlot {
  slotStart: number;
  lambdaPerMinute: number;
}

export function lambdaFromForecast(forecast: readonly ForecastSlot[]): (ms: number) => number {
  const sorted = [...forecast].sort((a, b) => a.slotStart - b.slotStart);
  return (ms) => {
    const inside = sorted.find((slot) => ms >= slot.slotStart && ms < slot.slotStart + SLOT_MS);
    if (inside) return inside.lambdaPerMinute;
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    if (first === undefined || last === undefined) return 0;
    return ms < first.slotStart ? first.lambdaPerMinute : last.lambdaPerMinute;
  };
}

export interface WaitSnapshot {
  computedAt: number;
  backlog: number | null;
  muPerMinute: number;
  bias: number | null;
  biasSamples: number;
  residuals: readonly number[];
  forecast: readonly ForecastSlot[];
}

export interface LiveWaitInput {
  snapshot: WaitSnapshot;
  now: number;
  appArrivalTimes: readonly number[];
  prepMinutes: number;
}

export interface LiveWaitResult {
  prediction: Prediction;
  backlog: number;
  stale: boolean;
}

export function computeLiveWait(input: LiveWaitInput): LiveWaitResult {
  const { snapshot } = input;
  const stale = snapshot.backlog === null;
  const backlog =
    snapshot.backlog === null
      ? 0
      : liveBacklog({
          backlogAtStart: snapshot.backlog,
          startAt: snapshot.computedAt,
          until: Math.max(input.now, snapshot.computedAt),
          muPerMinute: snapshot.muPerMinute,
          lambdaAt: lambdaFromForecast(snapshot.forecast),
          appArrivalTimes: input.appArrivalTimes,
        });
  const prediction = predictWait({
    backlog,
    muPerMinute: snapshot.muPerMinute,
    prep: input.prepMinutes,
    bias: snapshot.bias ?? 0,
    biasSamples: snapshot.biasSamples,
    residuals: snapshot.residuals,
  });
  return { prediction, backlog, stale };
}
