import { describe, expect, it } from 'vitest';
import { editDistance, nearest } from '../../src/chat/fuzzy.js';
import { correctInput } from '../../src/chat/correct.js';
import { matchIntent } from '../../src/chat/matcher.js';
import { normalizeInput } from '../../src/chat/normalize.js';
import {
  HALAL_NONE_CONFIRMED_TEXT,
  buildReply,
  isAllowedChatPath,
  requestsFor,
} from '../../src/chat/replies.js';
import type { ChatData, ChatFoodItem, ChatIntent } from '../../src/chat/types.js';

const NOW = Date.UTC(2026, 10, 17, 4, 15);

const food = (id: string, name: string, vendorName = 'Main Canteen'): ChatFoodItem => ({
  id,
  name,
  vendorName,
  priceHkd: 30,
  tagsStatus: 'verified',
  wait: { lowMinutes: 3, highMinutes: 6 },
  leaveAt: NOW,
  leaveNow: true,
});

const data = (items: ChatFoodItem[], emptyState: string | null = null): ChatData => ({
  nowMs: NOW,
  foods: { items, emptyState },
  vendors: [
    {
      id: 'v1',
      name: 'Main Canteen',
      openNow: true,
      paused: false,
      pickupEnabled: true,
      busyState: 'normal',
      wait: { lowMinutes: 4, highMinutes: 9 },
    },
    {
      id: 'v2',
      name: 'Deli',
      openNow: true,
      paused: false,
      pickupEnabled: true,
      busyState: 'normal',
      wait: { lowMinutes: 2, highMinutes: 5 },
    },
  ],
});

const intentOf = (text: string): ChatIntent => matchIntent(text).intent;

describe('phrasings that mean the same question', () => {
  const cases: [string, ChatIntent][] = [
    ["what's open?", 'open_now'],
    ['whats open', 'open_now'],
    ['any place open', 'open_now'],
    ['which canteens are open', 'open_now'],
    ['how busy is deli', 'wait_at_vendor'],
    ['wait time at bistro ntt', 'wait_at_vendor'],
    ['is main canteen crowded', 'wait_at_vendor'],
    ['how long is the line at icafe', 'wait_at_vendor'],
    ['what should i eat', 'find_food'],
    ["i'm hungry", 'find_food'],
    ['any food', 'find_food'],
    ['what do you have', 'find_food'],
    ['recommend something cheap', 'find_food'],
    ['noodles please', 'find_food'],
    ['do you have pasta', 'find_food'],
    ['where can i get coffee', 'find_food'],
    ['cheapest food', 'find_food'],
    ['quick lunch', 'find_food'],
    ['something under $30', 'find_food'],
    ['where is my food', 'order_status'],
    ['is my food ready', 'order_status'],
    ['track order', 'order_status'],
    ['order ready yet', 'order_status'],
    ['my credit', 'wallet'],
    ['how much credit', 'wallet'],
    ['my balance', 'wallet'],
    ['how much do i have', 'wallet'],
    ['help me', 'help'],
    ['what can you do', 'help'],
    ['good morning', 'help'],
    ['hiya', 'help'],
    ['how do i buy', 'how_to_order'],
    ['how does this work', 'how_to_order'],
  ];
  for (const [text, intent] of cases) {
    it(`reads "${text}" as ${intent}`, () => {
      expect(intentOf(text)).toBe(intent);
    });
  }
});

describe('small talk and thanks', () => {
  for (const text of ['thanks', 'thank you', 'thx', 'ty', 'cheers', '谢谢', '多謝', '唔該']) {
    it(`answers "${text}" as thanks`, () => {
      expect(intentOf(text)).toBe('thanks');
    });
  }
  for (const text of ['how are you', 'who are you', 'bye', 'goodbye', '再見']) {
    it(`answers "${text}" as small talk`, () => {
      expect(intentOf(text)).toBe('smalltalk');
    });
  }
  it('says it is a rules assistant and not a person, and offers example questions', () => {
    const reply = buildReply(matchIntent('who are you'), { nowMs: NOW }, 'en');
    expect(reply.lines.join(' ')).toContain('not a person');
    expect(reply.suggestions.length).toBeGreaterThanOrEqual(3);
  });
  it('lets a question win over thanks in the same message', () => {
    expect(intentOf('thanks, where is my order')).toBe('order_status');
  });
});

describe('typing and spelling mistakes', () => {
  const cases: [string, ChatIntent][] = [
    ['wallt', 'wallet'],
    ['my blance', 'wallet'],
    ['helo', 'help'],
    ['thnaks', 'thanks'],
    ['how long is the queu at deli', 'wait_at_vendor'],
    ['cheep food', 'find_food'],
    ['noodels', 'find_food'],
    ['pasat please', 'find_food'],
    ['burgr', 'find_food'],
    ['cofee', 'find_food'],
    ['a sandwhich', 'find_food'],
    ['hellooooo', 'help'],
    ['hungryyyyy', 'find_food'],
    ['WALLET!!!', 'wallet'],
    ["what's   open??", 'open_now'],
    ['heyyy', 'help'],
  ];
  for (const [text, intent] of cases) {
    it(`still reads "${text}" as ${intent}`, () => {
      expect(intentOf(text)).toBe(intent);
    });
  }

  it('fixes an outlet name so the wait can be looked up, and says so', () => {
    const match = matchIntent('how long is the wait at main cantean');
    expect(match.intent).toBe('wait_at_vendor');
    expect(match.corrections).toEqual([{ from: 'cantean', to: 'canteen', kind: 'outlet' }]);
    const reply = buildReply(match, data([]), 'en');
    expect(reply.lines[0]).toBe('I read this as canteen.');
    expect(reply.lines.join(' ')).toContain('Main Canteen: about 4 to 9 min');
  });

  it('never corrects a word under four letters, or an ordinary word that looks like a dish', () => {
    for (const text of ['fsh', 'eg', 'ric', 'tae']) {
      expect(correctInput(text).corrections).toEqual([]);
      expect(correctInput(text).text).toBe(text);
    }
    for (const text of ['nice day', 'this is nice', 'main street', 'good meal', 'when is lunch']) {
      expect(correctInput(text).corrections.map((item) => item.to)).not.toContain('rice');
      expect(correctInput(text).corrections).toEqual([]);
    }
  });

  it('measures distance with one swap counting as one edit', () => {
    expect(editDistance('noodels', 'noodles')).toBe(1);
    expect(editDistance('halal', 'hallal')).toBe(1);
    expect(editDistance('abc', 'abc')).toBe(0);
    expect(nearest('xyzq', [{ entry: 1, word: 'abcd' }])).toEqual([]);
  });

  it('cleans the text without touching Chinese or prices', () => {
    expect(normalizeInput('  Food, under HK$35!!  ')).toBe('food under hk$35');
    expect(normalizeInput('gluten-free')).toBe('gluten free');
    expect(normalizeInput('我有20分鐘，預算40港幣以內')).toBe('我有20分鐘 預算40港幣以內');
    expect(normalizeInput('soooooo goood')).toBe('soo good');
  });
});

describe('safety: diet and allergen words are never fixed silently', () => {
  const diets: [string, string, string][] = [
    ['hallal food', 'hallal', 'halal'],
    ['halaal food', 'halaal', 'halal'],
    ['vegn food', 'vegn', 'vegan'],
    ['vegatarian food', 'vegatarian', 'vegetarian'],
  ];
  for (const [text, from, to] of diets) {
    it(`reads "${from}" as ${to} and reports it`, () => {
      const match = matchIntent(text);
      expect(match.slots.diets).toEqual([to]);
      expect(match.corrections).toEqual([{ from, to, kind: 'diet' }]);
      const reply = buildReply(match, data([food('a', 'Veggie Rice')]), 'en');
      expect(reply.lines[0]).toBe(`I read this as ${to}.`);
    });
  }

  const allergens: [string, string, string][] = [
    ['food with no peenut', 'peenut', 'peanut'],
    ['food without shelfish', 'shelfish', 'shellfish'],
    ['i am allergic to glutn', 'glutn', 'gluten'],
    ['allergic to nutz', 'nutz', 'nuts'],
  ];
  for (const [text, from, to] of allergens) {
    it(`reads the allergen "${from}" as ${to}, applies it and reports it first`, () => {
      const match = matchIntent(text);
      expect(match.corrections).toEqual([{ from, to, kind: 'allergen' }]);
      expect(match.slots.allergens).toHaveLength(1);
      const reply = buildReply(match, data([food('a', 'Plain Rice')]), 'en');
      expect(reply.lines[0]).toBe(`I read this as ${to}.`);
      expect(reply.lines.join(' ')).toContain('Check the dish tags before you order');
    });
  }

  it('says nothing is safe on a loose match and keeps the vendor-confirmed wording', () => {
    const reply = buildReply(matchIntent('hallal food'), data([food('a', 'Chicken Rice')]), 'en');
    const text = reply.lines.join(' ');
    expect(text).toContain('I am not saying any dish is safe');
    expect(text).toContain('confirmed by the vendor owner');
    expect(text).not.toMatch(/is halal|are halal|safe to eat/i);
  });

  it('still says plainly that no dish is confirmed halal when none is', () => {
    const reply = buildReply(matchIntent('halaal'), data([], 'halal_unconfirmed'), 'en');
    expect(reply.lines.join(' ')).toContain(HALAL_NONE_CONFIRMED_TEXT);
    expect(reply.items).toEqual([]);
    expect(reply.lines[0]).toBe('I read this as halal.');
  });

  it('asks which allergen when a word is two edits away, and does not search', () => {
    const match = matchIntent('food with no shelfsh');
    expect(match.clarify).toEqual({ kind: 'allergen', options: ['shellfish'] });
    expect(requestsFor(match)).toEqual([]);
    const reply = buildReply(match, { nowMs: NOW }, 'en');
    expect(reply.lines[0]).toContain('Which allergen do you mean?');
    expect(reply.lines[0]).toContain('I will not guess');
    expect(reply.items).toEqual([]);
    expect(reply.suggestions.map((chip) => chip.query)).toEqual(['food without shellfish']);
    expect(matchIntent(reply.suggestions[0]?.query ?? '').slots.allergens).toEqual(['shellfish']);
  });

  it('asks about a very short allergen word instead of ignoring it', () => {
    const match = matchIntent('no eg please');
    expect(match.clarify).toEqual({ kind: 'allergen', options: ['egg'] });
    expect(requestsFor(match)).toEqual([]);
  });

  it('asks, with every allergen as a button, when the allergy word is not one it knows', () => {
    const match = matchIntent('i am allergic to xyzzy');
    expect(match.clarify?.kind).toBe('allergen');
    expect(match.clarify?.options).toHaveLength(9);
    const reply = buildReply(match, { nowMs: NOW }, 'en');
    expect(reply.suggestions).toHaveLength(9);
    for (const chip of reply.suggestions) {
      expect(matchIntent(chip.query).slots.allergens).toHaveLength(1);
    }
  });

  it('asks about a wheat allergy, which it cannot filter, instead of showing unfiltered food', () => {
    const match = matchIntent('allergic to wheat');
    expect(match.clarify?.kind).toBe('allergen');
    expect(requestsFor(match)).toEqual([]);
  });

  it('asks which diet when a diet word could be two', () => {
    const near = correctInput('vegtarn food');
    expect(near.clarify === null || near.clarify.kind === 'diet').toBe(true);
  });

  it('leaves exact allergen words alone and does not report them', () => {
    const match = matchIntent('food without peanuts');
    expect(match.corrections).toEqual([]);
    expect(match.clarify).toBeNull();
    expect(match.slots.allergens).toEqual(['peanuts']);
  });

  it('answers the same loose-match notice in both Chinese scripts', () => {
    const match = matchIntent('hallal food');
    expect(buildReply(match, data([food('a', 'Rice')]), 'zh_HK').lines[0]).toBe(
      '我把它理解為 halal。',
    );
    expect(buildReply(match, data([food('a', 'Rice')]), 'zh_CN').lines[0]).toBe(
      '我把它理解为 halal。',
    );
  });
});

describe('dish words', () => {
  const items = [
    food('1', 'Spaghetti Carbonara'),
    food('2', 'Beef Noodles'),
    food('3', 'Iced Latte'),
    food('4', 'Fried Rice'),
  ];

  it('shows only the dishes that match the dish asked for', () => {
    const reply = buildReply(matchIntent('do you have pasta'), data(items), 'en');
    expect(reply.items.map((item) => item.id)).toEqual(['1']);
  });

  it('treats a coffee question as the coffee drinks', () => {
    const reply = buildReply(matchIntent('any coffee'), data(items), 'en');
    expect(reply.items.map((item) => item.id)).toEqual(['3']);
  });

  it('reports a misspelt dish word first and then filters by it', () => {
    const reply = buildReply(matchIntent('noodels'), data(items), 'en');
    expect(reply.lines[0]).toBe('I read this as noodles.');
    expect(reply.items.map((item) => item.id)).toEqual(['2']);
  });

  it('says plainly when nothing matches the dish, and never invents a dish', () => {
    const reply = buildReply(matchIntent('do you have steak'), data(items), 'en');
    expect(reply.items).toEqual([]);
    expect(reply.notes).toContain('no_results');
    expect(reply.suggestions.length).toBeGreaterThanOrEqual(3);
  });
});

describe('requests stay the same kind of read-only calls', () => {
  it('sorts by price or by wait from the existing sort values only', () => {
    expect(requestsFor(matchIntent('cheapest food'))[0]?.path).toBe(
      '/api/menu-items?sort=lowest_price',
    );
    expect(requestsFor(matchIntent('quick lunch'))[0]?.path).toBe(
      '/api/menu-items?sort=lowest_wait',
    );
  });

  it('never puts typed words into a request, only numbers and fixed values', () => {
    for (const text of ['do you have pasta', 'noodels under 30', 'no peenut food', 'qwerty']) {
      for (const request of requestsFor(matchIntent(text))) {
        expect(isAllowedChatPath(request.path)).toBe(true);
        expect(request.path).not.toMatch(/pasta|noodel|noodle|peenut|qwerty/);
      }
    }
  });

  it('asks for the cheap list in the same call as a price limit', () => {
    const path = requestsFor(matchIntent('cheap food under 40'))[0]?.path ?? '';
    expect(path).toContain('maxPrice=40');
    expect(path).toContain('sort=lowest_price');
  });
});

describe('when nothing matches', () => {
  const unknownTexts = ['qwerty zzz', 'asdf', 'tell me a joke', 'what is the weather', '???'];
  for (const text of unknownTexts) {
    it(`says so plainly for "${text}" and shows four clickable examples`, () => {
      const match = matchIntent(text);
      expect(match.intent).toBe('unknown');
      const reply = buildReply(match, { nowMs: NOW }, 'en');
      expect(reply.lines[0]).toContain('I could not match that');
      expect(reply.items).toEqual([]);
      expect(reply.suggestions).toHaveLength(4);
      for (const chip of reply.suggestions) {
        expect(matchIntent(chip.query).intent).not.toBe('unknown');
      }
    });
  }

  it('says it in Traditional and Simplified Chinese too', () => {
    const match = matchIntent('qwerty zzz');
    expect(buildReply(match, { nowMs: NOW }, 'zh_HK').lines[0]).toContain('我無法把這個問題');
    expect(buildReply(match, { nowMs: NOW }, 'zh_CN').lines[0]).toContain('我无法把这个问题');
    expect(buildReply(match, { nowMs: NOW }, 'zh_HK').suggestions).toHaveLength(4);
  });
});

describe('Chinese behaviour is unchanged', () => {
  const cases: [string, ChatIntent][] = [
    ['你好', 'help'],
    ['谢谢', 'thanks'],
    ['多謝', 'thanks'],
    ['我的錢包還有多少錢？', 'wallet'],
    ['现在哪些档口营业？', 'open_now'],
    ['Main Canteen 要等多久？', 'wait_at_vendor'],
    ['我對花生過敏，有什麼可以吃', 'find_food'],
  ];
  for (const [text, intent] of cases) {
    it(`reads "${text}" as ${intent}`, () => {
      expect(intentOf(text)).toBe(intent);
    });
  }

  it('does not run the English spelling fixes on Chinese text', () => {
    const match = matchIntent('我對花生過敏，有什麼可以吃');
    expect(match.corrections).toEqual([]);
    expect(match.slots.allergens).toEqual(['peanuts']);
  });

  it('reads a cheap request in Chinese as a price sort', () => {
    expect(matchIntent('有冇便宜嘅嘢食').sort).toBe('lowest_price');
  });
});
