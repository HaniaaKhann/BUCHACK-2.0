import { describe, expect, it } from 'vitest';
import { matchIntent } from '../../src/chat/matcher.js';
import { defaultSuggestions } from '../../src/chat/replies.js';
import { CHAT_LANGUAGES, type ChatIntent } from '../../src/chat/types.js';

interface Case {
  intent: ChatIntent;
  en: string;
  zh_HK: string;
  zh_CN: string;
  cantonese?: string;
}

const CASES: Case[] = [
  {
    intent: 'open_now',
    en: 'Which places are open now?',
    zh_HK: '現在有哪些檔口營業？',
    zh_CN: '现在哪些档口营业？',
    cantonese: '而家邊度有開？',
  },
  {
    intent: 'wait_at_vendor',
    en: 'How long is the wait at Main Canteen?',
    zh_HK: 'Main Canteen 要等多久？',
    zh_CN: 'Main Canteen 要等多久？',
    cantonese: 'Main Canteen 要等幾耐？',
  },
  {
    intent: 'find_food',
    en: 'What can I eat before my next class?',
    zh_HK: '下一節課前有什麼可以吃？',
    zh_CN: '下一节课前有什么可以吃？',
    cantonese: '下一節課前有咩食？',
  },
  {
    intent: 'order_status',
    en: 'Where is my order?',
    zh_HK: '我的訂單好了嗎？',
    zh_CN: '我的订单做好了吗？',
    cantonese: '我嘅單好咗未？',
  },
  {
    intent: 'wallet',
    en: 'How much is left in my wallet?',
    zh_HK: '我的錢包還有多少錢？',
    zh_CN: '我的钱包还有多少钱？',
    cantonese: '我個錢包仲有幾多錢？',
  },
  {
    intent: 'leave_time',
    en: 'When should I leave?',
    zh_HK: '我幾時出發？',
    zh_CN: '我什么时候出发？',
  },
  {
    intent: 'how_to_order',
    en: 'How do I order?',
    zh_HK: '怎麼下單？',
    zh_CN: '怎么下单？',
    cantonese: '點樣落單？',
  },
  {
    intent: 'other_order',
    en: "Can you show my friend's order?",
    zh_HK: '可以看朋友的訂單嗎？',
    zh_CN: '可以看朋友的订单吗？',
    cantonese: '人哋嘅單可以睇嗎？',
  },
  { intent: 'help', en: 'Hello', zh_HK: '你好', zh_CN: '帮助' },
  {
    intent: 'unknown',
    en: 'Tell me a joke',
    zh_HK: '講個笑話給我聽',
    zh_CN: '讲个笑话给我听',
  },
];

describe('matchIntent for every intent in every language', () => {
  for (const entry of CASES) {
    it(`${entry.intent}: English, Traditional, Simplified and Cantonese`, () => {
      expect(matchIntent(entry.en).intent).toBe(entry.intent);
      expect(matchIntent(entry.zh_HK).intent).toBe(entry.intent);
      expect(matchIntent(entry.zh_CN).intent).toBe(entry.intent);
      if (entry.cantonese !== undefined) {
        expect(matchIntent(entry.cantonese).intent).toBe(entry.intent);
      }
    });
  }

  it('maps every first-open suggestion button to the question it asks, in all languages', () => {
    const expected: ChatIntent[] = [
      'open_now',
      'wait_at_vendor',
      'find_food',
      'find_food',
      'how_to_order',
    ];
    for (const language of CHAT_LANGUAGES) {
      const chips = defaultSuggestions(language);
      expect(chips).toHaveLength(5);
      expect(chips.map((chip) => matchIntent(chip.query).intent)).toEqual(expected);
    }
  });
});

describe('the compound question', () => {
  const english = 'I have 20 min, under 40 HKD, something spicy and halal';
  const traditional = '我有20分鐘，預算40港幣以內，想要辣的清真食物';
  const simplified = '我有20分钟，预算40港币以内，想要辣的清真食物';
  const cantonese = '我得20分鐘，40蚊以內，想食辣嘅清真嘢';

  it('finds the same time, price, spice and diet in English, Traditional, Simplified and Cantonese', () => {
    const reference = matchIntent(english);
    expect(reference.intent).toBe('find_food');
    expect(reference.slots).toEqual({
      maxWaitMinutes: 20,
      maxPriceHkd: 40,
      diets: ['halal'],
      allergens: [],
      spicy: true,
      beforeClass: false,
      halalFallback: false,
      orderId: null,
    });
    for (const text of [traditional, simplified, cantonese]) {
      const match = matchIntent(text);
      expect(match.intent).toBe('find_food');
      expect(match.slots).toEqual(reference.slots);
    }
  });
});

describe('slots', () => {
  it('reads the price in several common forms and ignores minutes', () => {
    const price = (text: string) => matchIntent(text).slots.maxPriceHkd;
    expect(price('food under HK$35')).toBe(35);
    expect(price('something 35 hkd')).toBe(35);
    expect(price('預算50，想吃飯')).toBe(50);
    expect(price('30蚊以內有咩食')).toBe(30);
    expect(price('food under 60')).toBe(60);
    expect(price('food in under 20 minutes')).toBeNull();
  });

  it('reads minutes only next to a minute word and drops absurd numbers', () => {
    expect(matchIntent('food ready in 15 mins').slots.maxWaitMinutes).toBe(15);
    expect(matchIntent('food in 9999 min').slots.maxWaitMinutes).toBeNull();
    expect(matchIntent('food under 40').slots.maxWaitMinutes).toBeNull();
  });

  it('reads diets and treats an allergen as a filter only when it is asked to be avoided', () => {
    expect(matchIntent('vegan food please').slots.diets).toEqual(['vegan']);
    expect(matchIntent('food without peanuts').slots.allergens).toEqual(['peanuts']);
    expect(matchIntent('我對花生過敏，有什麼可以吃').slots.allergens).toEqual(['peanuts']);
    expect(matchIntent('唔要花生嘅嘢食').slots.allergens).toEqual(['peanuts']);
    expect(matchIntent('peanut noodles please').slots.allergens).toEqual([]);
  });

  it('does not double count a free-from diet as an allergen', () => {
    const slots = matchIntent('gluten free food').slots;
    expect(slots.diets).toEqual(['gluten_free']);
    expect(slots.allergens).toEqual([]);
  });

  it('keeps an order id so the page can check it belongs to the student', () => {
    const id = '0f8fad5b-d9cb-469f-a165-70867728950e';
    const match = matchIntent(`status of order ${id}`);
    expect(match.intent).toBe('order_status');
    expect(match.slots.orderId).toBe(id);
  });

  it('does not match short words inside longer ones', () => {
    expect(matchIntent('this is history').intent).toBe('unknown');
  });
});
