import { describe, expect, it } from 'vitest';
import { matchIntent } from '../../src/chat/matcher.js';
import {
  HALAL_NONE_CONFIRMED_TEXT,
  buildReply,
  chatUiText,
  dataErrorReply,
  defaultSuggestions,
  findVendor,
  halalFallbackSuggestion,
  isAllowedChatPath,
  notVerifiedText,
  requestsFor,
} from '../../src/chat/replies.js';
import {
  CHAT_LANGUAGES,
  type ChatData,
  type ChatFoodItem,
  type ChatLanguage,
  type ChatOrder,
  type ChatReply,
  type ChatVendor,
} from '../../src/chat/types.js';

const NOW = Date.UTC(2026, 10, 17, 4, 15);
const MIN = 60_000;
const HAN = /[一-鿿]/;

const vendor = (name: string, overrides: Partial<ChatVendor> = {}): ChatVendor => ({
  id: name.toLowerCase().replace(/\W+/g, '-'),
  name,
  openNow: true,
  paused: false,
  pickupEnabled: true,
  busyState: 'normal',
  wait: { lowMinutes: 4.78, highMinutes: 8.88 },
  ...overrides,
});

const VENDORS: ChatVendor[] = [
  vendor('Main Canteen'),
  vendor('Harmony Cafeteria', { wait: { lowMinutes: 3.85, highMinutes: 7.15 } }),
  vendor('Bistro NTT', { busyState: 'rush', wait: { lowMinutes: 7.7, highMinutes: 14.3 } }),
  vendor('Deli', { paused: true }),
  vendor('iCafe', { openNow: false }),
  vendor('Café@CVA Commons'),
  vendor('H.F.C. (Hot Food Counter) @ Scholars Court'),
];

const food = (id: string, overrides: Partial<ChatFoodItem> = {}): ChatFoodItem => ({
  id,
  name: `Dish ${id}`,
  vendorName: 'Main Canteen',
  priceHkd: 32,
  tagsStatus: 'verified',
  wait: { lowMinutes: 6, highMinutes: 12 },
  leaveAt: NOW + 4 * MIN,
  leaveNow: false,
  ...overrides,
});

const FOODS = {
  items: [food('a'), food('b', { tagsStatus: 'unverified', leaveNow: true }), food('c'), food('d')],
  emptyState: null,
};

const ORDERS: ChatOrder[] = [
  {
    id: 'own-1',
    status: 'preparing',
    vendorName: 'Bistro NTT',
    placedAt: NOW,
    predicted: { low: NOW + 5 * MIN, point: NOW + 7 * MIN, high: NOW + 10 * MIN },
  },
];

const DATA: ChatData = {
  nowMs: NOW,
  vendors: VENDORS,
  foods: FOODS,
  orders: ORDERS,
  walletHkd: 300,
};

const ask = (text: string, language: ChatLanguage, data: ChatData = DATA) =>
  buildReply(matchIntent(text), data, language);

const joined = (lines: readonly string[], items: readonly { text: string }[] = []): string =>
  [...lines, ...items.map((item) => item.text)].join('\n');

describe('every intent answers in every language from the data', () => {
  it('lists the outlets that are open, paused and closed', () => {
    const en = ask('Which places are open now?', 'en');
    expect(en.lines[0]).toContain(
      'Open now (12:15): Main Canteen, Harmony Cafeteria, Bistro NTT (busy)',
    );
    expect(en.lines.join(' ')).toContain('Paused, not taking orders: Deli');
    expect(en.lines.join(' ')).toContain('Closed now: iCafe');
    const tc = ask('現在有哪些檔口營業？', 'zh_HK');
    expect(tc.lines[0]).toBe(
      '現在營業中（12:15）：Main Canteen、Harmony Cafeteria、Bistro NTT（繁忙）、Café@CVA Commons、H.F.C. (Hot Food Counter) @ Scholars Court。',
    );
    const sc = ask('现在哪些档口营业？', 'zh_CN');
    expect(sc.lines[0]).toContain('现在营业中（12:15）');
    expect(sc.lines.join('')).toContain('暂停接单：Deli');
  });

  it('gives the wait range of a named outlet and says it is an estimate from simulated data', () => {
    expect(ask('How long is the wait at Main Canteen?', 'en').lines[0]).toBe(
      'Main Canteen: about 4 to 9 min right now. This is an estimate from simulated data.',
    );
    expect(ask('Main Canteen 要等多久？', 'zh_HK').lines[0]).toBe(
      'Main Canteen 目前約需 4 至 9 分鐘（估算，使用模擬數據）。',
    );
    expect(ask('Harmony Cafeteria 现在要等多久？', 'zh_CN').lines[0]).toBe(
      'Harmony Cafeteria 目前约需 3 至 8 分钟（估算，使用模拟数据）。',
    );
  });

  it('asks which outlet when none is named, with outlet buttons, and warns about a paused one', () => {
    const reply = ask('How long is the wait?', 'en');
    expect(reply.notes).toContain('vendor_unknown');
    expect(reply.suggestions.length).toBeGreaterThanOrEqual(3);
    expect(reply.suggestions.length).toBeLessThanOrEqual(5);
    expect(reply.suggestions.map((chip) => chip.label)).toContain('Main Canteen');
    expect(ask('Deli wait?', 'en').lines.join(' ')).toContain('paused');
    expect(ask('wait at iCafe', 'en').lines.join(' ')).toContain('closed now');
  });

  it('finds an outlet by its English name only, ignoring case, punctuation and accents', () => {
    expect(findVendor('wait at MAIN canteen??', VENDORS)?.name).toBe('Main Canteen');
    expect(findVendor('cafe@cva commons wait', VENDORS)?.name).toBe('Café@CVA Commons');
    expect(findVendor('the hot food counter', VENDORS)?.name).toContain('H.F.C.');
    expect(findVendor('somewhere else', VENDORS)).toBeNull();
  });

  it('shows the best matches and marks items whose tags are unverified', () => {
    const en = ask('What can I eat before my next class?', 'en');
    expect(en.items.map((item) => item.id)).toEqual(['a', 'b', 'c']);
    expect(en.items[1]?.text).toContain('Not verified');
    expect(en.items[0]?.text).not.toContain('Not verified');
    expect(en.items[0]?.text).toBe(
      'Dish a at Main Canteen: HK$32, wait 6 to 12 min, leave at 12:19',
    );
    expect(en.lines.join(' ')).toContain('ready before your next class');
    const tc = ask('下一節課前有什麼可以吃？', 'zh_HK');
    expect(tc.items[1]?.text).toContain('未驗證 (Not verified)');
    expect(tc.items[0]?.text).toBe('Dish a（Main Canteen）: HK$32, 等候 6 至 12 分鐘, 12:19 出發');
    const sc = ask('下一节课前有什么可以吃？', 'zh_CN');
    expect(sc.items[1]?.text).toContain('未验证 (Not verified)');
    expect(sc.items[1]?.text).toContain('现在出发');
  });

  it('reports the order status from the own orders only', () => {
    expect(ask('Where is my order?', 'en').lines[0]).toBe(
      'Your order at Bistro NTT: Preparing. Predicted ready between 12:20 and 12:25.',
    );
    expect(ask('我的訂單好了嗎？', 'zh_HK').lines[0]).toBe(
      '你在 Bistro NTT 的訂單：製作中。預計 12:20 至 12:25 之間完成。',
    );
    expect(ask('我的订单做好了吗？', 'zh_CN').lines[0]).toBe(
      '你在 Bistro NTT 的订单：制作中。预计 12:20 至 12:25 之间完成。',
    );
    expect(ask('where is my order', 'en', { ...DATA, orders: [] }).lines[0]).toBe(
      'You have no orders yet.',
    );
  });

  it('reports the wallet balance', () => {
    expect(ask('How much is left in my wallet?', 'en').lines[0]).toBe(
      'Your wallet balance is HK$300 (demo money).',
    );
    expect(ask('我的錢包還有多少錢？', 'zh_HK').lines[0]).toBe(
      '你的錢包餘額是 HK$300（示範用的模擬金額）。',
    );
    expect(ask('我的钱包还有多少钱？', 'zh_CN').lines[0]).toBe(
      '你的钱包余额是 HK$300（演示用的模拟金额）。',
    );
  });

  it('says when to leave from the active order, or from the top pick when there is none', () => {
    expect(ask('When should I leave?', 'en').lines[0]).toContain(
      'Predicted ready between 12:20 and 12:25',
    );
    const ready: ChatOrder = { ...(ORDERS[0] as ChatOrder), status: 'ready' };
    expect(ask('When should I leave?', 'en', { ...DATA, orders: [ready] }).lines[0]).toContain(
      'ready now',
    );
    expect(ask('我幾時出發？', 'zh_HK', { ...DATA, orders: [ready] }).lines[0]).toContain('已完成');
    const none = ask('When should I leave?', 'en', { ...DATA, orders: [] });
    expect(none.lines[0]).toBe(
      'You have no active order. For the top pick, Dish a at Main Canteen: leave at 12:19.',
    );
    expect(ask('我什么时候出发？', 'zh_CN', { ...DATA, orders: [] }).lines[0]).toContain(
      '12:19 出发',
    );
  });

  it('explains how to order with the real button names', () => {
    for (const language of CHAT_LANGUAGES) {
      const reply = ask(defaultSuggestions(language)[4]?.query ?? '', language);
      expect(reply.intent).toBe('how_to_order');
      expect(reply.lines).toHaveLength(4);
      expect(reply.lines.join(' ')).toContain('Add to cart');
      expect(reply.lines.join(' ')).toContain('Pick a slot');
    }
  });
});

const FALLBACK_LABEL = {
  en: 'Show food without the halal filter',
  zh_HK: '不套用清真條件，顯示食物',
  zh_CN: '不套用清真条件，显示食物',
} as const;

const HALAL_QUESTIONS = [
  ['Is there any halal food?', 'en'],
  ['有清真食物嗎？', 'zh_HK'],
  ['有清真食物吗？', 'zh_CN'],
] as const;

describe('halal and Not verified', () => {
  const noHalal: ChatData = {
    ...DATA,
    foods: { items: [], emptyState: 'halal_unconfirmed' },
    foodsWithoutDiet: FOODS,
  };

  const press = (first: ChatReply, language: ChatLanguage, data: ChatData): ChatReply =>
    ask(first.suggestions[0]?.query ?? '', language, data);

  it('says plainly that nothing is confirmed halal, in each language, with the dashboard sentence', () => {
    const en = ask('Is there any halal food?', 'en', noHalal);
    expect(en.lines).toContain(HALAL_NONE_CONFIRMED_TEXT);
    expect(en.notes).toEqual(
      expect.arrayContaining(['halal_none_confirmed', 'halal_not_verified']),
    );
    expect(ask('有清真食物嗎？', 'zh_HK', noHalal).lines).toContain(
      '目前沒有任何菜式獲確認為清真。這需要由檔主自行確認，我們不會猜測。',
    );
    expect(ask('有清真食物吗？', 'zh_CN', noHalal).lines).toContain(
      '目前没有任何菜式获确认为清真。这需要由档主自行确认，我们不会猜测。',
    );
  });

  it('shows no dish at all and offers a button to show food without the halal filter', () => {
    for (const [text, language] of HALAL_QUESTIONS) {
      const reply = ask(text, language, noHalal);
      expect(reply.items).toEqual([]);
      expect(reply.notes).toEqual(
        expect.arrayContaining([
          'halal_none_confirmed',
          'halal_not_verified',
          'halal_fallback_offered',
        ]),
      );
      expect(reply.suggestions[0]?.label).toBe(FALLBACK_LABEL[language]);
      expect(reply.suggestions.length).toBeGreaterThanOrEqual(3);
      expect(requestsFor(matchIntent(text)).map((request) => request.key)).toEqual(['foods']);
    }
  });

  it('shows the list only after the button is pressed, with the same notes', () => {
    const none = {
      en: 'None of them is confirmed halal:',
      zh_HK: '其中沒有任何菜式獲確認為清真',
      zh_CN: '其中没有任何菜式获确认为清真',
    };
    for (const [text, language] of HALAL_QUESTIONS) {
      const first = ask(text, language, noHalal);
      const second = press(first, language, noHalal);
      expect(second.intent).toBe('find_food');
      expect(second.items.map((item) => item.id)).toEqual(['a', 'b', 'c']);
      expect(second.notes).toEqual(
        expect.arrayContaining(['halal_none_confirmed', 'halal_not_verified']),
      );
      expect(second.notes).not.toContain('halal_fallback_offered');
      expect(second.lines.join(' ')).toContain(none[language]);
      expect(second.suggestions.map((chip) => chip.label)).not.toContain(FALLBACK_LABEL[language]);
      expect(requestsFor(matchIntent(first.suggestions[0]?.query ?? '')).map((r) => r.key)).toEqual(
        ['foods', 'foodsWithoutDiet'],
      );
    }
  });

  it('shows Not verified exactly, with the Chinese first and the English in brackets', () => {
    expect(notVerifiedText('en')).toBe('Not verified');
    expect(notVerifiedText('zh_HK')).toBe('未驗證 (Not verified)');
    expect(notVerifiedText('zh_CN')).toBe('未验证 (Not verified)');
    expect(ask('halal food', 'zh_HK', noHalal).lines.join('')).toContain(
      '清真：未驗證 (Not verified)',
    );
    expect(ask('halal food', 'zh_CN', noHalal).lines.join('')).toContain(
      '清真：未验证 (Not verified)',
    );
    expect(ask('halal food', 'en', noHalal).lines.join(' ')).toContain('Halal: Not verified');
  });

  it('lists halal dishes, with the vendor-confirmed line and no button, once the data has them', () => {
    const confirmed: ChatData = { ...DATA, foods: { items: [food('h1')], emptyState: null } };
    for (const [text, language] of HALAL_QUESTIONS) {
      const reply = ask(text, language, confirmed);
      expect(reply.items.map((item) => item.id)).toEqual(['h1']);
      expect(reply.notes).not.toContain('halal_none_confirmed');
      expect(reply.notes).not.toContain('halal_fallback_offered');
      expect(reply.suggestions.map((chip) => chip.label)).not.toContain(FALLBACK_LABEL[language]);
    }
    expect(ask('halal food', 'en', confirmed).lines).toContain(
      'These dishes have tags confirmed by the vendor owner:',
    );
  });

  it('still honours "without the halal filter" when a dish was confirmed in the meantime', () => {
    const confirmed: ChatData = {
      ...DATA,
      foods: { items: [food('h1')], emptyState: null },
      foodsWithoutDiet: FOODS,
    };
    const reply = ask('Show food without the halal filter', 'en', confirmed);
    expect(reply.items.map((item) => item.id)).toEqual(['a', 'b', 'c']);
    expect(reply.lines).not.toContain('These dishes have tags confirmed by the vendor owner:');
    expect(reply.notes).not.toContain('halal_none_confirmed');
  });

  it('never claims a diet or allergen fact when the list is empty', () => {
    const none: ChatData = { ...DATA, foods: { items: [], emptyState: null } };
    const reply = ask('vegan food without peanuts', 'en', none);
    expect(reply.items).toEqual([]);
    expect(reply.notes).toContain('no_results');
    expect(joined(reply.lines)).not.toMatch(/\b(safe|free of|contains no)\b/i);
  });
});

describe('the show-food-without-halal button', () => {
  const originals = [
    'I have 20 min, under 40 HKD, something spicy and halal',
    'halal food under 30 HKD',
    'vegan halal food without peanuts before my next class',
    'no pork halal 15 min',
  ];

  it('asks for the same filters again in every language, with only the halal filter off', () => {
    for (const original of originals) {
      const before = matchIntent(original);
      for (const language of CHAT_LANGUAGES) {
        const button = halalFallbackSuggestion(language, before.slots);
        const after = matchIntent(button.query);
        expect(after.intent, button.query).toBe('find_food');
        expect(after.slots, button.query).toEqual({ ...before.slots, halalFallback: true });
      }
    }
  });

  it('drops only halal from the request for the list, and keeps any other diet', () => {
    const slots = matchIntent('vegan halal food under 30 HKD').slots;
    const press = matchIntent(halalFallbackSuggestion('en', slots).query);
    const [halalRequest, listRequest] = requestsFor(press);
    const diets = (path: string | undefined): string | null =>
      new URL(path ?? '', 'http://x').searchParams.get('diet');
    expect(diets(halalRequest?.path)).toBe('halal,vegan');
    expect(diets(listRequest?.path)).toBe('vegan');
    expect(new URL(listRequest?.path ?? '', 'http://x').searchParams.get('maxPrice')).toBe('30');
  });

  it('is recognised when typed in any of the three languages', () => {
    for (const language of CHAT_LANGUAGES) {
      const match = matchIntent(FALLBACK_LABEL[language]);
      expect(match.intent).toBe('find_food');
      expect(match.slots.halalFallback).toBe(true);
      expect(match.slots.diets).toEqual(['halal']);
    }
  });
});

describe('the question: 20 min, under 40 HKD, something spicy and halal', () => {
  const english = 'I have 20 min, under 40 HKD, something spicy and halal';
  const traditional = '我有20分鐘，預算40港幣以內，想要辣的清真食物';
  const simplified = '我有20分钟，预算40港币以内，想要辣的清真食物';
  const fallbackItems = [food('p1'), food('p2', { tagsStatus: 'unverified' })];
  const data: ChatData = {
    ...DATA,
    foods: { items: [], emptyState: 'halal_unconfirmed' },
    foodsWithoutDiet: { items: fallbackItems, emptyState: null },
  };
  const press = (first: ChatReply, language: ChatLanguage, d: ChatData = data): ChatReply =>
    ask(first.suggestions[0]?.query ?? '', language, d);

  it('first asks the app only for the halal list with the time and price it understood', () => {
    expect(requestsFor(matchIntent(english))).toEqual([
      { key: 'foods', path: '/api/menu-items?maxWait=20&maxPrice=40&diet=halal' },
    ]);
  });

  it('shows no dish, says it cannot filter by spicy, says halal is not verified, and offers the button', () => {
    const reply = ask(english, 'en', data);
    expect(reply.items).toEqual([]);
    expect(reply.notes).toEqual(
      expect.arrayContaining([
        'cannot_filter_spicy',
        'halal_not_verified',
        'halal_none_confirmed',
        'halal_fallback_offered',
      ]),
    );
    const text = joined(reply.lines);
    expect(text).toContain('Applied: wait of 20 min or less, price HK$40 or less.');
    expect(text).toContain('I cannot filter by spicy: the menu data has no spice information.');
    expect(text).toContain('Halal: Not verified, so I am not showing any dish as halal.');
    expect(reply.suggestions[0]).toEqual({
      label: 'Show food without the halal filter',
      query: 'Show food without the halal filter, 20 min, under 40 HKD, spicy',
    });
  });

  it('shows only what the data supports once the button is pressed, with the same notes', () => {
    const second = press(ask(english, 'en', data), 'en');
    const text = joined(second.lines, second.items);
    expect(requestsFor(matchIntent(ask(english, 'en', data).suggestions[0]?.query ?? ''))).toEqual([
      { key: 'foods', path: '/api/menu-items?maxWait=20&maxPrice=40&diet=halal' },
      { key: 'foodsWithoutDiet', path: '/api/menu-items?maxWait=20&maxPrice=40' },
    ]);
    expect(second.notes).toEqual(
      expect.arrayContaining(['cannot_filter_spicy', 'halal_not_verified', 'halal_none_confirmed']),
    );
    expect(text).toContain('Applied: wait of 20 min or less, price HK$40 or less.');
    expect(text).toContain('I cannot filter by spicy: the menu data has no spice information.');
    expect(text).toContain('Halal: Not verified. I did not apply it to the list below.');
    expect(text).toContain('None of them is confirmed halal');
    expect(second.items.map((item) => item.id)).toEqual(['p1', 'p2']);
    expect(second.items[1]?.text).toContain('Not verified');
    expect(text).not.toMatch(/halal ✓|is halal\b/i);
  });

  it('gives the Traditional Chinese answers with 未驗證 first and Not verified in brackets', () => {
    const first = ask(traditional, 'zh_HK', data);
    const firstText = joined(first.lines);
    expect(first.items).toEqual([]);
    expect(firstText).toContain('我無法按辣度篩選：菜單資料沒有辣度資訊。');
    expect(firstText).toContain('清真：未驗證 (Not verified)，所以我不會把任何菜式顯示為清真。');
    expect(first.suggestions[0]?.label).toBe('不套用清真條件，顯示食物');
    const secondText = joined(press(first, 'zh_HK').lines);
    expect(secondText).toContain('已套用：等候 20 分鐘或以內、價格 HK$40 或以下。');
    expect(secondText).toContain('清真：未驗證 (Not verified)。');
    expect(secondText).toContain('其中沒有任何菜式獲確認為清真');
  });

  it('gives the Simplified Chinese answers with 未验证 first and Not verified in brackets', () => {
    const first = ask(simplified, 'zh_CN', data);
    const firstText = joined(first.lines);
    expect(first.items).toEqual([]);
    expect(firstText).toContain('我无法按辣度筛选：菜单数据没有辣度信息。');
    expect(firstText).toContain('清真：未验证 (Not verified)，所以我不会把任何菜式显示为清真。');
    expect(first.suggestions[0]?.label).toBe('不套用清真条件，显示食物');
    const secondText = joined(press(first, 'zh_CN').lines);
    expect(secondText).toContain('已套用：等候 20 分钟或以内、价格 HK$40 或以下。');
    expect(secondText).toContain('清真：未验证 (Not verified)。');
  });

  it('gives identical results in both Chinese scripts and in English apart from the wording, at both steps', () => {
    const firsts = [
      ask(english, 'en', data),
      ask(traditional, 'zh_HK', data),
      ask(simplified, 'zh_CN', data),
    ];
    const languages = ['en', 'zh_HK', 'zh_CN'] as const;
    const seconds = firsts.map((first, index) => press(first, languages[index] ?? 'en'));
    for (const group of [firsts, seconds]) {
      const [en, ...others] = group;
      for (const other of others) {
        expect(other.intent).toBe(en?.intent);
        expect(other.notes).toEqual(en?.notes);
        expect(other.items.map((item) => item.id)).toEqual(en?.items.map((item) => item.id));
        expect(other.lines).toHaveLength(en?.lines.length ?? -1);
      }
    }
    const buttonSlots = firsts.map((first) => matchIntent(first.suggestions[0]?.query ?? '').slots);
    expect(buttonSlots[1]).toEqual(buttonSlots[0]);
    expect(buttonSlots[2]).toEqual(buttonSlots[0]);
    expect(matchIntent(traditional).slots).toEqual(matchIntent(simplified).slots);
    expect(requestsFor(matchIntent(traditional))).toEqual(requestsFor(matchIntent(simplified)));
    const plain = (text: string): string => text.replace(/[^\x20-\x7e]/g, '');
    expect(seconds[1]?.items.map((item) => plain(item.text))).toEqual(
      seconds[2]?.items.map((item) => plain(item.text)),
    );
  });

  it('shows nothing invented when there is no dish either', () => {
    const empty: ChatData = { ...data, foodsWithoutDiet: { items: [], emptyState: null } };
    const reply = press(ask(english, 'en', empty), 'en', empty);
    expect(reply.items).toEqual([]);
    expect(reply.notes).toContain('no_results');
    expect(reply.suggestions.length).toBeGreaterThanOrEqual(3);
  });

  it('after a vendor confirmed a halal dish, lists it and drops the "not verified" line and the button', () => {
    const confirmed: ChatData = {
      ...DATA,
      foods: { items: [food('cola', { priceHkd: 18 })], emptyState: null },
    };
    for (const [text, language] of [
      [english, 'en'],
      [traditional, 'zh_HK'],
      [simplified, 'zh_CN'],
    ] as const) {
      const reply = ask(text, language, confirmed);
      expect(reply.items.map((item) => item.id)).toEqual(['cola']);
      expect(reply.notes).toContain('cannot_filter_spicy');
      expect(reply.notes).not.toContain('halal_not_verified');
      expect(reply.notes).not.toContain('halal_fallback_offered');
      expect(joined(reply.lines)).not.toMatch(/Halal: Not verified|清真：未驗證|清真：未验证/);
      expect(reply.suggestions.map((chip) => chip.label)).not.toContain(FALLBACK_LABEL[language]);
    }
  });
});

describe('when it does not understand', () => {
  it('replies with a short message and 3 to 5 suggestions in the same language, never blank', () => {
    for (const language of CHAT_LANGUAGES) {
      const reply = ask(language === 'en' ? 'Tell me a joke' : '講個笑話給我聽', language);
      expect(reply.intent).toBe('unknown');
      expect(reply.lines.join('').length).toBeGreaterThan(10);
      expect(reply.suggestions.length).toBeGreaterThanOrEqual(3);
      expect(reply.suggestions.length).toBeLessThanOrEqual(5);
      for (const chip of reply.suggestions) {
        expect(HAN.test(chip.query)).toBe(language !== 'en');
        expect(chip.label.length).toBeGreaterThan(0);
      }
      expect(HAN.test(reply.lines.join(''))).toBe(language !== 'en');
    }
  });

  it('shows the suggestions on a greeting and replies to a data error without an error message', () => {
    for (const language of CHAT_LANGUAGES) {
      const hello = ask(language === 'en' ? 'hello' : '你好', language);
      expect(hello.suggestions).toHaveLength(5);
      const failed = dataErrorReply(language);
      expect(failed.notes).toEqual(['data_error']);
      expect(failed.suggestions).toHaveLength(5);
      expect(failed.lines.join('')).not.toMatch(/undefined|null|error/i);
    }
  });

  it('answers a data error for every intent that needs data', () => {
    const empty: ChatData = { nowMs: NOW };
    for (const text of [
      'open now',
      'wait at Main Canteen',
      'food',
      'my order',
      'wallet',
      'when should I leave',
    ]) {
      expect(ask(text, 'en', empty).notes).toContain('data_error');
    }
  });
});

describe("another student's order", () => {
  it('is refused in every language without touching any data', () => {
    const asks = [
      ["Show my friend's order", 'en'],
      ['可以看朋友的訂單嗎？', 'zh_HK'],
      ['可以看朋友的订单吗？', 'zh_CN'],
    ] as const;
    for (const [text, language] of asks) {
      const match = matchIntent(text);
      expect(match.intent).toBe('other_order');
      expect(requestsFor(match)).toEqual([]);
      const reply = buildReply(match, DATA, language);
      expect(reply.notes).toEqual(['refused_other_order']);
      expect(reply.items).toEqual([]);
    }
  });

  it('is refused when the asked order id is not one of the own orders', () => {
    const reply = ask('status of order 0f8fad5b-d9cb-469f-a165-70867728950e', 'en');
    expect(reply.notes).toEqual(['refused_other_order']);
    expect(reply.lines.join(' ')).not.toContain('Bistro NTT');
    const own = ask('status of order own-1', 'en');
    expect(own.notes).toEqual([]);
  });
});

describe('requests', () => {
  it('only ever reads the signed-in student data from the existing endpoints', () => {
    const questions = [
      'open now',
      'wait at Main Canteen',
      'I have 20 min, under 40 HKD, something spicy and halal',
      'food without peanuts',
      'my order',
      'wallet',
      'when should I leave',
      'how do I order',
      'hello',
      'tell me a joke',
    ];
    for (const question of questions) {
      for (const request of requestsFor(matchIntent(question))) {
        expect(isAllowedChatPath(request.path)).toBe(true);
        expect(request.path.startsWith('/api/')).toBe(true);
      }
    }
    expect(isAllowedChatPath('/api/admin/clock')).toBe(false);
    expect(isAllowedChatPath('/api/orders/abc')).toBe(false);
    expect(isAllowedChatPath('https://example.com/api/orders')).toBe(false);
  });

  it('puts nothing the student typed into a request except the numbers and ids the app itself defines', () => {
    const [request] = requestsFor(matchIntent('food without peanuts and a secret word'));
    expect(request?.path).toBe('/api/menu-items?allergens=peanuts');
  });
});

describe('interface text', () => {
  it('is translated and states that nothing is stored or sent', () => {
    expect(chatUiText('en').privacy).toContain('nothing is stored or sent anywhere');
    expect(chatUiText('zh_HK').privacy).toContain('不會被儲存或傳送');
    expect(chatUiText('zh_CN').privacy).toContain('不会被保存或发送');
  });
});
