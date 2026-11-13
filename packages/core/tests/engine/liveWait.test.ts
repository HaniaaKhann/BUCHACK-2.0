import { describe, expect, it } from 'vitest';
import { MS_PER_MINUTE } from '../../src/config.js';
import {
  computeLiveWait,
  lambdaFromForecast,
  liveBacklog,
  type WaitSnapshot,
} from '../../src/engine/liveWait.js';

const START = Date.UTC(2026, 10, 17, 4, 15);
const minutes = (count: number): number => START + count * MS_PER_MINUTE;

describe('liveBacklog', () => {
  const flat = (perMinute: number) => () => perMinute;

  it('returns the starting backlog when no time has passed', () => {
    expect(
      liveBacklog({
        backlogAtStart: 4,
        startAt: START,
        until: START,
        muPerMinute: 1,
        lambdaAt: flat(5),
        appArrivalTimes: [],
      }),
    ).toBe(4);
  });

  it('adds walk-ins minus capacity each minute', () => {
    expect(
      liveBacklog({
        backlogAtStart: 0,
        startAt: START,
        until: minutes(10),
        muPerMinute: 1,
        lambdaAt: flat(2),
        appArrivalTimes: [],
      }),
    ).toBe(10);
  });

  it('never goes below zero', () => {
    expect(
      liveBacklog({
        backlogAtStart: 3,
        startAt: START,
        until: minutes(30),
        muPerMinute: 2,
        lambdaAt: flat(0),
        appArrivalTimes: [],
      }),
    ).toBe(0);
  });

  it('counts app orders in the minute they were placed and in the unfinished last minute', () => {
    const arrivals = [minutes(1) + 5_000, minutes(1) + 20_000, minutes(3) + 10_000];
    expect(
      liveBacklog({
        backlogAtStart: 0,
        startAt: START,
        until: minutes(3) + 30_000,
        muPerMinute: 0,
        lambdaAt: flat(0),
        appArrivalTimes: arrivals,
      }),
    ).toBe(3);
  });

  it('ignores app orders outside the window', () => {
    expect(
      liveBacklog({
        backlogAtStart: 0,
        startAt: START,
        until: minutes(5),
        muPerMinute: 0,
        lambdaAt: flat(0),
        appArrivalTimes: [START - 1, minutes(5), minutes(9)],
      }),
    ).toBe(0);
  });

  it('asks for the rate of each minute it steps through', () => {
    const asked: number[] = [];
    liveBacklog({
      backlogAtStart: 0,
      startAt: START,
      until: minutes(3),
      muPerMinute: 1,
      lambdaAt: (minuteStart) => {
        asked.push(minuteStart);
        return 1;
      },
      appArrivalTimes: [],
    });
    expect(asked).toEqual([minutes(0), minutes(1), minutes(2)]);
  });
});

describe('lambdaFromForecast', () => {
  const forecast = [
    { slotStart: minutes(15), lambdaPerMinute: 2 },
    { slotStart: minutes(0), lambdaPerMinute: 1 },
  ];

  it('uses the slot that contains the minute', () => {
    const lambdaAt = lambdaFromForecast(forecast);
    expect(lambdaAt(minutes(0))).toBe(1);
    expect(lambdaAt(minutes(14))).toBe(1);
    expect(lambdaAt(minutes(15))).toBe(2);
  });

  it('holds the nearest slot outside the forecast and returns zero with no forecast', () => {
    const lambdaAt = lambdaFromForecast(forecast);
    expect(lambdaAt(minutes(-30))).toBe(1);
    expect(lambdaAt(minutes(300))).toBe(2);
    expect(lambdaFromForecast([])(minutes(0))).toBe(0);
  });
});

describe('computeLiveWait', () => {
  const snapshot: WaitSnapshot = {
    computedAt: START,
    backlog: 6,
    muPerMinute: 2,
    bias: null,
    biasSamples: 0,
    residuals: [],
    forecast: [{ slotStart: START, lambdaPerMinute: 0 }],
  };

  it('divides the stored backlog by capacity and adds prep', () => {
    const result = computeLiveWait({
      snapshot,
      now: START,
      appArrivalTimes: [],
      prepMinutes: 4,
    });
    expect(result.stale).toBe(false);
    expect(result.backlog).toBe(6);
    expect(result.prediction.queueDelayMinutes).toBe(3);
    expect(result.prediction.baseMinutes).toBe(7);
  });

  it('adds app orders placed since the snapshot', () => {
    const result = computeLiveWait({
      snapshot: {
        ...snapshot,
        muPerMinute: 1,
        forecast: [{ slotStart: START, lambdaPerMinute: 0 }],
      },
      now: minutes(1) + 30_000,
      appArrivalTimes: [minutes(1) + 10_000, minutes(1) + 20_000],
      prepMinutes: 4,
    });
    expect(result.backlog).toBe(6 - 1 + 2);
  });

  it('carries walk-in arrivals forward from the forecast', () => {
    const result = computeLiveWait({
      snapshot: {
        ...snapshot,
        muPerMinute: 1,
        forecast: [{ slotStart: START, lambdaPerMinute: 3 }],
      },
      now: minutes(4),
      appArrivalTimes: [],
      prepMinutes: 4,
    });
    expect(result.backlog).toBe(6 + 4 * (3 - 1));
  });

  it('flags a snapshot without a backlog as stale and still answers', () => {
    const result = computeLiveWait({
      snapshot: { ...snapshot, backlog: null },
      now: minutes(5),
      appArrivalTimes: [minutes(1)],
      prepMinutes: 4,
    });
    expect(result.stale).toBe(true);
    expect(result.backlog).toBe(0);
    expect(result.prediction.pointMinutes).toBeGreaterThanOrEqual(4);
    expect(result.prediction.lowMinutes).toBeLessThanOrEqual(result.prediction.highMinutes);
  });

  it('does not step backwards when the clock is earlier than the snapshot', () => {
    const result = computeLiveWait({
      snapshot,
      now: START - 10 * MS_PER_MINUTE,
      appArrivalTimes: [],
      prepMinutes: 4,
    });
    expect(result.backlog).toBe(6);
  });
});
