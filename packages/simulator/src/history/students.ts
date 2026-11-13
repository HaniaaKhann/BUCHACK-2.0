import type { Rng } from '../rng.js';
import {
  CLASS_END_FIRST_HOUR,
  CLASS_END_LAST_HOUR,
  CLASS_END_MINUTE_OF_HOUR,
  STUDENT_COUNT,
  STUDENT_WINDOW_LENGTHS_MINUTES,
  STUDENT_WINDOWS,
} from './config.js';

export interface SimFreeWindow {
  weekday: number;
  startMinute: number;
  endMinute: number;
  prevBuildingName: string;
  nextBuildingName: string;
}

export interface SimStudent {
  key: string;
  campus: string;
  freeWindows: SimFreeWindow[];
}

export interface CampusBuildings {
  campus: string;
  buildingNames: readonly string[];
}

function overlaps(a: SimFreeWindow, b: SimFreeWindow): boolean {
  return a.weekday === b.weekday && a.startMinute < b.endMinute && b.startMinute < a.endMinute;
}

function drawWindow(rng: Rng, buildingNames: readonly string[]): SimFreeWindow {
  const startMinute =
    rng.int(CLASS_END_FIRST_HOUR, CLASS_END_LAST_HOUR - 1) * 60 + CLASS_END_MINUTE_OF_HOUR;
  return {
    weekday: rng.int(1, 5),
    startMinute,
    endMinute: startMinute + rng.pick(STUDENT_WINDOW_LENGTHS_MINUTES),
    prevBuildingName: rng.pick(buildingNames),
    nextBuildingName: rng.pick(buildingNames),
  };
}

export function generateStudents(campuses: readonly CampusBuildings[], rng: Rng): SimStudent[] {
  return Array.from({ length: STUDENT_COUNT }, (_, index) => {
    const campus = rng.pick(campuses);
    const target = rng.int(STUDENT_WINDOWS.min, STUDENT_WINDOWS.max);
    const freeWindows: SimFreeWindow[] = [];
    while (freeWindows.length < target) {
      const window = drawWindow(rng, campus.buildingNames);
      if (!freeWindows.some((existing) => overlaps(existing, window))) freeWindows.push(window);
    }
    freeWindows.sort((a, b) => a.weekday - b.weekday || a.startMinute - b.startMinute);
    return {
      key: `sim-student-${String(index + 1).padStart(3, '0')}`,
      campus: campus.campus,
      freeWindows,
    };
  });
}
