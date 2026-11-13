import { describe, expect, it } from 'vitest';
import { MU_FLOOR_PER_MINUTE } from '../src/config.js';
import { defaultSlotCap, fireAt, isSlotFull, nextFreeSlot, type PickupSlot } from '../src/slots.js';

const MINUTE = 60_000;

function slot(startMinute: number, cap: number, booked: number): PickupSlot {
  return { slotStart: startMinute * MINUTE, cap, booked };
}

describe('defaultSlotCap', () => {
  it('is floor(0.5 * mu * 15)', () => {
    expect(defaultSlotCap(1)).toBe(7);
    expect(defaultSlotCap(2)).toBe(15);
  });

  it('is at least 1 for a low-capacity vendor', () => {
    expect(defaultSlotCap(0.1)).toBe(1);
    expect(defaultSlotCap(MU_FLOOR_PER_MINUTE)).toBe(1);
    expect(defaultSlotCap(0)).toBe(1);
  });
});

describe('isSlotFull', () => {
  it('is full when booked reaches the cap', () => {
    expect(isSlotFull(slot(0, 3, 2))).toBe(false);
    expect(isSlotFull(slot(0, 3, 3))).toBe(true);
    expect(isSlotFull(slot(0, 0, 0))).toBe(true);
  });
});

describe('nextFreeSlot', () => {
  it('returns the requested slot when it has room', () => {
    const slots = [slot(30, 3, 1), slot(45, 3, 0)];
    expect(nextFreeSlot(slots, 30 * MINUTE)).toEqual(slot(30, 3, 1));
  });

  it('offers the next free slot when the requested one is full', () => {
    const slots = [slot(30, 3, 3), slot(45, 3, 3), slot(60, 3, 2)];
    expect(nextFreeSlot(slots, 30 * MINUTE)).toEqual(slot(60, 3, 2));
  });

  it('ignores slots that start before the requested time and handles unsorted input', () => {
    const slots = [slot(60, 3, 0), slot(15, 3, 0), slot(45, 3, 0)];
    expect(nextFreeSlot(slots, 34 * MINUTE)).toEqual(slot(45, 3, 0));
  });

  it('returns null when nothing is free', () => {
    expect(nextFreeSlot([slot(30, 3, 3)], 0)).toBeNull();
    expect(nextFreeSlot([], 0)).toBeNull();
  });
});

describe('fireAt', () => {
  it('is slotStart minus forecast queue delay minus prep', () => {
    const result = fireAt({
      slotStart: 60 * MINUTE,
      forecastQueueDelayMinutes: 3,
      prepMinutes: 5,
    });
    expect(result).toBe(52 * MINUTE);
  });
});
