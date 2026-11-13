import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { MODEL_VERSION } from '@app/core';
import { generateHistory } from '../history/generate.js';
import { ACCURACY_FILE, GENERATED_DIR, loadHistoryInput } from '../history/load.js';
import { runBacktest } from './report.js';

async function main(): Promise<void> {
  const { all, report } = runBacktest(generateHistory(await loadHistoryInput()));
  await mkdir(dirname(ACCURACY_FILE), { recursive: true });
  await writeFile(ACCURACY_FILE, `${JSON.stringify(report, null, 2)}\n`);

  await mkdir(GENERATED_DIR, { recursive: true });
  const predictions = all.map((row) => ({
    orderId: row.order.id,
    pointMinutes: row.predictions.full.point,
    lowMinutes: row.predictions.full.low,
    highMinutes: row.predictions.full.high,
    baseMinutes: row.fullBaseMinutes,
    backlogAtPlacement: row.fullBacklogAtPlacement,
    modelVersion: MODEL_VERSION,
  }));
  await writeFile(`${GENERATED_DIR}/predictions.json`, `${JSON.stringify(predictions, null, 2)}\n`);

  console.log(`Accuracy report written to ${ACCURACY_FILE}`);
  console.table(
    report.models.map(({ id, name }) => ({
      model: name,
      maeTrueReady: report.overall.trueReady[id].maeMinutes,
      onTimeTrueReady: report.overall.trueReady[id].onTimeRate,
      maeTap: report.overall.tap[id].maeMinutes,
      onTimeTap: report.overall.tap[id].onTimeRate,
    })),
  );
}

await main();
