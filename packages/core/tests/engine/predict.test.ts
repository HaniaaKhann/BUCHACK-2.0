import { describe, expect, it } from 'vitest';
import { MODEL_VERSION } from '../../src/config.js';
import { predictWait } from '../../src/engine/predict.js';

const residuals = Array.from({ length: 21 }, (_, index) => index - 10);

describe('predictWait', () => {
  it('blends queue delay, prep and weighted bias into point and range', () => {
    const result = predictWait({
      backlog: 3,
      muPerMinute: 1.5,
      prep: 5,
      bias: 2,
      biasSamples: 30,
      residuals,
    });
    expect(result).toEqual({
      queueDelayMinutes: 2,
      prepMinutes: 5,
      baseMinutes: 7,
      pointMinutes: 8,
      lowMinutes: 5,
      highMinutes: 16,
      modelVersion: MODEL_VERSION,
    });
  });

  it('floors the point at prep with a strong negative bias', () => {
    const result = predictWait({
      backlog: 0,
      muPerMinute: 1,
      prep: 5,
      bias: -20,
      biasSamples: 300,
      residuals,
    });
    expect(result.pointMinutes).toBe(5);
    expect(result.lowMinutes).toBeLessThanOrEqual(result.pointMinutes);
    expect(result.pointMinutes).toBeLessThanOrEqual(result.highMinutes);
  });

  it('keeps low <= point <= high across backlog, bias and residual combinations', () => {
    const residualSets = [[], residuals, residuals.map((value) => value - 15)];
    for (const backlog of [0, 1, 6]) {
      for (const bias of [-30, -3, 0, 3, 30]) {
        for (const biasSamples of [0, 10, 500]) {
          for (const set of residualSets) {
            const result = predictWait({
              backlog,
              muPerMinute: 1.5,
              prep: 5,
              bias,
              biasSamples,
              residuals: set,
            });
            expect(result.lowMinutes).toBeLessThanOrEqual(result.pointMinutes);
            expect(result.pointMinutes).toBeLessThanOrEqual(result.highMinutes);
          }
        }
      }
    }
  });

  it('ignores bias with no labelled orders and uses the cold start range', () => {
    const result = predictWait({
      backlog: 0,
      muPerMinute: 1,
      prep: 5,
      bias: 4,
      biasSamples: 0,
      residuals: [],
    });
    expect(result.pointMinutes).toBe(5);
    expect(result.lowMinutes).toBe(5);
    expect(result.highMinutes).toBeCloseTo(6.5, 10);
  });
});
