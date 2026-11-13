const PORK_WORDS = [
  /\bpork\b/,
  /\bham\b/,
  /\bbacon\b/,
  /\bchar siu\b/,
  /\bsiu mai\b/,
  /\bshumai\b/,
  /\bwonton\b/,
  /\bdumpling/,
  /\bsausage/,
  /\blard\b/,
  /\bluncheon\b/,
  /\bribs?\b/,
  /\bbolognese\b/,
  /\bpepperoni\b/,
];

const BEEF_WORDS = [
  /\bbeef\b/,
  /\bsteak\b/,
  /\bbrisket\b/,
  /burger/,
  /\bmeatball/,
  /\bbolognese\b/,
  /\blasagn/,
];

function mentions(name: string, words: readonly RegExp[]): boolean {
  const lowered = name.toLowerCase();
  return words.some((word) => word.test(lowered));
}

export function withMeatTags(name: string, dietTags: readonly string[]): string[] {
  const tags = new Set(dietTags);
  const meatFree = tags.has('vegetarian') || tags.has('vegan');
  if (meatFree || !mentions(name, PORK_WORDS)) tags.add('no_pork');
  if (meatFree || !mentions(name, BEEF_WORDS)) tags.add('no_beef');
  return [...tags];
}
