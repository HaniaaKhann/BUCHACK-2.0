import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const publicDirectory = (): string => join(process.cwd(), 'public');

export function listOutletPhotoSlugs(directory: string = publicDirectory()): string[] {
  const folder = join(directory, 'outlets');
  if (!existsSync(folder)) return [];
  return readdirSync(folder)
    .filter((file) => file.endsWith('.jpg'))
    .map((file) => file.slice(0, -'.jpg'.length));
}

export function logoExists(directory: string = publicDirectory()): boolean {
  return existsSync(join(directory, 'logo.svg'));
}

export function campusPhotoExists(directory: string = publicDirectory()): boolean {
  return existsSync(join(directory, 'campus', 'hkbu-landing.jpg'));
}
