import type { SimDay } from './calendar.js';
import {
  CLASS_BREAK_SPIKE_DECAY_MINUTES,
  CLASS_BREAK_SPIKE_HEIGHT,
  CLASS_BREAK_SPIKE_LENGTH_MINUTES,
  CLASS_END_FIRST_HOUR,
  CLASS_END_LAST_HOUR,
  CLASS_END_MINUTE_OF_HOUR,
  DEMAND_FLOOR,
  MEAL_PEAKS,
  SATURDAY_DEMAND,
  SUNDAY_DEMAND,
  WEEK_TYPE_DEMAND,
} from './config.js';

export function mealProfile(minute: number): number {
  return MEAL_PEAKS.reduce((sum, peak) => {
    const distance = (minute - peak.centreMinute) / peak.widthMinutes;
    return sum + peak.height * Math.exp(-0.5 * distance * distance);
  }, DEMAND_FLOOR);
}

export function hasClassBreaks(day: SimDay): boolean {
  return (
    day.weekType === 'teaching' && !day.isPublicHoliday && day.weekday >= 1 && day.weekday <= 5
  );
}

export function classBreakSpike(minute: number): number {
  const hour = Math.floor(minute / 60);
  if (hour < CLASS_END_FIRST_HOUR || hour > CLASS_END_LAST_HOUR) return 0;
  const sinceBreak = minute - (hour * 60 + CLASS_END_MINUTE_OF_HOUR);
  if (sinceBreak < 0 || sinceBreak >= CLASS_BREAK_SPIKE_LENGTH_MINUTES) return 0;
  return CLASS_BREAK_SPIKE_HEIGHT * Math.exp(-sinceBreak / CLASS_BREAK_SPIKE_DECAY_MINUTES);
}

export function dayDemandFactor(day: SimDay): number {
  const weekdayFactor = day.weekday === 0 ? SUNDAY_DEMAND : day.weekday === 6 ? SATURDAY_DEMAND : 1;
  const holidayFactor = day.isPublicHoliday ? WEEK_TYPE_DEMAND.holiday : 1;
  return WEEK_TYPE_DEMAND[day.weekType] * weekdayFactor * holidayFactor;
}

export interface ArrivalRateInput {
  baseRatePerMinute: number;
  day: SimDay;
  dayEffect: number;
  minute: number;
}

export function arrivalRatePerMinute(input: ArrivalRateInput): number {
  const spike = hasClassBreaks(input.day) ? classBreakSpike(input.minute) : 0;
  return (
    input.baseRatePerMinute *
    dayDemandFactor(input.day) *
    input.dayEffect *
    (mealProfile(input.minute) + spike)
  );
}
