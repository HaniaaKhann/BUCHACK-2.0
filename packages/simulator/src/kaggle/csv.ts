import { createReadStream } from 'node:fs';
import { parse } from 'csv-parse';

export type CsvRow = Record<string, string>;

export async function* streamCsv(path: string): AsyncGenerator<CsvRow> {
  const parser = createReadStream(path).pipe(
    parse({
      columns: true,
      bom: true,
      relax_quotes: true,
      relax_column_count: true,
      skip_empty_lines: true,
    }),
  );
  for await (const row of parser) yield row as CsvRow;
}

export function isMissingFile(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}
