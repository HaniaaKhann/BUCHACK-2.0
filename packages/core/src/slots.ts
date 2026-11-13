import { MS_PER_MINUTE, SLOT_CAP_FRACTION, SLOT_MINUTES } from './config.js';

export interface PickupSlot {
  slotStart: number;
  cap: number;
  booked: number;
}

export function defaultSlotCap(muPerMinute: number): number {
  return Math.max(1, Math.floor(SLOT_CAP_FRACTION * muPerMinute * SLOT_MINUTES));
}

export function isSlotFull(slot: PickupSlot): boolean {
  return slot.booked >= slot.cap;
}

export function nextFreeSlot(slots: readonly PickupSlot[], atOrAfter: number): PickupSlot | null {
  const candidates = slots
    .filter((slot) => slot.slotStart >= atOrAfter && !isSlotFull(slot))
    .sort((a, b) => a.slotStart - b.slotStart);
  return candidates[0] ?? null;
}

export interface FireAtInput {
  slotStart: number;
  forecastQueueDelayMinutes: number;
  prepMinutes: number;
}

export function fireAt(input: FireAtInput): number {
  return input.slotStart - (input.forecastQueueDelayMinutes + input.prepMinutes) * MS_PER_MINUTE;
}
