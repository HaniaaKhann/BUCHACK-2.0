import { formatHktTime } from '@app/core';
import { PrismaClient } from '@app/db';
import { runDemoReset } from './demoReset.js';

async function main(): Promise<void> {
  if (process.env['DEMO_MODE'] !== 'true') {
    process.stderr.write('demo:reset only runs with DEMO_MODE=true\n');
    process.exit(1);
  }
  const db = new PrismaClient();
  try {
    const result = await runDemoReset(db);
    process.stdout.write(`clock fixed at ${formatHktTime(result.startMs)} HKT, speed 0\n`);
    for (const line of result.lines) process.stdout.write(`${line}\n`);
    process.stdout.write(`fingerprint ${result.fingerprint}\n`);
  } finally {
    await db.$disconnect();
  }
}

await main();
