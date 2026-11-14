import { editDistance, nearest } from './fuzzy.js';
import {
  ALLERGEN_WORDS,
  COMMAND_WORDS,
  DIET_WORDS,
  DISH_WORDS,
  OUTLET_WORDS,
  PROTECTED_WORDS,
  STRETCHABLE_SHORT_WORDS,
  type LexiconEntry,
  type WordKind,
} from './lexicon.js';
import { isLatinWord, normalizeInput, squash, tokensOf } from './normalize.js';
import * as vocab from './vocab.js';

export interface ChatCorrection {
  from: string;
  to: string;
  kind: WordKind;
}

export interface ChatClarify {
  kind: 'allergen' | 'diet';
  options: string[];
}

export interface CorrectedInput {
  text: string;
  corrections: ChatCorrection[];
  clarify: ChatClarify | null;
}

const LEXICON: readonly LexiconEntry[] = [
  ...ALLERGEN_WORDS,
  ...DIET_WORDS,
  ...DISH_WORDS,
  ...OUTLET_WORDS,
  ...COMMAND_WORDS,
];

const CANDIDATES = LEXICON.flatMap((entry) => entry.words.map((word) => ({ entry, word })));

function asciiSingleWords(terms: readonly string[]): string[] {
  return terms.map((term) => normalizeInput(term)).filter((term) => /^[a-z]+$/.test(term));
}

const KNOWN_WORDS: ReadonlySet<string> = new Set([
  ...CANDIDATES.map((candidate) => candidate.word),
  ...PROTECTED_WORDS,
  ...asciiSingleWords([
    ...vocab.OTHER_ORDER_TERMS,
    ...vocab.HOW_TO_ORDER_TERMS,
    ...vocab.WALLET_TERMS,
    ...vocab.LEAVE_TERMS,
    ...vocab.ORDER_STATUS_TERMS,
    ...vocab.WAIT_TERMS,
    ...vocab.OPEN_TERMS,
    ...vocab.FOOD_TERMS,
    ...vocab.HELP_TERMS,
    ...vocab.BEFORE_CLASS_TERMS,
    ...vocab.HALAL_FALLBACK_TERMS,
    ...vocab.SPICY_TERMS,
    ...vocab.ALLERGEN_CUES,
  ]),
  ...'a an the and or of to is it in on at my me i im am we you your for are be do can how what which where when who why please tell show give get got have has any all some more less than then too also not no yes ok okay'.split(
    ' ',
  ),
  ...'chili chilli minute minutes min mins hkd dollar dollars hong kong'.split(' '),
]);

const SAFETY: ReadonlySet<WordKind> = new Set<WordKind>(['diet', 'allergen']);

const STRICT_CUES: ReadonlySet<string> = new Set(['allergic', 'allergy', 'allergies', 'avoid']);
const GENERAL_CUES: ReadonlySet<string> = new Set(['no', 'without', 'free']);
const SKIPPED: ReadonlySet<string> = new Set(
  'to the a an any of and or im am i is my too all things foods food stuff'.split(' '),
);

const ALL_ALLERGEN_IDS = ALLERGEN_WORDS.map((entry) => entry.id);
const ALL_DIET_IDS = DIET_WORDS.map((entry) => entry.id);

function idsOf(kind: WordKind, near: readonly { entry: LexiconEntry }[]): string[] {
  return [...new Set(near.filter((item) => item.entry.kind === kind).map((item) => item.entry.id))];
}

function safetyClarify(near: readonly { entry: LexiconEntry }[]): ChatClarify {
  const allergens = idsOf('allergen', near);
  if (allergens.length > 0) return { kind: 'allergen', options: allergens };
  return { kind: 'diet', options: idsOf('diet', near) };
}

function isResolved(token: string): boolean {
  return (
    !isLatinWord(token) ||
    KNOWN_WORDS.has(token) ||
    CANDIDATES.some((candidate) => candidate.word === token)
  );
}

function nextSignificant(tokens: readonly string[], from: number): string | null {
  for (let index = from; index < Math.min(tokens.length, from + 3); index += 1) {
    const token = tokens[index] as string;
    if (!SKIPPED.has(token)) return token;
  }
  return null;
}

function allergenNear(token: string): { entry: LexiconEntry }[] {
  return ALLERGEN_WORDS.filter((entry) =>
    entry.words.some((word) => editDistance(token, word) <= 2),
  ).map((entry) => ({ entry }));
}

function cueClarify(tokens: readonly string[]): ChatClarify | null {
  for (let index = 0; index < tokens.length; index += 1) {
    const cue = tokens[index] as string;
    if (STRICT_CUES.has(cue)) {
      const target = nextSignificant(tokens, index + 1);
      if (target !== null && isLatinWord(target) && !isResolved(target)) {
        const near = allergenNear(target);
        return near.length > 0
          ? safetyClarify(near)
          : { kind: 'allergen', options: [...ALL_ALLERGEN_IDS] };
      }
    }
    if (GENERAL_CUES.has(cue)) {
      const target = nextSignificant(tokens, index + 1);
      if (target !== null && isLatinWord(target) && target.length >= 2 && !isResolved(target)) {
        const near = allergenNear(target);
        if (near.length > 0) return safetyClarify(near);
      }
    }
  }
  return null;
}

export function correctInput(raw: string): CorrectedInput {
  const tokens = tokensOf(normalizeInput(raw));
  const corrections: ChatCorrection[] = [];
  let clarify: ChatClarify | null = null;

  const fixed = tokens.map((token) => {
    if (!isLatinWord(token)) return token;
    const stretched = squash(token);
    if (stretched !== token && STRETCHABLE_SHORT_WORDS.has(stretched)) return stretched;
    if (token.length < 4) return token;
    if (KNOWN_WORDS.has(token)) return token;
    const near = nearest(token, CANDIDATES);
    if (near.length === 0) return token;
    const entries = [...new Map(near.map((item) => [item.entry.id, item.entry])).values()];
    const safety = near.some((item) => SAFETY.has(item.entry.kind));
    const first = near[0];
    if (first === undefined) return token;
    if (entries.length > 1) {
      if (safety && clarify === null) clarify = safetyClarify(near);
      return token;
    }
    if (safety && first.distance > 1) {
      if (clarify === null) clarify = safetyClarify(near);
      return token;
    }
    if (first.entry.kind !== 'command') {
      corrections.push({ from: token, to: first.word, kind: first.entry.kind });
    }
    return first.word;
  });

  const unique = corrections.filter(
    (item, index) =>
      corrections.findIndex((other) => other.from === item.from && other.to === item.to) === index,
  );
  const text = fixed.join(' ');
  return {
    text,
    corrections: unique,
    clarify: clarify ?? cueClarify(fixed),
  };
}

export function dishesIn(text: string): string[] {
  const tokens = new Set(tokensOf(text));
  return DISH_WORDS.filter((entry) => entry.words.some((word) => tokens.has(word))).map(
    (entry) => entry.id,
  );
}

export function mentionsOutlet(text: string): boolean {
  const tokens = new Set(tokensOf(text));
  return OUTLET_WORDS.some((entry) => entry.words.some((word) => tokens.has(word)));
}

export function mentions(text: string, id: string): boolean {
  const entry = COMMAND_WORDS.find((item) => item.id === id);
  const tokens = new Set(tokensOf(text));
  return entry !== undefined && entry.words.some((word) => tokens.has(word));
}

export { ALL_ALLERGEN_IDS, ALL_DIET_IDS };
