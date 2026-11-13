import { describe, expect, it } from 'vitest';
import { arriveAt, deadlineFor, evaluateFit, type FitInput } from '../src/fit.js';

const MINUTE = 60_000;
const at = (minutes: number): number => minutes * MINUTE;

function freeNowAsap(nextClassStart: number | null, overrides: Partial<FitInput> = {}): FitInput {
  return {
    now: at(0),
    choice: { kind: 'asap', predMinutes: 8, readyHighMinutes: 12 },
    classEnd: null,
    walkToVendorMinutes: 4,
    nextClass:
      nextClassStart === null ? null : { start: at(nextClassStart), walkFromVendorMinutes: 5 },
    eatMinutes: 15,
    ...overrides,
  };
}

describe('arriveAt and deadlineFor', () => {
  it('adds the walk to now when free, or to the class end when in class', () => {
    expect(arriveAt(at(0), null, 4)).toBe(at(4));
    expect(arriveAt(at(0), at(30), 4)).toBe(at(34));
  });

  it('subtracts walk and eating time from the next class start', () => {
    expect(deadlineFor({ start: at(60), walkFromVendorMinutes: 5 }, 15)).toBe(at(40));
    expect(deadlineFor(null, 15)).toBeNull();
  });
});

describe('evaluateFit', () => {
  it('fits for ASAP when free now and pickup plus buffer is before the deadline', () => {
    const result = evaluateFit(freeNowAsap(60));
    expect(result.status).toBe('fits');
    expect(result.arriveAt).toBe(at(4));
    expect(result.readyPointAt).toBe(at(8));
    expect(result.readyHighAt).toBe(at(12));
    expect(result.pickupAt).toBe(at(12));
    expect(result.deadline).toBe(at(40));
    expect(result.lateByMinutes).toBe(0);
  });

  it('is tight when only the buffer is missed', () => {
    expect(evaluateFit(freeNowAsap(33)).status).toBe('tight');
  });

  it('fits when pickup plus buffer lands exactly on the deadline', () => {
    expect(evaluateFit(freeNowAsap(36)).status).toBe('fits');
  });

  it('is tight when the point estimate meets the deadline exactly but the high end does not', () => {
    expect(evaluateFit(freeNowAsap(28)).status).toBe('tight');
  });

  it('is late with the minutes over the deadline using the high end', () => {
    const result = evaluateFit(freeNowAsap(27));
    expect(result.status).toBe('late');
    expect(result.lateByMinutes).toBe(5);
  });

  it('uses the class end plus walk as arrival when in class', () => {
    const result = evaluateFit(freeNowAsap(90, { classEnd: at(30) }));
    expect(result.arriveAt).toBe(at(34));
    expect(result.pickupAt).toBe(at(34));
    expect(result.status).toBe('fits');
  });

  it('lets a long walk dominate the pickup time', () => {
    const result = evaluateFit(freeNowAsap(60, { walkToVendorMinutes: 20 }));
    expect(result.pickupAt).toBe(at(20));
  });

  it('fits a scheduled order whose slot plus q90 lateness is before the deadline', () => {
    const result = evaluateFit(
      freeNowAsap(60, {
        choice: {
          kind: 'scheduled',
          slotStart: at(20),
          latenessQ50Minutes: 0,
          latenessQ90Minutes: 3,
        },
      }),
    );
    expect(result.status).toBe('fits');
    expect(result.readyPointAt).toBe(at(20));
    expect(result.readyHighAt).toBe(at(23));
  });

  it('is tight for a scheduled order when only the q90 lateness crosses the deadline', () => {
    const result = evaluateFit(
      freeNowAsap(60, {
        choice: {
          kind: 'scheduled',
          slotStart: at(38),
          latenessQ50Minutes: 0,
          latenessQ90Minutes: 3,
        },
      }),
    );
    expect(result.status).toBe('tight');
  });

  it('is late for a scheduled order whose slot starts after the deadline', () => {
    const result = evaluateFit(
      freeNowAsap(60, {
        choice: {
          kind: 'scheduled',
          slotStart: at(45),
          latenessQ50Minutes: 0,
          latenessQ90Minutes: 3,
        },
      }),
    );
    expect(result.status).toBe('late');
    expect(result.lateByMinutes).toBe(8);
  });

  it('fits when there is no next class', () => {
    const result = evaluateFit(freeNowAsap(null));
    expect(result.status).toBe('fits');
    expect(result.deadline).toBeNull();
  });
});
