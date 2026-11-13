import {
  FREE_WINDOW_MIN_GAP_MINUTES,
  MS_PER_MINUTE,
  SCHEDULE_DAY_END_MINUTE,
  SCHEDULE_DAY_START_MINUTE,
} from './config.js';
import { hktDate, hktMidnight, hktMinuteOfDay, hktWeekday } from './time.js';

export interface FreeWindowInput {
  weekday: number;
  startMinute: number;
  endMinute: number;
  prevBuildingId: string | null;
  nextBuildingId: string | null;
}

export interface ScheduleContext {
  freeNow: boolean;
  classEnd: number | null;
  classBuildingId: string | null;
  nextClass: { start: number; buildingId: string | null } | null;
}

export function scheduleContext(windows: readonly FreeWindowInput[], now: number): ScheduleContext {
  const midnight = hktMidnight(hktDate(now));
  const minute = hktMinuteOfDay(now);
  const today = windows
    .filter((window) => window.weekday === hktWeekday(now))
    .sort((a, b) => a.startMinute - b.startMinute);

  const nextClassAfter = (window: FreeWindowInput): ScheduleContext['nextClass'] =>
    window.nextBuildingId === null
      ? null
      : { start: midnight + window.endMinute * MS_PER_MINUTE, buildingId: window.nextBuildingId };

  const current = today.find((window) => minute >= window.startMinute && minute < window.endMinute);
  if (current) {
    return {
      freeNow: true,
      classEnd: null,
      classBuildingId: null,
      nextClass: nextClassAfter(current),
    };
  }

  const upcoming = today.find((window) => window.startMinute > minute);
  if (upcoming && upcoming.prevBuildingId === null) {
    return {
      freeNow: true,
      classEnd: null,
      classBuildingId: null,
      nextClass: nextClassAfter(upcoming),
    };
  }
  if (upcoming) {
    return {
      freeNow: false,
      classEnd: midnight + upcoming.startMinute * MS_PER_MINUTE,
      classBuildingId: upcoming.prevBuildingId,
      nextClass: nextClassAfter(upcoming),
    };
  }
  return { freeNow: true, classEnd: null, classBuildingId: null, nextClass: null };
}

export interface ClassEntry {
  weekday: number;
  startMinute: number;
  endMinute: number;
  buildingId: string;
}

interface ClassBlock {
  startMinute: number;
  endMinute: number;
  firstBuildingId: string;
  lastBuildingId: string;
}

function blocksForDay(entries: readonly ClassEntry[]): ClassBlock[] {
  const sorted = [...entries].sort((a, b) => a.startMinute - b.startMinute);
  const blocks: ClassBlock[] = [];
  for (const entry of sorted) {
    const last = blocks[blocks.length - 1];
    if (last && entry.startMinute - last.endMinute < FREE_WINDOW_MIN_GAP_MINUTES) {
      if (entry.endMinute >= last.endMinute) {
        last.endMinute = entry.endMinute;
        last.lastBuildingId = entry.buildingId;
      }
      continue;
    }
    blocks.push({
      startMinute: entry.startMinute,
      endMinute: entry.endMinute,
      firstBuildingId: entry.buildingId,
      lastBuildingId: entry.buildingId,
    });
  }
  return blocks;
}

export function freeWindowsFromClasses(classes: readonly ClassEntry[]): FreeWindowInput[] {
  const windows: FreeWindowInput[] = [];
  for (let weekday = 0; weekday <= 6; weekday += 1) {
    const blocks = blocksForDay(classes.filter((entry) => entry.weekday === weekday));
    let previous: ClassBlock | null = null;
    for (const block of blocks) {
      const start: number = previous === null ? SCHEDULE_DAY_START_MINUTE : previous.endMinute;
      if (block.startMinute - start >= FREE_WINDOW_MIN_GAP_MINUTES) {
        windows.push({
          weekday,
          startMinute: start,
          endMinute: block.startMinute,
          prevBuildingId: previous?.lastBuildingId ?? null,
          nextBuildingId: block.firstBuildingId,
        });
      }
      previous = block;
    }
    if (previous && SCHEDULE_DAY_END_MINUTE - previous.endMinute >= FREE_WINDOW_MIN_GAP_MINUTES) {
      windows.push({
        weekday,
        startMinute: previous.endMinute,
        endMinute: SCHEDULE_DAY_END_MINUTE,
        prevBuildingId: previous.lastBuildingId,
        nextBuildingId: null,
      });
    }
  }
  return windows;
}
