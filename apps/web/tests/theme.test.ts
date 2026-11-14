import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { BOUNDARY_PAIRS, PALETTE, TEXT_PAIRS, type PaletteName } from '../src/theme';

const srcRoot = fileURLToPath(new URL('../src', import.meta.url));

function channel(value: number): number {
  const unit = value / 255;
  return unit <= 0.03928 ? unit / 12.92 : ((unit + 0.055) / 1.055) ** 2.4;
}

function rgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function luminance(color: [number, number, number]): number {
  return 0.2126 * channel(color[0]) + 0.7152 * channel(color[1]) + 0.0722 * channel(color[2]);
}

function ratio(a: [number, number, number], b: [number, number, number]): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return ((light ?? 0) + 0.05) / ((dark ?? 0) + 0.05);
}

const color = (name: PaletteName): [number, number, number] => rgb(PALETTE[name]);

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx|css)$/.test(path) ? [path] : [];
  });
}

describe('theme palette', () => {
  it('has the five brand colours exactly', () => {
    expect(PALETTE).toMatchObject({
      navy: '#384671',
      cream: '#E9F4C9',
      sky: '#3EADFF',
      berry: '#BB205C',
      cocoa: '#8B3A17',
    });
  });

  it('passes AA for every declared text pair', () => {
    for (const pair of TEXT_PAIRS) {
      const needed = pair.size === 'large' ? 3 : 4.5;
      const got = ratio(color(pair.text), color(pair.on));
      expect(got, `${pair.text} on ${pair.on} (${pair.use})`).toBeGreaterThanOrEqual(needed);
    }
  });

  it('never puts white or cream small text on the blue', () => {
    for (const pair of TEXT_PAIRS) {
      if (pair.on === 'sky') expect(pair.size).toBe('large');
    }
  });

  it('keeps control borders at 3 to 1 against their background', () => {
    for (const pair of BOUNDARY_PAIRS) {
      const line = color(pair.line);
      const back = color(pair.on);
      const blended = line.map((value, index) =>
        Math.round(value * pair.opacity + (back[index] ?? 0) * (1 - pair.opacity)),
      ) as [number, number, number];
      expect(ratio(blended, back), pair.use).toBeGreaterThanOrEqual(3);
    }
  });
});

describe('theme use in the source', () => {
  it('uses no colour class outside the palette', () => {
    const allowed = new Set([
      'navy',
      'cream',
      'sky',
      'berry',
      'cocoa',
      'white',
      'muted',
      'transparent',
      'current',
    ]);
    const pattern =
      /\b(?:bg|text|border|ring|divide|outline|from|to|via|fill|stroke|placeholder|accent|caret)-([a-z]+)(?:-\d+)?(?:\/\d+)?\b/g;
    const unknown = sourceFiles(srcRoot).flatMap((file) => {
      const text = readFileSync(file, 'utf8');
      return [...text.matchAll(pattern)]
        .map((match) => match[1] ?? '')
        .filter((name) =>
          [
            'neutral',
            'gray',
            'slate',
            'zinc',
            'red',
            'green',
            'amber',
            'blue',
            'emerald',
            'yellow',
            'orange',
            'rose',
            'stone',
            'black',
          ].includes(name),
        )
        .filter((name) => !allowed.has(name))
        .map((name) => `${file}: ${name}`);
    });
    expect(unknown).toEqual([]);
  });

  it('never sets white or cream small text directly on the blue', () => {
    const offenders = sourceFiles(srcRoot).filter((file) =>
      /bg-sky(?!\/)[^"'`]*text-(?:white|cream)|text-(?:white|cream)[^"'`]*bg-sky(?!\/)/.test(
        readFileSync(file, 'utf8'),
      ),
    );
    expect(offenders).toEqual([]);
  });
});
