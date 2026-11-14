export const MIN_FUZZY_LENGTH = 4;

export function editDistance(a: string, b: string): number {
  const rows = a.length + 1;
  const columns = b.length + 1;
  const grid: number[][] = Array.from({ length: rows }, () => new Array<number>(columns).fill(0));
  for (let i = 0; i < rows; i += 1) (grid[i] as number[])[0] = i;
  for (let j = 0; j < columns; j += 1) (grid[0] as number[])[j] = j;
  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < columns; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const row = grid[i] as number[];
      const previous = grid[i - 1] as number[];
      row[j] = Math.min(
        (previous[j] as number) + 1,
        (row[j - 1] as number) + 1,
        (previous[j - 1] as number) + cost,
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        const twoBack = grid[i - 2] as number[];
        row[j] = Math.min(row[j] as number, (twoBack[j - 2] as number) + 1);
      }
    }
  }
  return (grid[rows - 1] as number[])[columns - 1] as number;
}

export function allowedDistance(length: number): number {
  if (length < MIN_FUZZY_LENGTH) return 0;
  return length <= 6 ? 1 : 2;
}

export interface Near<T> {
  entry: T;
  word: string;
  distance: number;
}

export function nearest<T>(
  token: string,
  candidates: readonly { entry: T; word: string }[],
  limit: number = allowedDistance(token.length),
): Near<T>[] {
  if (token.length < MIN_FUZZY_LENGTH || limit === 0) return [];
  const found: Near<T>[] = [];
  for (const candidate of candidates) {
    if (Math.abs(candidate.word.length - token.length) > limit) continue;
    if (token.length <= 6 && candidate.word[0] !== token[0]) continue;
    const distance = editDistance(token, candidate.word);
    if (distance >= 1 && distance <= limit) found.push({ ...candidate, distance });
  }
  const best = Math.min(...found.map((entry) => entry.distance));
  return found.filter((entry) => entry.distance === best);
}
