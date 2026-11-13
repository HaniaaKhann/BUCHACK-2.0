import { fileURLToPath } from 'node:url';

function fromHere(relative: string): string {
  return fileURLToPath(new URL(relative, import.meta.url));
}

export const RAW_DIR = fromHere('../../../../data/raw');
export const INSPECTION_FILE = `${RAW_DIR}/inspection.json`;
export const PROPOSED_MAPPING_FILE = `${RAW_DIR}/mapping.proposed.json`;
export const CONFIRMED_MAPPING_FILE = `${RAW_DIR}/mapping.confirmed.json`;
export const MENUS_OUT_FILE = fromHere('../../../db/seed-data/menus.json');
