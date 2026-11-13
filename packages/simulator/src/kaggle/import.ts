import { readFile, writeFile } from 'node:fs/promises';
import { z } from 'zod';
import { RANDOM_SEED, USD_TO_HKD, USD_TO_HKD_DATE } from './config.js';
import { isMissingFile, streamCsv } from './csv.js';
import { parseConfirmedMapping, validateMappingAgainstHeaders } from './mapping.js';
import { CONFIRMED_MAPPING_FILE, INSPECTION_FILE, MENUS_OUT_FILE, RAW_DIR } from './paths.js';
import { assignToOutlets, buildCandidate, toMenuFile, type Candidate } from './transform.js';

const inspectionSchema = z.object({
  files: z.array(z.object({ file: z.string(), headers: z.array(z.string()) })),
});

async function readOptional(path: string): Promise<string | null> {
  try {
    return await readFile(path, 'utf8');
  } catch (error) {
    if (isMissingFile(error)) return null;
    throw error;
  }
}

async function main(): Promise<void> {
  const mapping = parseConfirmedMapping(await readOptional(CONFIRMED_MAPPING_FILE));

  const inspectionRaw = await readOptional(INSPECTION_FILE);
  if (inspectionRaw === null)
    throw new Error('inspection.json is missing. Run data:inspect first.');
  const problems = validateMappingAgainstHeaders(
    mapping,
    inspectionSchema.parse(JSON.parse(inspectionRaw)).files,
  );
  if (problems.length > 0) {
    throw new Error(`Mapping does not match the files:\n${problems.join('\n')}`);
  }

  const restaurants = new Map<string, { name: string; categories: string }>();
  for await (const row of streamCsv(`${RAW_DIR}/${mapping.restaurantsFile}`)) {
    restaurants.set(row[mapping.restaurants.id] ?? '', {
      name: row[mapping.restaurants.name] ?? '',
      categories: row[mapping.restaurants.category] ?? '',
    });
  }

  const candidates: Candidate[] = [];
  let rowNumber = 0;
  for await (const row of streamCsv(`${RAW_DIR}/${mapping.menuFile}`)) {
    rowNumber += 1;
    const restaurantId = row[mapping.menu.restaurantId] ?? '';
    const restaurant = restaurants.get(restaurantId);
    if (!restaurant) continue;
    const candidate = buildCandidate(
      {
        restaurantId,
        restaurantName: restaurant.name,
        restaurantCategories: restaurant.categories,
        menuCategory: row[mapping.menu.category] ?? '',
        name: row[mapping.menu.name] ?? '',
        description: row[mapping.menu.description] ?? '',
        priceRaw: row[mapping.menu.price] ?? '',
      },
      rowNumber,
    );
    if (candidate) candidates.push(candidate);
  }

  const { byOutlet, shortfalls } = assignToOutlets(candidates, RANDOM_SEED);
  console.log(`Read ${rowNumber} menu rows, ${candidates.length} usable candidates.`);
  for (const [outlet, items] of byOutlet) console.log(`  ${outlet}: ${items.length}`);

  if (shortfalls.length > 0) {
    console.error(`\nNot writing menus.json:\n${shortfalls.join('\n')}`);
    process.exit(1);
  }

  const description = `Demo menu derived from the Kaggle dataset "Uber Eats USA Restaurants and Menus". Restaurant names are removed, prices are converted at a fixed ${USD_TO_HKD} HKD per USD (assumption dated ${USD_TO_HKD_DATE}), and diet and allergen tags are unverified keyword suggestions.`;
  await writeFile(
    MENUS_OUT_FILE,
    `${JSON.stringify(toMenuFile(byOutlet, description), null, 2)}\n`,
  );
  console.log(`\nWrote ${MENUS_OUT_FILE}`);
  console.log('Check the dataset license before committing this file (see docs/DATA.md).');
}

await main();
