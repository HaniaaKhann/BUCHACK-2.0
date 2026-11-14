import type { ChatIntent, ChatMatch, ChatSlots } from './types.js';
import {
  ALLERGEN_CUES,
  ALLERGEN_TERMS,
  BEFORE_CLASS_TERMS,
  CURRENCY_WORDS,
  DIET_TERMS,
  FOOD_TERMS,
  HALAL_FALLBACK_TERMS,
  HELP_TERMS,
  HOW_TO_ORDER_TERMS,
  LEAVE_TERMS,
  MINUTE_WORDS,
  OPEN_TERMS,
  ORDER_STATUS_TERMS,
  OTHER_ORDER_TERMS,
  SPICY_TERMS,
  WAIT_TERMS,
  WALLET_TERMS,
} from './vocab.js';

const ASCII_ONLY = /^[\x20-\x7e]+$/;
const MAX_MINUTES = 240;
const MAX_PRICE_HKD = 1000;

const MINUTES_PATTERN = new RegExp(`(\\d{1,3})\\s*(?:${MINUTE_WORDS})(?![a-z])`);

const PRICE_PATTERNS: readonly RegExp[] = [
  /(?:hk\$|\$)\s*(\d{1,4})/,
  new RegExp(`(\\d{1,4})\\s*(?:${CURRENCY_WORDS})`),
  /(?:under|below|less than|within|up to|max(?:imum)?|no more than|at most)\s*(\d{1,4})/,
  /(?:預算|预算|不超過|不超过|唔超過|最多)\s*(\d{1,4})/,
  /(\d{1,4})\s*(?:以內|以内|以下|之內|之内)/,
];

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function normalizeText(text: string): string {
  return text.normalize('NFKC').toLowerCase().trim();
}

function hasTerm(text: string, term: string): boolean {
  if (!ASCII_ONLY.test(term)) return text.includes(term);
  return new RegExp(`(?<![a-z0-9])${escapeRegExp(term)}(?![a-z0-9])`).test(text);
}

function hasAny(text: string, terms: readonly string[]): boolean {
  return terms.some((term) => hasTerm(text, term));
}

function hasAllergenCue(text: string): boolean {
  return ALLERGEN_CUES.some((cue) =>
    cue === 'no' ? /(?<![a-z0-9])no(?![a-z0-9])/.test(text) : text.includes(cue),
  );
}

function boundedNumber(value: string | undefined, max: number): number | null {
  if (value === undefined) return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 && parsed <= max ? parsed : null;
}

function extractMinutes(text: string): { minutes: number | null; rest: string } {
  const match = MINUTES_PATTERN.exec(text);
  if (match === null) return { minutes: null, rest: text };
  return {
    minutes: boundedNumber(match[1], MAX_MINUTES),
    rest: text.slice(0, match.index) + ' ' + text.slice(match.index + match[0].length),
  };
}

function extractPrice(text: string): number | null {
  for (const pattern of PRICE_PATTERNS) {
    const match = pattern.exec(text);
    if (match !== null) return boundedNumber(match[1], MAX_PRICE_HKD);
  }
  return null;
}

function extractSlots(text: string): ChatSlots {
  const { minutes, rest } = extractMinutes(text);
  const diets = DIET_TERMS.filter((entry) => hasAny(text, entry.terms)).map((entry) => entry.id);
  const cue = hasAllergenCue(text);
  const allergens = cue
    ? ALLERGEN_TERMS.filter((entry) => hasAny(text, entry.terms)).map((entry) => entry.id)
    : [];
  const dropped = new Set<string>();
  if (diets.includes('gluten_free')) dropped.add('gluten');
  if (diets.includes('dairy_free')) dropped.add('dairy');
  return {
    maxWaitMinutes: minutes,
    maxPriceHkd: extractPrice(rest),
    diets,
    allergens: allergens.filter((id) => !dropped.has(id)),
    spicy: hasAny(text, SPICY_TERMS),
    beforeClass: hasAny(text, BEFORE_CLASS_TERMS),
    halalFallback: hasAny(text, HALAL_FALLBACK_TERMS),
    orderId: UUID.exec(text)?.[0] ?? null,
  };
}

function hasFoodSignal(text: string, slots: ChatSlots): boolean {
  return (
    hasAny(text, FOOD_TERMS) ||
    slots.maxPriceHkd !== null ||
    slots.diets.length > 0 ||
    slots.allergens.length > 0 ||
    slots.spicy ||
    slots.beforeClass
  );
}

function chooseIntent(text: string, slots: ChatSlots): ChatIntent {
  if (hasAny(text, OTHER_ORDER_TERMS)) return 'other_order';
  if (hasAny(text, HOW_TO_ORDER_TERMS)) return 'how_to_order';
  if (hasAny(text, WALLET_TERMS)) return 'wallet';
  if (hasAny(text, LEAVE_TERMS)) return 'leave_time';
  if (hasAny(text, ORDER_STATUS_TERMS) || slots.orderId !== null) return 'order_status';
  const food = hasFoodSignal(text, slots);
  if (hasAny(text, WAIT_TERMS) && !food) return 'wait_at_vendor';
  if (hasAny(text, OPEN_TERMS) && !food) return 'open_now';
  if (food || slots.maxWaitMinutes !== null) return 'find_food';
  if (hasAny(text, HELP_TERMS)) return 'help';
  return 'unknown';
}

export function matchIntent(input: string): ChatMatch {
  const text = normalizeText(input);
  const slots = extractSlots(text);
  return { intent: chooseIntent(text, slots), slots, text };
}
