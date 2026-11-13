import { BUFFER_MINUTES, MS_PER_MINUTE } from './config.js';

export type FitStatus = 'fits' | 'tight' | 'late';

export type PickupChoice =
  | { kind: 'asap'; predMinutes: number; readyHighMinutes: number }
  | {
      kind: 'scheduled';
      slotStart: number;
      latenessQ50Minutes: number;
      latenessQ90Minutes: number;
    };

export interface NextClass {
  start: number;
  walkFromVendorMinutes: number;
}

export interface FitInput {
  now: number;
  choice: PickupChoice;
  classEnd: number | null;
  walkToVendorMinutes: number;
  nextClass: NextClass | null;
  eatMinutes: number;
}

export interface FitResult {
  status: FitStatus;
  arriveAt: number;
  readyPointAt: number;
  readyHighAt: number;
  pickupAt: number;
  deadline: number | null;
  lateByMinutes: number;
}

export function arriveAt(
  now: number,
  classEnd: number | null,
  walkToVendorMinutes: number,
): number {
  return (classEnd ?? now) + walkToVendorMinutes * MS_PER_MINUTE;
}

export function readyTimes(
  now: number,
  choice: PickupChoice,
): { readyPointAt: number; readyHighAt: number } {
  if (choice.kind === 'asap') {
    return {
      readyPointAt: now + choice.predMinutes * MS_PER_MINUTE,
      readyHighAt: now + choice.readyHighMinutes * MS_PER_MINUTE,
    };
  }
  return {
    readyPointAt: choice.slotStart + choice.latenessQ50Minutes * MS_PER_MINUTE,
    readyHighAt: choice.slotStart + choice.latenessQ90Minutes * MS_PER_MINUTE,
  };
}

export function deadlineFor(nextClass: NextClass | null, eatMinutes: number): number | null {
  if (nextClass === null) return null;
  return nextClass.start - (nextClass.walkFromVendorMinutes + eatMinutes) * MS_PER_MINUTE;
}

export function evaluateFit(input: FitInput): FitResult {
  const arrive = arriveAt(input.now, input.classEnd, input.walkToVendorMinutes);
  const { readyPointAt, readyHighAt } = readyTimes(input.now, input.choice);
  const pickupAt = Math.max(readyHighAt, arrive);
  const deadline = deadlineFor(input.nextClass, input.eatMinutes);

  const base = { arriveAt: arrive, readyPointAt, readyHighAt, pickupAt, deadline };
  if (deadline === null) return { ...base, status: 'fits', lateByMinutes: 0 };

  if (pickupAt + BUFFER_MINUTES * MS_PER_MINUTE <= deadline) {
    return { ...base, status: 'fits', lateByMinutes: 0 };
  }
  if (Math.max(readyPointAt, arrive) <= deadline) {
    return { ...base, status: 'tight', lateByMinutes: 0 };
  }
  return { ...base, status: 'late', lateByMinutes: (pickupAt - deadline) / MS_PER_MINUTE };
}
