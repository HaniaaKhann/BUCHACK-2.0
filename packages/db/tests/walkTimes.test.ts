import { describe, expect, it } from 'vitest';
import { walkTimeDefaultsSchema } from '../src/seed/schemas.js';
import { buildWalkTimeRows, estimateMinutes } from '../src/seed/walkTimes.js';

const defaults = walkTimeDefaultsSchema.parse({
  source: 'estimate',
  sameBuildingMinutes: 2,
  sameCampusMinutes: 5,
  betweenMainCampusesMinutes: 10,
  jc3Minutes: 15,
  jc3Campus: 'JC3',
});

const a = { id: 'a', campus: 'HSHC' };
const b = { id: 'b', campus: 'HSHC' };
const c = { id: 'c', campus: 'SHAW' };
const j = { id: 'j', campus: 'JC3' };

describe('estimateMinutes', () => {
  it('uses the same-building value for one building', () => {
    expect(estimateMinutes(a, a, defaults)).toBe(2);
  });

  it('uses the same-campus value for two buildings on one campus', () => {
    expect(estimateMinutes(a, b, defaults)).toBe(5);
  });

  it('uses the between-campus value across HSHC, SHAW and BURC', () => {
    expect(estimateMinutes(a, c, defaults)).toBe(10);
  });

  it('uses the JC3 value in either direction', () => {
    expect(estimateMinutes(a, j, defaults)).toBe(15);
    expect(estimateMinutes(j, c, defaults)).toBe(15);
  });
});

describe('buildWalkTimeRows', () => {
  const rows = buildWalkTimeRows([a, b, c], [{ id: 'v1', buildingId: 'a' }], defaults);

  it('creates one b2b row per ordered pair and one b2v row per building and vendor', () => {
    expect(rows.filter((r) => r.type === 'b2b')).toHaveLength(6);
    expect(rows.filter((r) => r.type === 'b2v')).toHaveLength(3);
  });

  it('marks every row as an estimate', () => {
    expect(rows.every((r) => r.source === 'estimate')).toBe(true);
  });

  it('gives a student standing in the vendor building the same-building time', () => {
    const row = rows.find((r) => r.type === 'b2v' && r.fromBuildingId === 'a');
    expect(row?.minutes).toBe(2);
  });
});
