import { PrismaClient } from '@app/db';
import { readClock } from './clock.js';
import { TICK_MS } from './config.js';
import { newTickState, runTick } from './tick.js';

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const main = async (): Promise<void> => {
  const db = new PrismaClient();
  const state = newTickState();
  const options = { demoMode: process.env['DEMO_MODE'] === 'true', uniform: Math.random };
  process.stdout.write('[worker] started\n');
  for (;;) {
    try {
      await runTick(db, await readClock(db, Date.now()), state, options);
    } catch (err: unknown) {
      process.stderr.write(`[worker] tick failed ${String(err)}\n`);
    }
    await sleep(TICK_MS);
  }
};

main().catch((err: unknown) => {
  process.stderr.write(`[worker] fatal ${String(err)}\n`);
  process.exit(1);
});
