import { MS_PER_MINUTE, SLOT_MINUTES } from '../config.js';

const SLOT_MS = SLOT_MINUTES * MS_PER_MINUTE;

export interface BusyOrder {
  placedAt: number;
  priorPrepMinutes: number;
  tapAt: number | null;
  pickedUpAt: number | null;
}

export interface OpenRange {
  openAt: number;
  closeAt: number;
}

export interface TicketSlot {
  slotStart: number;
  count: number;
}

export interface BusyMinuteInput {
  ranges: readonly OpenRange[];
  orders: readonly BusyOrder[];
  tickets: readonly TicketSlot[];
}

export function labelAvailableAt(order: BusyOrder): number {
  return order.tapAt ?? order.pickedUpAt ?? Number.POSITIVE_INFINITY;
}

function slotStartOf(ms: number): number {
  return Math.floor(ms / SLOT_MS) * SLOT_MS;
}

function isWaiting(order: BusyOrder, minuteStart: number): boolean {
  return (
    order.placedAt + order.priorPrepMinutes * MS_PER_MINUTE < minuteStart + MS_PER_MINUTE &&
    labelAvailableAt(order) > minuteStart
  );
}

function tappedInMinute(order: BusyOrder, minuteStart: number): boolean {
  return (
    order.tapAt !== null && order.tapAt >= minuteStart && order.tapAt < minuteStart + MS_PER_MINUTE
  );
}

export function busyMinuteRates(input: BusyMinuteInput): number[] {
  const ticketsBySlot = new Map(input.tickets.map((row) => [row.slotStart, row.count]));
  const rates: number[] = [];
  for (const range of input.ranges) {
    for (
      let slotStart = slotStartOf(range.openAt);
      slotStart < range.closeAt;
      slotStart += SLOT_MS
    ) {
      let busyMinutes = 0;
      let taps = 0;
      for (
        let minuteStart = slotStart;
        minuteStart < slotStart + SLOT_MS;
        minuteStart += MS_PER_MINUTE
      ) {
        if (!input.orders.some((order) => isWaiting(order, minuteStart))) continue;
        busyMinutes += 1;
        taps += input.orders.filter((order) => tappedInMinute(order, minuteStart)).length;
      }
      const apps = input.orders.filter((order) => slotStartOf(order.placedAt) === slotStart).length;
      if (busyMinutes === 0 || apps === 0) continue;
      const share = apps / (apps + (ticketsBySlot.get(slotStart) ?? 0));
      const rate = taps / busyMinutes / share;
      for (let n = 0; n < busyMinutes; n += 1) rates.push(rate);
    }
  }
  return rates;
}
