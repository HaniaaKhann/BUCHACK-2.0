import { describe, expect, it } from 'vitest';
import { queueDelayMinutes, simulateBacklog, stepBacklog } from '../../src/engine/backlog.js';

describe('backlog', () => {
  it('steps B(t+1) = max(0, B + lambda + arrivals - mu)', () => {
    expect(stepBacklog(0.5, 1, 1, 1.5)).toBe(1);
    expect(stepBacklog(0, 0.5, 0, 1)).toBe(0);
  });

  it('stays empty when the kitchen is idle', () => {
    const result = simulateBacklog({
      initialBacklog: 0,
      lambdaLivePerMinute: 0.5,
      appArrivalsPerMinute: [0, 0, 0],
      muPerMinute: 1,
    });
    expect(result).toEqual({ backlog: 0, trajectory: [0, 0, 0] });
  });

  it('grows without bound when demand exceeds capacity', () => {
    const result = simulateBacklog({
      initialBacklog: 0,
      lambdaLivePerMinute: 3,
      appArrivalsPerMinute: [0, 0, 0],
      muPerMinute: 1,
    });
    expect(result.trajectory).toEqual([2, 4, 6]);
    expect(result.backlog).toBe(6);
  });

  it('absorbs and drains a burst of app orders', () => {
    const result = simulateBacklog({
      initialBacklog: 0,
      lambdaLivePerMinute: 0.5,
      appArrivalsPerMinute: [0, 5, 0, 0],
      muPerMinute: 1,
    });
    expect(result.trajectory).toEqual([0, 4.5, 4, 3.5]);
  });

  it('keeps the initial backlog when there are no minutes to step', () => {
    const result = simulateBacklog({
      initialBacklog: 2,
      lambdaLivePerMinute: 1,
      appArrivalsPerMinute: [],
      muPerMinute: 1,
    });
    expect(result).toEqual({ backlog: 2, trajectory: [] });
  });

  it('divides the backlog by throughput for the queue delay', () => {
    expect(queueDelayMinutes(3, 1.5)).toBe(2);
    expect(queueDelayMinutes(0, 1.5)).toBe(0);
  });
});
