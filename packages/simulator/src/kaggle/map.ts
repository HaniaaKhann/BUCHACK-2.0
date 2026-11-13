import { readFile, writeFile } from 'node:fs/promises';
import { z } from 'zod';
import { proposeMapping } from './mapping.js';
import { INSPECTION_FILE, PROPOSED_MAPPING_FILE } from './paths.js';

const inspectionSchema = z.object({
  files: z.array(z.object({ file: z.string(), headers: z.array(z.string()) })),
});

async function main(): Promise<void> {
  let raw: string;
  try {
    raw = await readFile(INSPECTION_FILE, 'utf8');
  } catch {
    console.error('inspection.json not found. Run data:inspect first.');
    process.exit(1);
  }

  const { mapping, missing } = proposeMapping(inspectionSchema.parse(JSON.parse(raw)).files);
  if (!mapping) {
    console.error(`Could not propose a mapping. Unmatched: ${missing.join(', ')}`);
    console.error('Adapt KAGGLE_COLUMNS in packages/simulator/src/kaggle/config.ts and rerun.');
    process.exit(1);
  }

  await writeFile(PROPOSED_MAPPING_FILE, `${JSON.stringify(mapping, null, 2)}\n`);
  console.log(`Wrote ${PROPOSED_MAPPING_FILE}`);
  console.log(
    'Review it, edit if needed, and save it as mapping.confirmed.json in the same folder.',
  );
}

await main();
