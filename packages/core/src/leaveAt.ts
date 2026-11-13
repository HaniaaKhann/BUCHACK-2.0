import { MS_PER_MINUTE } from './config.js';
import { nextFreeSlot, type PickupSlot } from './slots.js';

export interface LeaveAtInput {
  now: number;
  readyPointAt: number;
  walkToVendorMinutes: number;
}

export function leaveAt(input: LeaveAtInput): number {
  return Math.max(input.now, input.readyPointAt - input.walkToVendorMinutes * MS_PER_MINUTE);
}

export function isLeaveNow(leaveAtTime: number, now: number): boolean {
  return leaveAtTime <= now;
}

export interface CookedForArrivalInput {
  leaveAt: number;
  currentClassEnd: number | null;
  walkClassToVendorMinutes: number;
  slots: readonly PickupSlot[];
}

export function suggestCookedForArrival(input: CookedForArrivalInput): PickupSlot | null {
  if (input.currentClassEnd === null) return null;
  if (input.leaveAt >= input.currentClassEnd) return null;
  const earliestArrival = input.currentClassEnd + input.walkClassToVendorMinutes * MS_PER_MINUTE;
  return nextFreeSlot(input.slots, earliestArrival);
}
