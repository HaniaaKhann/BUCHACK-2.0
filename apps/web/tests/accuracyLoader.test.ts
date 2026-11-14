import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { loadSimulatedAccuracy } from '../src/server/accuracy';

const realFile = fileURLToPath(new URL('../public/accuracy.json', import.meta.url));

function tempFile(content: string): string {
  const path = join(mkdtempSync(join(tmpdir(), 'accuracy-')), 'accuracy.json');
  writeFileSync(path, content);
  return path;
}

describe('loadSimulatedAccuracy', () => {
  it('reads the committed backtest file', async () => {
    const result = await loadSimulatedAccuracy(realFile);
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.data.label).toBe('Simulated data');
    expect(result.data.models.map((model) => model.id)).toEqual(['historical', 'backlog', 'full']);
    expect(result.data.overall.trueReady.full.n).toBeGreaterThan(0);
  });

  it('reports a missing file', async () => {
    expect(await loadSimulatedAccuracy(join(tmpdir(), 'no-such-accuracy.json'))).toEqual({
      status: 'missing',
    });
  });

  it('reports a file that is not JSON or does not match the shape', async () => {
    expect(await loadSimulatedAccuracy(tempFile('not json'))).toEqual({ status: 'invalid' });
    expect(await loadSimulatedAccuracy(tempFile('{"label":"x"}'))).toEqual({ status: 'invalid' });
  });
});
