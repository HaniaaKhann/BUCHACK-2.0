import { describe, expect, it } from 'vitest';
import { nextClockAnchor, type ClockCommand } from '../src/clockControl.js';
import type { ClockRow } from '../src/time.js';

const T0 = Date.UTC(2026, 10, 17, 4, 15);
const REAL = Date.UTC(2026, 10, 14, 9, 0);

const row = (overrides: Partial<ClockRow> = {}): ClockRow => ({
  mode: 'demo',
  currentTime: new Date(T0),
  speed: 60,
  updatedAt: new Date(REAL - 10_000),
  ...overrides,
});

const run = (command: ClockCommand, clock: ClockRow = row()) =>
  nextClockAnchor(clock, REAL, command);

describe('nextClockAnchor', () => {
  it('keeps the live time when the speed changes, so the clock does not jump', () => {
    expect(run({ kind: 'speed', speed: 0 })).toEqual({
      currentTimeMs: T0 + 10_000 * 60,
      speed: 0,
    });
    expect(run({ kind: 'speed', speed: 10 }).currentTimeMs).toBe(T0 + 600_000);
  });

  it('jumps forward from the live time and keeps the speed', () => {
    expect(run({ kind: 'jump', minutes: 60 })).toEqual({
      currentTimeMs: T0 + 600_000 + 3_600_000,
      speed: 60,
    });
    expect(run({ kind: 'jump', minutes: 15 }, row({ speed: 0 }))).toEqual({
      currentTimeMs: T0 + 900_000,
      speed: 0,
    });
  });

  it('sets an exact time and keeps the speed', () => {
    const target = Date.UTC(2026, 10, 18, 1, 0);
    expect(run({ kind: 'set', timeMs: target })).toEqual({ currentTimeMs: target, speed: 60 });
  });

  it('returns to the start time at speed 0', () => {
    expect(run({ kind: 'start', startMs: T0 })).toEqual({ currentTimeMs: T0, speed: 0 });
  });

  it('starts from the real time when the clock was in real mode', () => {
    const real = row({ mode: 'real', speed: 1 });
    expect(run({ kind: 'jump', minutes: 15 }, real)).toEqual({
      currentTimeMs: REAL + 900_000,
      speed: 1,
    });
  });
});
