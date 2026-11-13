import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { isMissingFile, streamCsv, type CsvRow } from './csv.js';
import { INSPECTION_FILE, RAW_DIR } from './paths.js';

const TYPE_SAMPLE_ROWS = 1000;
const SAMPLE_ROWS = 3;
const LICENSE_PATTERN = /licen[sc]e|readme/i;
const LICENSE_MAX_CHARS = 4000;

type InferredType = 'empty' | 'number' | 'boolean' | 'string';

function inferType(value: string): InferredType {
  const trimmed = value.trim();
  if (trimmed === '') return 'empty';
  if (/^-?\d+(?:\.\d+)?$/.test(trimmed)) return 'number';
  if (/^(true|false)$/i.test(trimmed)) return 'boolean';
  return 'string';
}

function mergeTypes(types: Set<InferredType>): string {
  const present = [...types].filter((t) => t !== 'empty');
  if (present.length === 0) return 'empty';
  return present.length === 1 ? (present[0] as string) : 'string';
}

async function inspectCsv(file: string) {
  const path = `${RAW_DIR}/${file}`;
  const size = (await stat(path)).size;
  let headers: string[] = [];
  let rows = 0;
  const samples: CsvRow[] = [];
  const types = new Map<string, Set<InferredType>>();

  for await (const row of streamCsv(path)) {
    if (rows === 0) headers = Object.keys(row);
    if (rows < SAMPLE_ROWS) samples.push(row);
    if (rows < TYPE_SAMPLE_ROWS) {
      for (const [column, value] of Object.entries(row)) {
        const set = types.get(column) ?? new Set<InferredType>();
        set.add(inferType(value));
        types.set(column, set);
      }
    }
    rows += 1;
  }

  return {
    file,
    sizeBytes: size,
    rowCount: rows,
    headers,
    inferredTypes: Object.fromEntries([...types].map(([column, t]) => [column, mergeTypes(t)])),
    sampleRows: samples,
  };
}

async function main(): Promise<void> {
  let entries: string[];
  try {
    entries = await readdir(RAW_DIR);
  } catch (error) {
    if (isMissingFile(error)) {
      console.error(`No ${RAW_DIR} folder. Download the Kaggle files there first.`);
      process.exit(1);
    }
    throw error;
  }

  const csvFiles = entries.filter((f) => f.toLowerCase().endsWith('.csv')).sort();
  const licenseFiles = entries.filter((f) => LICENSE_PATTERN.test(f));
  if (csvFiles.length === 0) {
    console.error(`No CSV files in ${RAW_DIR}.`);
    process.exit(1);
  }

  const files = [];
  for (const file of csvFiles) {
    const result = await inspectCsv(file);
    console.log(`\n${result.file}  ${result.sizeBytes} bytes  ${result.rowCount} rows`);
    console.log(`  headers: ${result.headers.join(', ')}`);
    files.push(result);
  }

  const licenses = [];
  for (const file of licenseFiles) {
    const text = (await readFile(`${RAW_DIR}/${file}`, 'utf8')).slice(0, LICENSE_MAX_CHARS);
    console.log(`\n--- ${file} ---\n${text}`);
    licenses.push({ file, text });
  }
  if (licenses.length === 0) console.log('\nNo license or readme file found next to the CSVs.');

  await writeFile(INSPECTION_FILE, `${JSON.stringify({ files, licenses }, null, 2)}\n`);
  console.log(`\nWrote ${INSPECTION_FILE}`);
}

await main();
