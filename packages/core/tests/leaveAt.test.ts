import { describe, expect, it } from 'vitest';
import { isLeaveNow, leaveAt, suggestCookedForArrival } from '../src/leaveAt.js';
import type { PickupSlot } from '../src/slots.js';

const MINUTE = 60_000;
const at = (minutes: number): number => minutes * MINUTE;

function slot(startMinute: number, booked: number): PickupSlot {
  return { slotStart: at(startMinute), cap: 3, booked };
}

describe('leaveAt', () => {
  it('is the ready point minus the walk', () => {
    expect(leaveAt({ now: at(0), readyPointAt: at(20), walkToVendorMinutes: 4 })).toBe(at(16));
  });

  it('is now when the walk is longer than the wait', () => {
    const result = leaveAt({ now: at(0), readyPointAt: at(20), walkToVendorMinutes: 25 });
    expect(result).toBe(at(0));
    expect(isLeaveNow(result, at(0))).toBe(true);
  });

  it('is not leave-now when it is in the future', () => {
    expect(isLeaveNow(at(16), at(0))).toBe(false);
  });
});

describe('suggestCookedForArrival', () => {
  const slots = [slot(30, 0), slot(45, 0), slot(60, 0)];

  it('suggests the first free slot at or after class end plus walk', () => {
    const result = suggestCookedForArrival({
      leaveAt: at(16),
      currentClassEnd: at(30),
      walkClassToVendorMinutes: 4,
      slots,
    });
    expect(result).toEqual(slot(45, 0));
  });

  it('skips full slots', () => {
    const result = suggestCookedForArrival({
      leaveAt: at(16),
      currentClassEnd: at(30),
      walkClassToVendorMinutes: 4,
      slots: [slot(30, 0), slot(45, 3), slot(60, 0)],
    });
    expect(result).toEqual(slot(60, 0));
  });

  it('accepts a slot starting exactly at class end plus walk', () => {
    const result = suggestCookedForArrival({
      leaveAt: at(16),
      currentClassEnd: at(41),
      walkClassToVendorMinutes: 4,
      slots,
    });
    expect(result).toEqual(slot(45, 0));
  });

  it('returns null when leave-at is after the current class ends', () => {
    const result = suggestCookedForArrival({
      leaveAt: at(35),
      currentClassEnd: at(30),
      walkClassToVendorMinutes: 4,
      slots,
    });
    expect(result).toBeNull();
  });

  it('returns null when the student is free now', () => {
    const result = suggestCookedForArrival({
      leaveAt: at(16),
      currentClassEnd: null,
      walkClassToVendorMinutes: 4,
      slots,
    });
    expect(result).toBeNull();
  });

  it('returns null when no slot is free', () => {
    const result = suggestCookedForArrival({
      leaveAt: at(16),
      currentClassEnd: at(30),
      walkClassToVendorMinutes: 4,
      slots: [slot(45, 3)],
    });
    expect(result).toBeNull();
  });
});
