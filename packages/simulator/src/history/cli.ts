import { mkdir, writeFile } from 'node:fs/promises';
import { appOrderRows } from './export.js';
import { generateHistory } from './generate.js';
import { GENERATED_DIR, loadHistoryInput } from './load.js';

async function writeJson(name: string, value: unknown): Promise<void> {
  await writeFile(`${GENERATED_DIR}/${name}`, `${JSON.stringify(value, null, 2)}\n`);
}

async function main(): Promise<void> {
  const history = generateHistory(await loadHistoryInput());
  await mkdir(GENERATED_DIR, { recursive: true });
  const orders = appOrderRows(history);
  const tickets = history.vendors.flatMap((vendor) => vendor.tickets);
  await writeJson('tickets.json', tickets);
  await writeJson('orders.json', orders);
  await writeJson('students.json', history.students);
  console.log(
    `History written to ${GENERATED_DIR}: ${tickets.length} ticket rows, ${orders.length} app orders, ${history.students.length} students.`,
  );
}

await main();
