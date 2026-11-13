import { HISTORY_START_DATE, WEEK_LAYOUT } from '../src/history/config.js';
import type { HistoryInput, OutletInput } from '../src/history/generate.js';

const weekdayHours = [{ open: '08:00', close: '20:00' }];

export const DELI: OutletInput = {
  name: 'Deli',
  campus: 'BURC',
  hours: { monFri: weekdayHours, sat: [], sun: [], publicHoliday: [] },
  pickupEnabled: true,
  status: 'open',
  items: [
    { name: 'Siu mai', prepPriorMin: 3 },
    { name: 'Curry fishball', prepPriorMin: 2 },
    { name: 'Egg sandwich', prepPriorMin: 4 },
    { name: 'Milk tea', prepPriorMin: 1 },
  ],
};

export const SMALL_CAFE: OutletInput = {
  name: 'Small Cafe',
  campus: 'BURC',
  hours: { monFri: weekdayHours, sat: weekdayHours, sun: [], publicHoliday: [] },
  pickupEnabled: true,
  status: 'open',
  items: [
    { name: 'Latte', prepPriorMin: 2 },
    { name: 'Croissant', prepPriorMin: 1 },
  ],
};

export const CLOSED_OUTLET: OutletInput = {
  name: 'Closed Outlet',
  campus: 'BURC',
  hours: { monFri: [], sat: [], sun: [], publicHoliday: [] },
  pickupEnabled: false,
  status: 'closed_for_renovation',
  items: [],
};

export function smallInput(seed = 7): HistoryInput {
  return {
    seed,
    startDate: HISTORY_START_DATE,
    weekLayout: WEEK_LAYOUT,
    publicHolidays: [{ from: '2026-10-19', to: '2026-10-19' }],
    outlets: [DELI, SMALL_CAFE, CLOSED_OUTLET],
    campuses: [{ campus: 'BURC', buildingNames: ['Building A', 'Building B', 'Building C'] }],
  };
}
