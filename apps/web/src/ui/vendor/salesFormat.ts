import type { SalesStatus } from '@/server/salesService';

const HKT_OFFSET_MS = 8 * 3_600_000;
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

const two = (value: number): string => String(value).padStart(2, '0');

export function formatDayTime(ms: number): string {
  const date = new Date(ms + HKT_OFFSET_MS);
  return `${WEEKDAYS[date.getUTCDay()] ?? ''} ${date.getUTCDate()} ${MONTHS[date.getUTCMonth()] ?? ''} ${two(date.getUTCHours())}:${two(date.getUTCMinutes())}`;
}

export function formatHourLabel(hour: number): string {
  return `${two(hour)}:00`;
}

export const SALES_STATUS_LABELS: Record<SalesStatus, string> = {
  placed: 'Placed',
  accepted: 'Accepted',
  preparing: 'Preparing',
  ready: 'Ready',
  completed: 'Completed',
  picked_up: 'Completed',
  cancelled: 'Cancelled',
};

export function formatMoney(amount: number): string {
  return `HK$${Number.isInteger(amount) ? amount : amount.toFixed(1)}`;
}
