import { MS_PER_MINUTE } from './config.js';
import { clockNowMs, type ClockRow } from './time.js';

export const CLOCK_SPEEDS = [0, 1, 10, 60] as const;
export type ClockSpeed = (typeof CLOCK_SPEEDS)[number];

export const JUMP_MINUTES = [15, 60, 1440] as const;
export type JumpMinutes = (typeof JUMP_MINUTES)[number];

export type ClockCommand =
  | { kind: 'speed'; speed: ClockSpeed }
  | { kind: 'jump'; minutes: JumpMinutes }
  | { kind: 'set'; timeMs: number }
  | { kind: 'start'; startMs: number };

export interface ClockAnchor {
  currentTimeMs: number;
  speed: number;
}

export function nextClockAnchor(
  row: ClockRow,
  realNowMs: number,
  command: ClockCommand,
): ClockAnchor {
  const liveMs = clockNowMs(row, realNowMs);
  switch (command.kind) {
    case 'speed':
      return { currentTimeMs: liveMs, speed: command.speed };
    case 'jump':
      return { currentTimeMs: liveMs + command.minutes * MS_PER_MINUTE, speed: row.speed };
    case 'set':
      return { currentTimeMs: command.timeMs, speed: row.speed };
    case 'start':
      return { currentTimeMs: command.startMs, speed: 0 };
  }
}
