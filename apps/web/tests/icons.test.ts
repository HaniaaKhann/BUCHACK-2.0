import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import manifest from '../src/app/manifest';

const app = (name: string): Buffer =>
  readFileSync(fileURLToPath(new URL(`../src/app/${name}`, import.meta.url)));

function pngSize(file: Buffer): [number, number] {
  expect(file.subarray(1, 4).toString('ascii')).toBe('PNG');
  return [file.readUInt32BE(16), file.readUInt32BE(20)];
}

describe('tab and home screen icons', () => {
  it('has a 64 pixel icon and a 180 pixel apple icon, both square PNG files', () => {
    expect(pngSize(app('icon.png'))).toEqual([64, 64]);
    expect(pngSize(app('apple-icon.png'))).toEqual([180, 180]);
  });

  it('lists both icons in the manifest, with their real sizes', () => {
    const icons = manifest().icons ?? [];
    expect(icons.map((icon) => [icon.src, icon.sizes, icon.type])).toEqual([
      ['/icon.png', '64x64', 'image/png'],
      ['/apple-icon.png', '180x180', 'image/png'],
    ]);
  });
});
