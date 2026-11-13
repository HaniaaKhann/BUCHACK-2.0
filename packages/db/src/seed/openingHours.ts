import type { HourRange, OutletSeed } from './schemas.js';

export type OpeningHours = {
  mon: HourRange[];
  tue: HourRange[];
  wed: HourRange[];
  thu: HourRange[];
  fri: HourRange[];
  sat: HourRange[];
  sun: HourRange[];
  publicHoliday: HourRange[];
};

export function expandOpeningHours(hours: OutletSeed['hours']): OpeningHours {
  return {
    mon: hours.monFri,
    tue: hours.monFri,
    wed: hours.monFri,
    thu: hours.monFri,
    fri: hours.monFri,
    sat: hours.sat,
    sun: hours.sun,
    publicHoliday: hours.publicHoliday,
  };
}
