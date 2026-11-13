import { describe, expect, it } from 'vitest';
import { isStaleSnapshot, readSnapshotPayload, toWaitSnapshot } from '../src/snapshotPayload.js';

const current = {
  computedAt: '2026-11-17T04:15:00.000Z',
  ingestedFrom: '2026-09-22T04:15:00.000Z',
  modelVersion: 'v2',
  forecast: [
    {
      slotStart: '2026-11-17T04:15:00.000Z',
      lambdaPerMinute: 1.5,
      lambdaSource: 'matching_weeks',
      expectedWalkIns: 22.5,
    },
  ],
  mu: { prior: 0.6, perMinute: 0.7, busyMinutes: 100 },
  bias: { value: 1.2, samples: 50 },
  residuals: [0.5, -0.2],
  prep: {},
  lateness: { q50: 0, q90: 3, samples: 0 },
  backlog: 4.5,
};

describe('readSnapshotPayload', () => {
  it('reads a payload with a backlog as fresh', () => {
    const payload = readSnapshotPayload(current);
    expect(payload).not.toBeNull();
    expect(payload && isStaleSnapshot(payload)).toBe(false);
  });

  it('reads an older payload without a backlog and marks it stale instead of throwing', () => {
    const { backlog: _backlog, ...older } = current;
    const payload = readSnapshotPayload(older);
    expect(payload).not.toBeNull();
    expect(payload && isStaleSnapshot(payload)).toBe(true);
    expect(payload && toWaitSnapshot(payload).backlog).toBeNull();
  });

  it('returns null for something that is not a snapshot', () => {
    expect(readSnapshotPayload(null)).toBeNull();
    expect(readSnapshotPayload({ computedAt: 'x' })).toBeNull();
    expect(readSnapshotPayload('garbage')).toBeNull();
  });
});

describe('toWaitSnapshot', () => {
  it('turns the stored payload into numbers the live wait function uses', () => {
    const payload = readSnapshotPayload(current);
    expect(payload).not.toBeNull();
    expect(payload && toWaitSnapshot(payload)).toEqual({
      computedAt: Date.parse('2026-11-17T04:15:00.000Z'),
      backlog: 4.5,
      muPerMinute: 0.7,
      bias: 1.2,
      biasSamples: 50,
      residuals: [0.5, -0.2],
      forecast: [{ slotStart: Date.parse('2026-11-17T04:15:00.000Z'), lambdaPerMinute: 1.5 }],
    });
  });
});
