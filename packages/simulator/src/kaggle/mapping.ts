import { z } from 'zod';
import { KAGGLE_COLUMNS } from './config.js';

const column = z.string().min(1);

export const mappingSchema = z.object({
  restaurantsFile: column,
  menuFile: column,
  restaurants: z.object({ id: column, name: column, category: column }),
  menu: z.object({
    restaurantId: column,
    category: column,
    name: column,
    description: column,
    price: column,
  }),
});

export type Mapping = z.infer<typeof mappingSchema>;

export interface FileInspection {
  file: string;
  headers: string[];
}

function pick(headers: readonly string[], aliases: readonly string[]): string | null {
  const lowered = new Map(headers.map((h) => [h.toLowerCase(), h]));
  for (const alias of aliases) {
    const found = lowered.get(alias.toLowerCase());
    if (found) return found;
  }
  return null;
}

function findFile(
  files: readonly FileInspection[],
  preferred: string,
  required: readonly (readonly string[])[],
): FileInspection | null {
  const byName = files.find((f) => f.file.toLowerCase() === preferred.toLowerCase());
  if (byName) return byName;
  return files.find((f) => required.every((aliases) => pick(f.headers, aliases) !== null)) ?? null;
}

export interface ProposedMapping {
  mapping: Mapping | null;
  missing: string[];
}

export function proposeMapping(files: readonly FileInspection[]): ProposedMapping {
  const cols = KAGGLE_COLUMNS;
  const restaurantsFile = findFile(files, cols.restaurantsFile, [
    cols.restaurants.id,
    cols.restaurants.name,
    cols.restaurants.category,
  ]);
  const menuFile = findFile(files, cols.menuFile, [
    cols.menu.restaurantId,
    cols.menu.name,
    cols.menu.price,
  ]);

  const missing: string[] = [];
  if (!restaurantsFile) missing.push('restaurants file');
  if (!menuFile) missing.push('menu file');

  const resolve = (file: FileInspection | null, label: string, aliases: readonly string[]) => {
    const found = file ? pick(file.headers, aliases) : null;
    if (!found) missing.push(label);
    return found ?? '';
  };

  const candidate = {
    restaurantsFile: restaurantsFile?.file ?? '',
    menuFile: menuFile?.file ?? '',
    restaurants: {
      id: resolve(restaurantsFile, 'restaurants.id', cols.restaurants.id),
      name: resolve(restaurantsFile, 'restaurants.name', cols.restaurants.name),
      category: resolve(restaurantsFile, 'restaurants.category', cols.restaurants.category),
    },
    menu: {
      restaurantId: resolve(menuFile, 'menu.restaurantId', cols.menu.restaurantId),
      category: resolve(menuFile, 'menu.category', cols.menu.category),
      name: resolve(menuFile, 'menu.name', cols.menu.name),
      description: resolve(menuFile, 'menu.description', cols.menu.description),
      price: resolve(menuFile, 'menu.price', cols.menu.price),
    },
  };

  return { mapping: missing.length === 0 ? mappingSchema.parse(candidate) : null, missing };
}

export function validateMappingAgainstHeaders(
  mapping: Mapping,
  files: readonly FileInspection[],
): string[] {
  const problems: string[] = [];
  const check = (fileName: string, columns: Record<string, string>): void => {
    const file = files.find((f) => f.file === fileName);
    if (!file) {
      problems.push(`file "${fileName}" not found in inspection`);
      return;
    }
    for (const [field, header] of Object.entries(columns)) {
      if (!file.headers.includes(header)) {
        problems.push(`${fileName}: column "${header}" (for ${field}) not in headers`);
      }
    }
  };
  check(mapping.restaurantsFile, mapping.restaurants);
  check(mapping.menuFile, mapping.menu);
  return problems;
}

export function parseConfirmedMapping(raw: string | null): Mapping {
  if (raw === null) {
    throw new Error(
      'mapping.confirmed.json is missing. Run data:map, review mapping.proposed.json, then save it as mapping.confirmed.json.',
    );
  }
  return mappingSchema.parse(JSON.parse(raw));
}
