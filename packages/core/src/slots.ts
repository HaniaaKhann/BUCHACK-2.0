import { MS_PER_MINUTE, SLOT_CAP_FRACTION, SLOT_MINUTES } from './config.js';
import type { OpenRange } from './engine/busyMinutes.js';

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

export interface SlotGridInput {
  ranges: readonly OpenRange[];
  from: number;
  horizonSlots: number;
  cap: number;
  bookedBySlotStart: ReadonlyMap<number, number>;
}

export function slotGrid(input: SlotGridInput): PickupSlot[] {
  const slotMs = SLOT_MINUTES * MS_PER_MINUTE;
  const first = Math.ceil(input.from / slotMs) * slotMs;
  const slots: PickupSlot[] = [];
  for (let index = 0; index < input.horizonSlots; index += 1) {
    const slotStart = first + index * slotMs;
    const open = input.ranges.some(
      (range) => range.openAt <= slotStart && slotStart + slotMs <= range.closeAt,
    );
    if (open) {
      slots.push({
        slotStart,
        cap: input.cap,
        booked: input.bookedBySlotStart.get(slotStart) ?? 0,
      });
    }
  }
  return slots;
}
