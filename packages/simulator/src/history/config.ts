export type SimWeekType = 'teaching' | 'reading' | 'exam' | 'holiday';

export const HISTORY_SEED = 20261005;
export const HISTORY_START_DATE = '2026-10-05';
export const HKT_OFFSET_MINUTES = 8 * 60;

export const WEEK_LAYOUT: readonly SimWeekType[] = [
  'teaching',
  'teaching',
  'holiday',
  'teaching',
  'exam',
  'teaching',
];
export const TRAIN_WEEKS = 4;

export const FOCUS_OUTLETS: readonly string[] = [
  'Main Canteen',
  'Harmony Cafeteria',
  'Harmony Lounge',
  'iCafe',
  'Bistro NTT',
  'Deli',
];

export interface OutletProfile {
  baseRatePerMinute: number;
  staff: number;
}

export const FOCUS_PROFILES: Readonly<Record<string, OutletProfile>> = {
  'Main Canteen': { baseRatePerMinute: 1.0, staff: 10 },
  'Harmony Cafeteria': { baseRatePerMinute: 0.8, staff: 7 },
  'Harmony Lounge': { baseRatePerMinute: 0.45, staff: 3 },
  iCafe: { baseRatePerMinute: 0.45, staff: 3 },
  'Bistro NTT': { baseRatePerMinute: 0.3, staff: 5 },
  Deli: { baseRatePerMinute: 0.5, staff: 3 },
};
export const LIGHT_PROFILE: OutletProfile = { baseRatePerMinute: 0.15, staff: 2 };

export const WEEK_TYPE_DEMAND: Readonly<Record<SimWeekType, number>> = {
  teaching: 1,
  reading: 0.7,
  exam: 0.7,
  holiday: 0.35,
};
export const SATURDAY_DEMAND = 0.45;
export const SUNDAY_DEMAND = 0.3;
export const DAY_EFFECT_SIGMA = 0.15;

export const DEMAND_FLOOR = 0.15;
export const MEAL_PEAKS: readonly { centreMinute: number; widthMinutes: number; height: number }[] =
  [
    { centreMinute: 8 * 60 + 45, widthMinutes: 40, height: 0.3 },
    { centreMinute: 12 * 60 + 50, widthMinutes: 45, height: 1 },
    { centreMinute: 18 * 60 + 30, widthMinutes: 50, height: 0.5 },
  ];
export const CLASS_END_MINUTE_OF_HOUR = 20;
export const CLASS_END_FIRST_HOUR = 9;
export const CLASS_END_LAST_HOUR = 18;
export const CLASS_BREAK_SPIKE_HEIGHT = 0.8;
export const CLASS_BREAK_SPIKE_DECAY_MINUTES = 5;
export const CLASS_BREAK_SPIKE_LENGTH_MINUTES = 15;
export const LAST_ORDER_BEFORE_CLOSE_MINUTES = 15;

export const APP_ORDER_SHARE = 0.15;
export const HIDDEN_WALK_IN_SHARE = 0.15;

export const ITEM_COUNT_WEIGHTS: readonly number[] = [0.6, 0.3, 0.1];
export const ITEM_TRUTH_SIGMA = 0.25;
export const SERVICE_SIGMA = 0.35;
export const EXTRA_ITEM_SERVICE_SHARE = 0.25;
export const STALL_PROBABILITY = 0.02;
export const STALL_MEAN_MINUTES = 5;
export const STAFF_DAY_CHANGE_PROBABILITY = 0.2;

export const TAP_FORGET_PROBABILITY = 0.1;
export const TAP_LAG_MEAN_MINUTES = 1;
export const BATCH_START_PROBABILITY = 0.15;
export const BATCH_JOIN_WINDOW_MINUTES = 4;
export const BATCH_TAP_GAP_SECONDS = 3;
export const PICKUP_LAG_MEDIAN_MINUTES = 3;
export const PICKUP_LAG_SIGMA = 0.6;

export const STUDENT_COUNT = 220;
export const STUDENT_WINDOWS = { min: 3, max: 6 } as const;
export const STUDENT_WINDOW_LENGTHS_MINUTES: readonly number[] = [40, 70, 100, 130, 160];
