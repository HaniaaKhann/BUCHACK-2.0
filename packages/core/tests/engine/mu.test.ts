import { describe, expect, it } from 'vitest';
import { MU_FLOOR_PER_MINUTE } from '../../src/config.js';
import { blendMu, muPrior } from '../../src/engine/mu.js';

describe('muPrior', () => {
  it('prefers the vendor setting', () => {
    expect(muPrior({ vendorSetting: 1.5, slotTicketRatesPerMinute: [1, 2, 3] })).toBe(1.5);
  });

  it('falls back to the 90th percentile of slot ticket rates', () => {
    const rates = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    expect(muPrior({ vendorSetting: null, slotTicketRatesPerMinute: rates })).toBeCloseTo(9.1, 10);
  });
});

describe('blendMu', () => {
  it('returns the prior with no busy minutes observed', () => {
    expect(blendMu({ prior: 1, readyTapsPerBusyMinute: [] })).toBe(1);
  });

  it('moves halfway to the learned median at 30 busy minutes', () => {
    const taps = Array.from({ length: 30 }, () => 2);
    expect(blendMu({ prior: 1, readyTapsPerBusyMinute: taps })).toBeCloseTo(1.5, 10);
  });

  it('approaches the learned median with many busy minutes', () => {
    const taps = Array.from({ length: 3000 }, () => 2);
    expect(blendMu({ prior: 1, readyTapsPerBusyMinute: taps })).toBeCloseTo(1.99, 2);
  });

  it('never drops below the floor', () => {
    expect(blendMu({ prior: 0, readyTapsPerBusyMinute: [] })).toBe(MU_FLOOR_PER_MINUTE);
  });
});
