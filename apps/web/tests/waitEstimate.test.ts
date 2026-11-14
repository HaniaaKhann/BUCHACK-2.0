import type { StoredSnapshotPayload } from '@app/db';
import { describe, expect, it } from 'vitest';
import { estimateWait } from '../src/server/waitEstimate';

const NOW = Date.UTC(2026, 10, 17, 4, 15);

function payload(overrides: Partial<StoredSnapshotPayload> = {}): StoredSnapshotPayload {
  return {
    computedAt: new Date(NOW).toISOString(),
    ingestedFrom: new Date(NOW - 56 * 86_400_000).toISOString(),
    modelVersion: 'v2',
    forecast: [
      {
        slotStart: new Date(NOW).toISOString(),
        lambdaPerMinute: 0,
        lambdaSource: 'matching_weeks',
        expectedWalkIns: 0,
      },
    ],
    mu: { prior: 1, perMinute: 1, busyMinutes: 0 },
    bias: { value: null, samples: 0 },
    residuals: [],
    prep: {},
    lateness: { q50: 0, q90: 3, samples: 0 },
    backlog: 10,
    ...overrides,
  };
}

describe('estimateWait', () => {
  it('falls back to prep only when there is no snapshot', () => {
    const wait = estimateWait(undefined, NOW, 5);
    expect(wait.source).toBe('cold');
    expect(wait.backlog).toBe(0);
    expect(wait.pointMinutes).toBe(5);
    expect(wait.lowMinutes).toBeLessThanOrEqual(wait.highMinutes);
  });

  it('adds the stored backlog divided by capacity', () => {
    const wait = estimateWait({ payload: payload(), arrivals: [] }, NOW, 5);
    expect(wait).toMatchObject({ source: 'live', backlog: 10 });
    expect(wait.pointMinutes).toBeCloseTo(15, 10);
  });

  it('adds app orders placed since the snapshot', () => {
    const wait = estimateWait(
      { payload: payload(), arrivals: [NOW + 10_000, NOW + 20_000] },
      NOW + 30_000,
      5,
    );
    expect(wait.backlog).toBe(12);
  });

  it('flags a snapshot without a backlog as stale and does not throw', () => {
    const { backlog: _backlog, ...older } = payload();
    const wait = estimateWait({ payload: older, arrivals: [NOW] }, NOW + 60_000, 5);
    expect(wait.source).toBe('stale');
    expect(wait.backlog).toBe(0);
    expect(wait.pointMinutes).toBeGreaterThanOrEqual(5);
  });
});
