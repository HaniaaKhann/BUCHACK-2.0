import { DEMO_CLOCK_START, PrismaClient } from '@app/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { GET as getClock, PATCH as patchClock } from '../src/app/api/admin/clock/route';
import { asAccount, jsonInit, prepareSessions, type AccountKey } from './support/session';

const db = new PrismaClient();
let cookies = new Map<AccountKey, string>();
let original: { mode: 'real' | 'demo'; currentTime: Date; speed: number; updatedAt: Date } | null =
  null;
const originalDemoMode = process.env['DEMO_MODE'];

const START = Date.UTC(2026, 10, 17, 4, 15);

async function patch(
  body: unknown,
  key: AccountKey | null = 'admin',
): Promise<{ status: number; json: Record<string, unknown> }> {
  const response = await patchClock(
    asAccount(cookies, '/api/admin/clock', key, jsonInit('PATCH', body)),
  );
  return { status: response.status, json: (await response.json()) as Record<string, unknown> };
}

async function row(): Promise<{ mode: string; currentTime: number; speed: number }> {
  const clock = await db.systemClock.findUniqueOrThrow({ where: { id: 1 } });
  return { mode: clock.mode, currentTime: clock.currentTime.getTime(), speed: clock.speed };
}

async function resetClock(speed: number): Promise<void> {
  await db.systemClock.update({
    where: { id: 1 },
    data: { mode: 'demo', currentTime: new Date(START), speed, updatedAt: new Date() },
  });
}

beforeAll(async () => {
  cookies = await prepareSessions();
  process.env['DEMO_MODE'] = 'true';
  const clock = await db.systemClock.findUniqueOrThrow({ where: { id: 1 } });
  original = {
    mode: clock.mode,
    currentTime: clock.currentTime,
    speed: clock.speed,
    updatedAt: clock.updatedAt,
  };
}, 180_000);

afterAll(async () => {
  if (original) await db.systemClock.update({ where: { id: 1 }, data: original });
  if (originalDemoMode === undefined) delete process.env['DEMO_MODE'];
  else process.env['DEMO_MODE'] = originalDemoMode;
  await db.session.deleteMany({});
  await db.$disconnect();
});

describe('admin clock access', () => {
  it('lets only an admin read or change the clock', async () => {
    await resetClock(0);
    for (const key of ['student', 'owner', 'staff'] as const) {
      expect((await patch({ kind: 'speed', speed: 1 }, key)).status).toBe(403);
      const read = await getClock(asAccount(cookies, '/api/admin/clock', key));
      expect(read.status).toBe(403);
    }
    expect((await patch({ kind: 'speed', speed: 1 }, null)).status).toBe(401);
    const read = await getClock(asAccount(cookies, '/api/admin/clock', 'admin'));
    expect(read.status).toBe(200);
    expect(((await read.json()) as { clock: { speed: number } }).clock.speed).toBe(0);
  });

  it('rejects anything that is not one of the allowed commands', async () => {
    for (const body of [
      {},
      { kind: 'speed', speed: 5 },
      { kind: 'speed', speed: 1000 },
      { kind: 'jump', minutes: 7 },
      { kind: 'set', timeMs: 5 },
      { kind: 'set', timeMs: 'now' },
      { kind: 'start', extra: true },
      { kind: 'unknown' },
    ]) {
      expect((await patch(body)).status, JSON.stringify(body)).toBe(400);
    }
    expect((await row()).speed).toBe(0);
  });

  it('refuses every change when the demo mode is off', async () => {
    process.env['DEMO_MODE'] = 'false';
    try {
      const refused = await patch({ kind: 'speed', speed: 60 });
      expect(refused).toMatchObject({ status: 403, json: { error: 'demo_mode_off' } });
      expect((await row()).speed).toBe(0);
    } finally {
      process.env['DEMO_MODE'] = 'true';
    }
  });
});

describe('admin clock changes', () => {
  it('keeps the live time when the speed changes', async () => {
    await db.systemClock.update({
      where: { id: 1 },
      data: {
        mode: 'demo',
        currentTime: new Date(START),
        speed: 60,
        updatedAt: new Date(Date.now() - 10_000),
      },
    });
    expect((await patch({ kind: 'speed', speed: 0 })).status).toBe(200);
    const after = await row();
    expect(after.speed).toBe(0);
    expect(Math.abs(after.currentTime - (START + 600_000))).toBeLessThan(5 * 60_000);
    expect(after.currentTime).toBeGreaterThanOrEqual(START + 600_000);
  });

  it('jumps forward by exactly the chosen minutes while paused', async () => {
    await resetClock(0);
    expect((await patch({ kind: 'jump', minutes: 60 })).status).toBe(200);
    expect(await row()).toEqual({ mode: 'demo', currentTime: START + 3_600_000, speed: 0 });
  });

  it('sets an exact time and returns to the demo start, paused', async () => {
    const target = Date.UTC(2026, 10, 18, 1, 0);
    expect((await patch({ kind: 'set', timeMs: target })).status).toBe(200);
    expect((await row()).currentTime).toBe(target);
    expect((await patch({ kind: 'speed', speed: 10 })).status).toBe(200);
    expect((await patch({ kind: 'start' })).status).toBe(200);
    expect(await row()).toEqual({
      mode: 'demo',
      currentTime: Date.parse(DEMO_CLOCK_START),
      speed: 0,
    });
  });

  it('serialises two jumps sent at the same moment, so none is lost', async () => {
    await resetClock(0);
    const results = await Promise.all([
      patch({ kind: 'jump', minutes: 60 }),
      patch({ kind: 'jump', minutes: 60 }),
      patch({ kind: 'jump', minutes: 15 }),
    ]);
    expect(results.map((result) => result.status)).toEqual([200, 200, 200]);
    expect((await row()).currentTime).toBe(START + (60 + 60 + 15) * 60_000);
  });
});
