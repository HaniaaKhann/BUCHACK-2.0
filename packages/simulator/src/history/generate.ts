import { createRng, type Rng } from '../rng.js';
import {
  buildDays,
  minuteToMs,
  openMinutes,
  type DateRange,
  type OutletHours,
  type SimDay,
} from './calendar.js';
import {
  APP_ORDER_SHARE,
  DAY_EFFECT_SIGMA,
  FOCUS_OUTLETS,
  FOCUS_PROFILES,
  HIDDEN_WALK_IN_SHARE,
  ITEM_COUNT_WEIGHTS,
  ITEM_TRUTH_SIGMA,
  LAST_ORDER_BEFORE_CLOSE_MINUTES,
  LIGHT_PROFILE,
  SERVICE_SIGMA,
  STAFF_DAY_CHANGE_PROBABILITY,
  STALL_MEAN_MINUTES,
  STALL_PROBABILITY,
  type OutletProfile,
  type SimWeekType,
} from './config.js';
import { arrivalRatePerMinute } from './demand.js';
import { orderServiceMinutes, serveFifo } from './kitchen.js';
import { generateStudents, type CampusBuildings, type SimStudent } from './students.js';
import { pickupAt, staffTaps } from './taps.js';

const MS_PER_MINUTE = 60_000;
const TICKET_SLOT_MINUTES = 15;

export interface MenuItemInput {
  name: string;
  prepPriorMin: number;
}

export interface OutletInput {
  name: string;
  campus: string;
  hours: OutletHours;
  pickupEnabled: boolean;
  status: 'open' | 'closed_for_renovation';
  items: readonly MenuItemInput[];
}

export interface HistoryInput {
  seed: number;
  startDate: string;
  weekLayout: readonly SimWeekType[];
  publicHolidays: readonly DateRange[];
  outlets: readonly OutletInput[];
  campuses: readonly CampusBuildings[];
}

export type OrderChannel = 'app' | 'walk_in';

export interface SimOrder {
  id: string;
  vendorName: string;
  channel: OrderChannel;
  ticketed: boolean;
  studentKey: string | null;
  placedAt: number;
  items: MenuItemInput[];
  trueReadyAt: number;
  tapAt: number | null;
  pickedUpAt: number | null;
}

export interface TicketCountRow {
  vendorName: string;
  slotStart: string;
  count: number;
  source: 'sim';
}

export interface VendorHistory {
  name: string;
  isFocus: boolean;
  appEnabled: boolean;
  hours: OutletHours;
  items: readonly MenuItemInput[];
  orders: SimOrder[];
  tickets: TicketCountRow[];
}

export interface History {
  seed: number;
  startDate: string;
  weekLayout: readonly SimWeekType[];
  days: SimDay[];
  vendors: VendorHistory[];
  students: SimStudent[];
}

interface DraftOrder {
  channel: OrderChannel;
  ticketed: boolean;
  placedAt: number;
  items: MenuItemInput[];
  serviceMs: number;
}

function hashName(name: string): number {
  let hash = 2166136261;
  for (const char of name) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return hash >>> 0;
}

function profileFor(name: string): OutletProfile {
  return FOCUS_PROFILES[name] ?? LIGHT_PROFILE;
}

function drawItemCount(rng: Rng): number {
  const draw = rng.uniform();
  let cumulative = 0;
  for (const [index, weight] of ITEM_COUNT_WEIGHTS.entries()) {
    cumulative += weight;
    if (draw < cumulative) return index + 1;
  }
  return ITEM_COUNT_WEIGHTS.length;
}

function drawItems(rng: Rng, menu: readonly MenuItemInput[]): MenuItemInput[] {
  const count = Math.min(drawItemCount(rng), menu.length);
  const chosen = new Set<MenuItemInput>();
  while (chosen.size < count) chosen.add(rng.pick(menu));
  return [...chosen];
}

function drawStaff(rng: Rng, base: number): number {
  if (!rng.chance(STAFF_DAY_CHANGE_PROBABILITY)) return base;
  return Math.max(1, base + (rng.chance(0.5) ? -1 : 1));
}

interface DayContext {
  rng: Rng;
  outlet: OutletInput;
  profile: OutletProfile;
  truthFactor: ReadonlyMap<string, number>;
  appEnabled: boolean;
}

function draftOrder(ctx: DayContext, placedAt: number): DraftOrder {
  const { rng } = ctx;
  const channel: OrderChannel = ctx.appEnabled && rng.chance(APP_ORDER_SHARE) ? 'app' : 'walk_in';
  const items = drawItems(rng, ctx.outlet.items);
  const itemMinutes = items.map((item) =>
    rng.lognormal(item.prepPriorMin * (ctx.truthFactor.get(item.name) ?? 1), SERVICE_SIGMA),
  );
  const stall = rng.chance(STALL_PROBABILITY) ? rng.exponential(STALL_MEAN_MINUTES) : 0;
  return {
    channel,
    ticketed: channel === 'walk_in' && !rng.chance(HIDDEN_WALK_IN_SHARE),
    placedAt,
    items,
    serviceMs: (orderServiceMinutes(itemMinutes) + stall) * MS_PER_MINUTE,
  };
}

function draftDay(ctx: DayContext, day: SimDay): DraftOrder[] {
  const dayEffect = ctx.rng.lognormal(1, DAY_EFFECT_SIGMA);
  const drafts: DraftOrder[] = [];
  for (const range of openMinutes(ctx.outlet.hours, day)) {
    for (
      let minute = range.openMinute;
      minute < range.closeMinute - LAST_ORDER_BEFORE_CLOSE_MINUTES;
      minute += 1
    ) {
      const rate = arrivalRatePerMinute({
        baseRatePerMinute: ctx.profile.baseRatePerMinute,
        day,
        dayEffect,
        minute,
      });
      const arrivals = ctx.rng.poisson(rate);
      for (let n = 0; n < arrivals; n += 1) {
        const placedAt = minuteToMs(day, minute) + Math.floor(ctx.rng.uniform() * MS_PER_MINUTE);
        drafts.push(draftOrder(ctx, placedAt));
      }
    }
  }
  return drafts.sort((a, b) => a.placedAt - b.placedAt);
}

function ticketRows(
  vendorName: string,
  day: SimDay,
  hours: OutletHours,
  orders: readonly DraftOrder[],
): TicketCountRow[] {
  const rows: TicketCountRow[] = [];
  for (const range of openMinutes(hours, day)) {
    const first = Math.floor(range.openMinute / TICKET_SLOT_MINUTES) * TICKET_SLOT_MINUTES;
    for (let slot = first; slot < range.closeMinute; slot += TICKET_SLOT_MINUTES) {
      const start = minuteToMs(day, slot);
      const end = start + TICKET_SLOT_MINUTES * MS_PER_MINUTE;
      rows.push({
        vendorName,
        slotStart: new Date(start).toISOString(),
        count: orders.filter((o) => o.ticketed && o.placedAt >= start && o.placedAt < end).length,
        source: 'sim',
      });
    }
  }
  return rows;
}

function studentPool(students: readonly SimStudent[], campus: string): readonly SimStudent[] {
  const local = students.filter((student) => student.campus === campus);
  return local.length > 0 ? local : students;
}

interface VendorRun {
  outlet: OutletInput;
  days: readonly SimDay[];
  students: readonly SimStudent[];
  seed: number;
  nextId: () => string;
}

function simulateVendor(run: VendorRun): VendorHistory {
  const { outlet } = run;
  const rng = createRng(run.seed ^ hashName(outlet.name));
  const profile = profileFor(outlet.name);
  const truthFactor = new Map(
    outlet.items.map((item) => [item.name, rng.lognormal(1, ITEM_TRUTH_SIGMA)] as const),
  );
  const appEnabled = outlet.pickupEnabled && outlet.status === 'open';
  const ctx: DayContext = { rng, outlet, profile, truthFactor, appEnabled };
  const pool = studentPool(run.students, outlet.campus);

  const orders: SimOrder[] = [];
  const tickets: TicketCountRow[] = [];
  for (const day of run.days) {
    if (outlet.status !== 'open') continue;
    const drafts = draftDay(ctx, day);
    const readyTimes = serveFifo(
      drafts.map((d) => ({ arrivalMs: d.placedAt, serviceMs: d.serviceMs })),
      drawStaff(rng, profile.staff),
    );
    const dayOrders: SimOrder[] = drafts.map((draft, index) => ({
      id: run.nextId(),
      vendorName: outlet.name,
      channel: draft.channel,
      ticketed: draft.ticketed,
      studentKey: draft.channel === 'app' ? rng.pick(pool).key : null,
      placedAt: draft.placedAt,
      items: draft.items,
      trueReadyAt: readyTimes[index] ?? draft.placedAt,
      tapAt: null,
      pickedUpAt: null,
    }));
    const appByReady = dayOrders
      .filter((order) => order.channel === 'app')
      .sort((a, b) => a.trueReadyAt - b.trueReadyAt);
    const taps = staffTaps(
      appByReady.map((order) => order.trueReadyAt),
      rng,
    );
    appByReady.forEach((order, index) => {
      order.tapAt = taps[index] ?? null;
      order.pickedUpAt = pickupAt(order.trueReadyAt, rng);
    });
    orders.push(...dayOrders);
    tickets.push(...ticketRows(outlet.name, day, outlet.hours, drafts));
  }

  return {
    name: outlet.name,
    isFocus: FOCUS_OUTLETS.includes(outlet.name),
    appEnabled,
    hours: outlet.hours,
    items: outlet.items,
    orders,
    tickets,
  };
}

export function generateHistory(input: HistoryInput): History {
  const days = buildDays(input.startDate, input.weekLayout, input.publicHolidays);
  const students = generateStudents(input.campuses, createRng(input.seed));
  let counter = 0;
  const nextId = (): string => {
    counter += 1;
    return `sim-order-${String(counter).padStart(7, '0')}`;
  };
  const vendors = input.outlets.map((outlet) =>
    simulateVendor({ outlet, days, students, seed: input.seed, nextId }),
  );
  return {
    seed: input.seed,
    startDate: input.startDate,
    weekLayout: input.weekLayout,
    days,
    vendors,
    students,
  };
}
