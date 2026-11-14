import { formatHktTime } from '../time.js';
import type { ChatClarify, ChatCorrection } from './correct.js';
import { DISH_MATCH_TERMS } from './lexicon.js';
import { NOT_VERIFIED_TEXT } from '../whyChips.js';
import { normalizeText } from './matcher.js';
import type {
  ChatData,
  ChatFoodItem,
  ChatFoods,
  ChatIntent,
  ChatLanguage,
  ChatMatch,
  ChatNote,
  ChatOrder,
  ChatReply,
  ChatReplyItem,
  ChatRequest,
  ChatSlots,
  ChatSuggestion,
  ChatVendor,
} from './types.js';

export const HALAL_NONE_CONFIRMED_TEXT =
  'No items are confirmed halal yet. Vendors confirm this themselves, and we never guess.';

const MAX_ITEMS = 3;
const MAX_NAMES = 8;
const HALAL_EMPTY_STATE = 'halal_unconfirmed';
const ALLOWED_PATHS = ['/api/vendors', '/api/menu-items', '/api/orders', '/api/wallet/me'];

function t<T>(language: ChatLanguage, en: T, traditional: T, simplified: T): T {
  return language === 'en' ? en : language === 'zh_HK' ? traditional : simplified;
}

export function notVerifiedText(language: ChatLanguage): string {
  return t(
    language,
    NOT_VERIFIED_TEXT,
    `未驗證 (${NOT_VERIFIED_TEXT})`,
    `未验证 (${NOT_VERIFIED_TEXT})`,
  );
}

export function isAllowedChatPath(path: string): boolean {
  const [base] = path.split('?');
  return base !== undefined && ALLOWED_PATHS.includes(base);
}

export function formatWaitText(
  language: ChatLanguage,
  lowMinutes: number,
  highMinutes: number,
): string {
  const low = Math.max(0, Math.floor(lowMinutes));
  const high = Math.max(low, Math.ceil(highMinutes));
  if (language === 'en') return low === high ? `${high} min` : `${low} to ${high} min`;
  const unit = t(language, 'min', '分鐘', '分钟');
  return low === high ? `${high} ${unit}` : `${low} 至 ${high} ${unit}`;
}

const money = (hkd: number): string => `HK$${hkd}`;

interface UiText {
  title: string;
  open: string;
  close: string;
  placeholder: string;
  send: string;
  privacy: string;
}

export function chatUiText(language: ChatLanguage): UiText {
  return {
    title: t(language, 'Assistant', '小助手', '小助手'),
    open: t(language, 'Ask', '提問', '提问'),
    close: t(language, 'Close', '關閉', '关闭'),
    placeholder: t(language, 'Ask a question', '輸入問題', '输入问题'),
    send: t(language, 'Send', '送出', '发送'),
    privacy: t(
      language,
      "Answers come from this app's data. Your questions stay in this page: nothing is stored or sent anywhere.",
      '答案只來自本應用的資料。你的問題只留在這個頁面，不會被儲存或傳送到任何地方。',
      '答案只来自本应用的数据。你的问题只留在这个页面，不会被保存或发送到任何地方。',
    ),
  };
}

export function defaultSuggestions(language: ChatLanguage): ChatSuggestion[] {
  const queries = [
    t(language, 'Which places are open now?', '現在有哪些檔口營業？', '现在哪些档口营业？'),
    t(
      language,
      'How long is the wait at Main Canteen?',
      'Main Canteen 要等多久？',
      'Main Canteen 要等多久？',
    ),
    t(
      language,
      'What can I eat before my next class?',
      '下一節課前有什麼可以吃？',
      '下一节课前有什么可以吃？',
    ),
    t(language, 'Is there any halal food?', '有清真食物嗎？', '有清真食物吗？'),
    t(language, 'How do I order?', '怎麼下單？', '怎么下单？'),
  ];
  return queries.map((query) => ({ label: query, query }));
}

const SUGGESTION_INDEX: Partial<Record<ChatIntent, number>> = {
  open_now: 0,
  wait_at_vendor: 1,
  find_food: 2,
  how_to_order: 4,
};

function followUps(language: ChatLanguage, intent: ChatIntent): ChatSuggestion[] {
  const own = SUGGESTION_INDEX[intent];
  return defaultSuggestions(language)
    .filter((_, index) => index !== own)
    .slice(0, 3);
}

function reply(
  intent: ChatIntent,
  language: ChatLanguage,
  parts: { lines: string[]; items?: ChatReplyItem[]; notes?: ChatNote[]; all?: boolean },
): ChatReply {
  return {
    intent,
    lines: parts.lines,
    items: parts.items ?? [],
    notes: parts.notes ?? [],
    suggestions: parts.all ? defaultSuggestions(language) : followUps(language, intent),
  };
}

export function halalFallbackSuggestion(language: ChatLanguage, slots: ChatSlots): ChatSuggestion {
  const buttonLabel = t(
    language,
    'Show food without the halal filter',
    '不套用清真條件，顯示食物',
    '不套用清真条件，显示食物',
  );
  const parts: string[] = [];
  if (slots.maxWaitMinutes !== null) {
    const n = slots.maxWaitMinutes;
    parts.push(t(language, `${n} min`, `${n}分鐘`, `${n}分钟`));
  }
  if (slots.maxPriceHkd !== null) {
    const p = slots.maxPriceHkd;
    parts.push(t(language, `under ${p} HKD`, `${p}港幣以內`, `${p}港币以内`));
  }
  if (slots.beforeClass) {
    parts.push(t(language, 'before my next class', '下一節課前', '下一节课前'));
  }
  if (slots.spicy) parts.push(t(language, 'spicy', '辣', '辣'));
  for (const diet of slots.diets) {
    if (diet !== 'halal') parts.push(label(language, DIET_NAMES, diet));
  }
  for (const allergen of slots.allergens) {
    const name = label(language, ALLERGEN_NAMES, allergen);
    parts.push(t(language, `without ${name}`, `不含${name}`, `不含${name}`));
  }
  const separator = t(language, ', ', '，', '，');
  return { label: buttonLabel, query: [buttonLabel, ...parts].join(separator) };
}

export function dataErrorReply(language: ChatLanguage): ChatReply {
  return reply('unknown', language, {
    lines: [
      t(
        language,
        'I could not load the data just now. Please try again in a moment.',
        '暫時無法載入資料，請稍後再試。',
        '暂时无法加载数据，请稍后再试。',
      ),
    ],
    notes: ['data_error'],
    all: true,
  });
}

const BUSY_MARK = (language: ChatLanguage): string =>
  t(language, ' (busy)', '（繁忙）', '（繁忙）');

function names(language: ChatLanguage, list: readonly string[]): string {
  const shown = list.slice(0, MAX_NAMES);
  const rest = list.length - shown.length;
  const joined = shown.join(t(language, ', ', '、', '、'));
  if (rest <= 0) return joined;
  return `${joined}${t(language, ` and ${rest} more`, `等另外 ${rest} 間`, `等另外 ${rest} 家`)}`;
}

function openNowReply(language: ChatLanguage, data: ChatData): ChatReply {
  const vendors = data.vendors;
  if (vendors === undefined) return dataErrorReply(language);
  const taking = vendors.filter((v) => v.openNow && !v.paused && v.pickupEnabled);
  const paused = vendors.filter((v) => v.openNow && v.paused);
  const closed = vendors.filter((v) => !v.openNow);
  const clock = formatHktTime(data.nowMs);
  const lines: string[] = [];
  if (taking.length > 0) {
    const labelled = taking.map(
      (v) => `${v.name}${v.busyState === 'rush' ? BUSY_MARK(language) : ''}`,
    );
    lines.push(
      t(
        language,
        `Open now (${clock}): ${names(language, labelled)}.`,
        `現在營業中（${clock}）：${names(language, labelled)}。`,
        `现在营业中（${clock}）：${names(language, labelled)}。`,
      ),
    );
  } else {
    lines.push(
      t(
        language,
        `Nothing is taking orders right now (${clock}).`,
        `現在沒有檔口接受訂單（${clock}）。`,
        `现在没有档口接受订单（${clock}）。`,
      ),
    );
  }
  if (paused.length > 0) {
    lines.push(
      t(
        language,
        `Paused, not taking orders: ${names(
          language,
          paused.map((v) => v.name),
        )}.`,
        `暫停接單：${names(
          language,
          paused.map((v) => v.name),
        )}。`,
        `暂停接单：${names(
          language,
          paused.map((v) => v.name),
        )}。`,
      ),
    );
  }
  if (closed.length > 0) {
    lines.push(
      t(
        language,
        `Closed now: ${names(
          language,
          closed.map((v) => v.name),
        )}.`,
        `目前休息：${names(
          language,
          closed.map((v) => v.name),
        )}。`,
        `目前休息：${names(
          language,
          closed.map((v) => v.name),
        )}。`,
      ),
    );
  }
  return reply('open_now', language, { lines });
}

function compact(value: string): string {
  return normalizeText(value)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

export function findVendor(text: string, vendors: readonly ChatVendor[]): ChatVendor | null {
  const haystack = compact(text);
  let best: { vendor: ChatVendor; length: number } | null = null;
  let tie = false;
  for (const vendor of vendors) {
    const candidates = [vendor.name, ...vendor.name.split(/[@(]/)]
      .map(compact)
      .filter((name, index) => index === 0 || name.length >= 5);
    const length = Math.max(
      0,
      ...candidates
        .filter((name) => name !== '' && haystack.includes(name))
        .map((name) => name.length),
    );
    if (length === 0) continue;
    if (best === null || length > best.length) {
      best = { vendor, length };
      tie = false;
    } else if (length === best.length && best.vendor.id !== vendor.id) {
      tie = true;
    }
  }
  return best === null || tie ? null : best.vendor;
}

function waitReply(language: ChatLanguage, match: ChatMatch, data: ChatData): ChatReply {
  const vendors = data.vendors;
  if (vendors === undefined) return dataErrorReply(language);
  const vendor = findVendor(match.text, vendors);
  if (vendor === null) {
    const choices = vendors.filter((v) => v.openNow && !v.paused && v.pickupEnabled).slice(0, 5);
    return {
      intent: 'wait_at_vendor',
      lines: [
        t(
          language,
          'Which outlet do you mean? Tap one, or type its English name.',
          '你指哪一間檔口？請點選，或輸入它的英文名稱。',
          '你指哪一家档口？请点选，或输入它的英文名称。',
        ),
      ],
      items: [],
      notes: ['vendor_unknown'],
      suggestions: choices.map((v) => {
        const query = t(
          language,
          `How long is the wait at ${v.name}?`,
          `${v.name} 要等多久？`,
          `${v.name} 要等多久？`,
        );
        return { label: v.name, query };
      }),
    };
  }
  const range = formatWaitText(language, vendor.wait.lowMinutes, vendor.wait.highMinutes);
  const lines = [
    t(
      language,
      `${vendor.name}: about ${range} right now. This is an estimate from simulated data.`,
      `${vendor.name} 目前約需 ${range}（估算，使用模擬數據）。`,
      `${vendor.name} 目前约需 ${range}（估算，使用模拟数据）。`,
    ),
  ];
  if (!vendor.openNow) {
    lines.push(t(language, 'It is closed now.', '它目前休息中。', '它目前休息中。'));
  } else if (vendor.paused) {
    lines.push(
      t(language, 'It is paused and not taking orders.', '它目前暫停接單。', '它目前暂停接单。'),
    );
  } else if (vendor.busyState === 'rush') {
    lines.push(t(language, 'It is busy at the moment.', '它目前很繁忙。', '它目前很繁忙。'));
  }
  return reply('wait_at_vendor', language, { lines });
}

function itemText(language: ChatLanguage, item: ChatFoodItem): string {
  const range = formatWaitText(language, item.wait.lowMinutes, item.wait.highMinutes);
  const leave = item.leaveNow
    ? t(language, 'leave now', '現在出發', '现在出发')
    : t(
        language,
        `leave at ${formatHktTime(item.leaveAt)}`,
        `${formatHktTime(item.leaveAt)} 出發`,
        `${formatHktTime(item.leaveAt)} 出发`,
      );
  const wait = t(language, 'wait', '等候', '等候');
  const where = t(
    language,
    `${item.name} at ${item.vendorName}`,
    `${item.name}（${item.vendorName}）`,
    `${item.name}（${item.vendorName}）`,
  );
  const mark = item.tagsStatus === 'unverified' ? ` · ${notVerifiedText(language)}` : '';
  return `${where}: ${money(item.priceHkd)}, ${wait} ${range}, ${leave}${mark}`;
}

function toItems(language: ChatLanguage, foods: ChatFoods): ChatReplyItem[] {
  return foods.items
    .slice(0, MAX_ITEMS)
    .map((item) => ({ id: item.id, text: itemText(language, item) }));
}

const DIET_NAMES: Record<string, [string, string, string]> = {
  halal: ['halal', '清真', '清真'],
  vegan: ['vegan', '純素', '纯素'],
  vegetarian: ['vegetarian', '素食', '素食'],
  no_pork: ['no pork', '不含豬肉', '不含猪肉'],
  no_beef: ['no beef', '不含牛肉', '不含牛肉'],
  gluten_free: ['gluten free', '無麩質', '无麸质'],
  dairy_free: ['dairy free', '無乳製品', '无乳制品'],
};

const ALLERGEN_NAMES: Record<string, [string, string, string]> = {
  nuts: ['nuts', '堅果', '坚果'],
  peanuts: ['peanuts', '花生', '花生'],
  seafood: ['seafood', '海鮮', '海鲜'],
  shellfish: ['shellfish', '貝類甲殼類', '贝类甲壳类'],
  egg: ['egg', '蛋', '蛋'],
  soy: ['soy', '大豆', '大豆'],
  sesame: ['sesame', '芝麻', '芝麻'],
  dairy: ['dairy', '奶類', '奶类'],
  gluten: ['gluten', '麩質', '麸质'],
};

function label(
  language: ChatLanguage,
  table: Record<string, [string, string, string]>,
  id: string,
): string {
  const entry = table[id];
  if (entry === undefined) return id;
  return t(language, entry[0], entry[1], entry[2]);
}

function withDishes(foods: ChatFoods, dishes: readonly string[]): ChatFoods {
  if (dishes.length === 0) return foods;
  const terms = dishes.flatMap((dish) => DISH_MATCH_TERMS[dish] ?? []);
  return {
    ...foods,
    items: foods.items.filter((item) =>
      terms.some((term) => item.name.toLowerCase().includes(term)),
    ),
  };
}

function foodReply(language: ChatLanguage, match: ChatMatch, data: ChatData): ChatReply {
  if (data.foods === undefined) return dataErrorReply(language);
  const foods = withDishes(data.foods, match.dishes);
  const { slots } = match;
  const notes: ChatNote[] = [];
  const lines: string[] = [];

  const halalAsked = slots.diets.includes('halal');
  const halalUnconfirmed =
    halalAsked && data.foods.items.length === 0 && data.foods.emptyState === HALAL_EMPTY_STATE;

  const applied: string[] = [];
  if (slots.maxWaitMinutes !== null) {
    applied.push(
      t(
        language,
        `wait of ${slots.maxWaitMinutes} min or less`,
        `等候 ${slots.maxWaitMinutes} 分鐘或以內`,
        `等候 ${slots.maxWaitMinutes} 分钟或以内`,
      ),
    );
  }
  if (slots.maxPriceHkd !== null) {
    applied.push(
      t(
        language,
        `price ${money(slots.maxPriceHkd)} or less`,
        `價格 ${money(slots.maxPriceHkd)} 或以下`,
        `价格 ${money(slots.maxPriceHkd)} 或以下`,
      ),
    );
  }
  if (slots.beforeClass) {
    applied.push(t(language, 'ready before your next class', '趕得及下一節課', '赶得及下一节课'));
  }
  for (const dish of match.dishes) applied.push(dish);
  if (match.sort === 'lowest_price') {
    applied.push(t(language, 'cheapest first', '最便宜優先', '最便宜优先'));
  }
  if (match.sort === 'lowest_wait') {
    applied.push(t(language, 'shortest wait first', '等候最短優先', '等候最短优先'));
  }
  for (const diet of slots.diets) {
    if (diet === 'halal' && (halalUnconfirmed || slots.halalFallback)) continue;
    applied.push(label(language, DIET_NAMES, diet));
  }
  for (const allergen of slots.allergens) {
    applied.push(
      t(
        language,
        `without ${label(language, ALLERGEN_NAMES, allergen)}`,
        `不含${label(language, ALLERGEN_NAMES, allergen)}`,
        `不含${label(language, ALLERGEN_NAMES, allergen)}`,
      ),
    );
  }
  if (applied.length > 0) {
    lines.push(
      t(
        language,
        `Applied: ${applied.join(', ')}.`,
        `已套用：${applied.join('、')}。`,
        `已套用：${applied.join('、')}。`,
      ),
    );
  }

  if (slots.spicy) {
    notes.push('cannot_filter_spicy');
    lines.push(
      t(
        language,
        'I cannot filter by spicy: the menu data has no spice information.',
        '我無法按辣度篩選：菜單資料沒有辣度資訊。',
        '我无法按辣度筛选：菜单数据没有辣度信息。',
      ),
    );
  }

  if (halalUnconfirmed) {
    notes.push('halal_none_confirmed', 'halal_not_verified');
    lines.push(
      t(
        language,
        HALAL_NONE_CONFIRMED_TEXT,
        '目前沒有任何菜式獲確認為清真。這需要由檔主自行確認，我們不會猜測。',
        '目前没有任何菜式获确认为清真。这需要由档主自行确认，我们不会猜测。',
      ),
    );
    if (!slots.halalFallback) {
      notes.push('halal_fallback_offered');
      lines.push(
        t(
          language,
          `Halal: ${notVerifiedText(language)}, so I am not showing any dish as halal.`,
          `清真：${notVerifiedText(language)}，所以我不會把任何菜式顯示為清真。`,
          `清真：${notVerifiedText(language)}，所以我不会把任何菜式显示为清真。`,
        ),
      );
      return {
        intent: 'find_food',
        lines,
        items: [],
        notes,
        suggestions: [
          halalFallbackSuggestion(language, slots),
          ...followUps(language, 'find_food').slice(0, 2),
        ],
      };
    }
    lines.push(
      t(
        language,
        `Halal: ${notVerifiedText(language)}. I did not apply it to the list below.`,
        `清真：${notVerifiedText(language)}。我沒有把這項條件套用到下面的清單。`,
        `清真：${notVerifiedText(language)}。我没有把这项条件套用到下面的清单。`,
      ),
    );
    const fallback = data.foodsWithoutDiet;
    if (fallback === undefined) return dataErrorReply(language);
    const items = toItems(language, withDishes(fallback, match.dishes));
    if (items.length === 0) {
      notes.push('no_results');
      lines.push(
        t(
          language,
          'Nothing else matches your time and price right now.',
          '目前也沒有符合你時間與價格的菜式。',
          '目前也没有符合你时间与价格的菜式。',
        ),
      );
      return reply('find_food', language, { lines, notes, all: true });
    }
    lines.push(
      t(
        language,
        'Without the halal filter, these match your time and price. None of them is confirmed halal:',
        '不套用清真條件時，以下符合你的時間與價格，其中沒有任何菜式獲確認為清真：',
        '不套用清真条件时，以下符合你的时间与价格，其中没有任何菜式获确认为清真：',
      ),
    );
    return reply('find_food', language, { lines, items, notes });
  }

  const source =
    slots.halalFallback && halalAsked && data.foodsWithoutDiet !== undefined
      ? withDishes(data.foodsWithoutDiet, match.dishes)
      : foods;
  const items = toItems(language, source);
  if (items.length === 0) {
    notes.push('no_results');
    lines.push(
      t(
        language,
        'No dishes match all of that right now.',
        '目前沒有菜式符合以上全部條件。',
        '目前没有菜式符合以上全部条件。',
      ),
    );
    return reply('find_food', language, { lines, notes, all: true });
  }
  const filtered =
    slots.allergens.length > 0 ||
    slots.diets.some((diet) => !(diet === 'halal' && slots.halalFallback));
  lines.push(
    filtered
      ? t(
          language,
          'These dishes have tags confirmed by the vendor owner:',
          '以下菜式的標籤已由檔主確認：',
          '以下菜式的标签已由档主确认：',
        )
      : t(language, 'Best matches right now:', '目前最合適的選擇：', '目前最合适的选择：'),
  );
  return reply('find_food', language, { lines, items, notes });
}

const STATUS_TEXT: Record<ChatOrder['status'], [string, string, string]> = {
  placed: ['Placed', '已下單', '已下单'],
  accepted: ['Accepted', '已接單', '已接单'],
  preparing: ['Preparing', '製作中', '制作中'],
  ready: ['Ready', '可取餐', '可取餐'],
  completed: ['Completed', '已完成', '已完成'],
  picked_up: ['Picked up', '已取餐', '已取餐'],
  cancelled: ['Cancelled', '已取消', '已取消'],
};

const ACTIVE: readonly ChatOrder['status'][] = ['placed', 'accepted', 'preparing', 'ready'];

function statusLine(language: ChatLanguage, order: ChatOrder): string {
  const entry = STATUS_TEXT[order.status];
  const status = t(language, entry[0], entry[1], entry[2]);
  const predicted =
    order.status === 'ready' ||
    order.status === 'completed' ||
    order.status === 'picked_up' ||
    order.status === 'cancelled'
      ? ''
      : t(
          language,
          ` Predicted ready between ${formatHktTime(order.predicted.low)} and ${formatHktTime(order.predicted.high)}.`,
          `預計 ${formatHktTime(order.predicted.low)} 至 ${formatHktTime(order.predicted.high)} 之間完成。`,
          `预计 ${formatHktTime(order.predicted.low)} 至 ${formatHktTime(order.predicted.high)} 之间完成。`,
        );
  return t(
    language,
    `Your order at ${order.vendorName}: ${status}.${predicted}`,
    `你在 ${order.vendorName} 的訂單：${status}。${predicted}`,
    `你在 ${order.vendorName} 的订单：${status}。${predicted}`,
  );
}

export function refusalReply(language: ChatLanguage): ChatReply {
  return reply('other_order', language, {
    lines: [
      t(
        language,
        "I can only show your own orders, so I can't look up anyone else's order.",
        '我只能顯示你自己的訂單，無法查詢其他人的訂單。',
        '我只能显示你自己的订单，无法查询其他人的订单。',
      ),
    ],
    notes: ['refused_other_order'],
    all: true,
  });
}

function orderReply(language: ChatLanguage, match: ChatMatch, data: ChatData): ChatReply {
  const orders = data.orders;
  if (orders === undefined) return dataErrorReply(language);
  if (match.slots.orderId !== null && !orders.some((order) => order.id === match.slots.orderId)) {
    return refusalReply(language);
  }
  if (orders.length === 0) {
    return reply('order_status', language, {
      lines: [t(language, 'You have no orders yet.', '你還沒有任何訂單。', '你还没有任何订单。')],
    });
  }
  const active = orders.filter((order) => ACTIVE.includes(order.status));
  const shown = active.length > 0 ? active : orders.slice(0, 1);
  return reply('order_status', language, {
    lines: shown.map((order) => statusLine(language, order)),
  });
}

function walletReply(language: ChatLanguage, data: ChatData): ChatReply {
  if (data.walletHkd === undefined) return dataErrorReply(language);
  const amount = money(data.walletHkd);
  return reply('wallet', language, {
    lines: [
      t(
        language,
        `Your wallet balance is ${amount} (demo money).`,
        `你的錢包餘額是 ${amount}（示範用的模擬金額）。`,
        `你的钱包余额是 ${amount}（演示用的模拟金额）。`,
      ),
    ],
  });
}

function leaveReply(language: ChatLanguage, data: ChatData): ChatReply {
  const orders = data.orders;
  if (orders === undefined) return dataErrorReply(language);
  const active = orders.find((order) => ACTIVE.includes(order.status));
  if (active !== undefined) {
    if (active.status === 'ready') {
      return reply('leave_time', language, {
        lines: [
          t(
            language,
            `Your order at ${active.vendorName} is ready now. You can go and pick it up.`,
            `你在 ${active.vendorName} 的訂單已完成，可以去取餐了。`,
            `你在 ${active.vendorName} 的订单已完成，可以去取餐了。`,
          ),
        ],
      });
    }
    return reply('leave_time', language, { lines: [statusLine(language, active)] });
  }
  const top = data.foods?.items[0];
  if (top === undefined) {
    return reply('leave_time', language, {
      lines: [
        t(
          language,
          'You have no active order, and I have no dish to suggest right now.',
          '你目前沒有進行中的訂單，我也暫時沒有可建議的菜式。',
          '你目前没有进行中的订单，我也暂时没有可建议的菜式。',
        ),
      ],
      all: true,
    });
  }
  const when = top.leaveNow
    ? t(language, 'leave now', '現在出發', '现在出发')
    : t(
        language,
        `leave at ${formatHktTime(top.leaveAt)}`,
        `${formatHktTime(top.leaveAt)} 出發`,
        `${formatHktTime(top.leaveAt)} 出发`,
      );
  return reply('leave_time', language, {
    lines: [
      t(
        language,
        `You have no active order. For the top pick, ${top.name} at ${top.vendorName}: ${when}.`,
        `你目前沒有進行中的訂單。以最推薦的 ${top.name}（${top.vendorName}）為例：${when}。`,
        `你目前没有进行中的订单。以最推荐的 ${top.name}（${top.vendorName}）为例：${when}。`,
      ),
    ],
  });
}

function howToReply(language: ChatLanguage): ChatReply {
  return reply('how_to_order', language, {
    lines: [
      t(
        language,
        '1. Pick a dish on the home screen and tap Add to cart.',
        '1. 在主頁選擇菜式，按 Add to cart。',
        '1. 在主页选择菜式，按 Add to cart。',
      ),
      t(
        language,
        '2. Open Cart, then choose As soon as ready or Pick a slot.',
        '2. 打開 Cart，選擇 As soon as ready（盡快）或 Pick a slot（預約時段）。',
        '2. 打开 Cart，选择 As soon as ready（尽快）或 Pick a slot（预约时段）。',
      ),
      t(language, '3. Pay with your demo wallet.', '3. 用示範錢包付款。', '3. 用演示钱包付款。'),
      t(
        language,
        '4. Follow the order status and go when it says Ready.',
        '4. 留意訂單狀態，顯示 Ready 後就可以去取餐。',
        '4. 留意订单状态，显示 Ready 后就可以去取餐。',
      ),
    ],
  });
}

function helpReply(language: ChatLanguage): ChatReply {
  return reply('help', language, {
    lines: [
      t(
        language,
        'Hi! I can answer questions about open outlets, waits, food that fits your time, your orders and your wallet. Try one of these:',
        '你好！我可以回答營業中的檔口、等候時間、符合你時間的食物、你的訂單和錢包。試試這些問題：',
        '你好！我可以回答营业中的档口、等候时间、符合你时间的食物、你的订单和钱包。试试这些问题：',
      ),
    ],
    all: true,
  });
}

const FALLBACK_EXAMPLES = 4;

function unknownReply(language: ChatLanguage): ChatReply {
  return {
    intent: 'unknown',
    lines: [
      t(
        language,
        'I could not match that to anything I can answer. I only answer from this app: open outlets, waits, food that fits your time, your orders and your wallet. Tap one of these questions, or ask in your own words:',
        '我無法把這個問題對應到我能回答的內容。我只根據本應用的資料回答：營業中的檔口、等候時間、符合你時間的食物、你的訂單和錢包。請點選下面的問題，或用自己的話再問一次：',
        '我无法把这个问题对应到我能回答的内容。我只根据本应用的数据回答：营业中的档口、等候时间、符合你时间的食物、你的订单和钱包。请点选下面的问题，或用自己的话再问一次：',
      ),
    ],
    items: [],
    notes: [],
    suggestions: defaultSuggestions(language).slice(0, FALLBACK_EXAMPLES),
  };
}

function thanksReply(language: ChatLanguage): ChatReply {
  return reply('thanks', language, {
    lines: [
      t(
        language,
        'You are welcome! Ask me anything else about the outlets, your food or your order.',
        '不客氣！關於檔口、食物或你的訂單，還有什麼想問的嗎？',
        '不客气！关于档口、食物或你的订单，还有什么想问的吗？',
      ),
    ],
  });
}

function smalltalkReply(language: ChatLanguage, text: string): ChatReply {
  const leaving = /\b(bye|goodbye|see you|good night)\b|再見|拜拜|再见/.test(text);
  return reply('smalltalk', language, {
    lines: [
      leaving
        ? t(
            language,
            'Bye! Come back when you are hungry.',
            '再見！餓了再來找我。',
            '再见！饿了再来找我。',
          )
        : t(
            language,
            'I am the UniBowl assistant. I follow simple rules and answer only from this app, so I am not a person and I do not chat freely. I can help with these:',
            '我是 UniBowl 小助手。我按簡單規則運作，只根據本應用的資料回答，不是真人，也不會閒聊。我可以協助：',
            '我是 UniBowl 小助手。我按简单规则运作，只根据本应用的数据回答，不是真人，也不会闲聊。我可以协助：',
          ),
    ],
    all: !leaving,
  });
}

const CLARIFY_DIET_KEYS: Readonly<Record<string, string>> = { pork: 'no_pork', beef: 'no_beef' };

const CLARIFY_DIET_QUERIES: Readonly<Record<string, string>> = {
  halal: 'halal food',
  vegan: 'vegan food',
  vegetarian: 'vegetarian food',
  pork: 'food with no pork',
  beef: 'food with no beef',
};

function clarifyReply(language: ChatLanguage, clarify: ChatClarify): ChatReply {
  const allergen = clarify.kind === 'allergen';
  const lines = [
    allergen
      ? t(
          language,
          'Which allergen do you mean? I will not guess, because an allergen filter has to be right. Tap one:',
          '你指的是哪一種過敏原？我不會猜測，因為過敏原篩選必須準確。請點選：',
          '你指的是哪一种过敏原？我不会猜测，因为过敏原筛选必须准确。请点选：',
        )
      : t(
          language,
          'Which diet do you mean? I will not guess. Tap one:',
          '你指的是哪一種飲食？我不會猜測。請點選：',
          '你指的是哪一种饮食？我不会猜测。请点选：',
        ),
  ];
  const suggestions: ChatSuggestion[] = clarify.options.map((id) =>
    allergen
      ? {
          label: label(language, ALLERGEN_NAMES, id),
          query: `food without ${ALLERGEN_NAMES[id]?.[0] ?? id}`,
        }
      : {
          label: label(language, DIET_NAMES, CLARIFY_DIET_KEYS[id] ?? id),
          query: CLARIFY_DIET_QUERIES[id] ?? `${id} food`,
        },
  );
  return { intent: 'find_food', lines, items: [], notes: [], suggestions };
}

const SAFETY_KINDS: ReadonlySet<string> = new Set(['diet', 'allergen']);

function correctionLines(language: ChatLanguage, corrections: readonly ChatCorrection[]): string[] {
  if (corrections.length === 0) return [];
  const words = [...new Set(corrections.map((item) => item.to))].join(', ');
  const lines = [
    t(language, `I read this as ${words}.`, `我把它理解為 ${words}。`, `我把它理解为 ${words}。`),
  ];
  if (corrections.some((item) => SAFETY_KINDS.has(item.kind))) {
    lines.push(
      t(
        language,
        'I matched that word loosely, so I am not saying any dish is safe for it. Check the dish tags before you order.',
        '我是按相近字詞推斷的，所以我不會說任何菜式對此安全。下單前請先查看菜式標籤。',
        '我是按相近字词推断的，所以我不会说任何菜式对此安全。下单前请先查看菜式标签。',
      ),
    );
  }
  return lines;
}

export function requestsFor(match: ChatMatch): ChatRequest[] {
  const { slots } = match;
  if (match.clarify !== null) return [];
  switch (match.intent) {
    case 'open_now':
    case 'wait_at_vendor':
      return [{ key: 'vendors', path: '/api/vendors' }];
    case 'find_food': {
      const params = new URLSearchParams();
      if (slots.maxWaitMinutes !== null) params.set('maxWait', String(slots.maxWaitMinutes));
      if (slots.maxPriceHkd !== null) params.set('maxPrice', String(slots.maxPriceHkd));
      if (slots.beforeClass) params.set('fits', '1');
      if (match.sort !== null) params.set('sort', match.sort);
      if (slots.allergens.length > 0) params.set('allergens', slots.allergens.join(','));
      const withoutHalal = new URLSearchParams(params);
      const others = slots.diets.filter((diet) => diet !== 'halal');
      if (others.length > 0) withoutHalal.set('diet', others.join(','));
      const withDiet = new URLSearchParams(params);
      if (slots.diets.length > 0) withDiet.set('diet', slots.diets.join(','));
      const build = (query: string): string =>
        query === '' ? '/api/menu-items' : `/api/menu-items?${query}`;
      const requests: ChatRequest[] = [{ key: 'foods', path: build(withDiet.toString()) }];
      if (slots.diets.includes('halal') && slots.halalFallback) {
        requests.push({ key: 'foodsWithoutDiet', path: build(withoutHalal.toString()) });
      }
      return requests;
    }
    case 'order_status':
      return [{ key: 'orders', path: '/api/orders' }];
    case 'leave_time':
      return [
        { key: 'orders', path: '/api/orders' },
        { key: 'foods', path: '/api/menu-items?fits=1' },
      ];
    case 'wallet':
      return [{ key: 'wallet', path: '/api/wallet/me' }];
    case 'how_to_order':
    case 'other_order':
    case 'help':
    case 'thanks':
    case 'smalltalk':
    case 'unknown':
      return [];
  }
}

function coreReply(match: ChatMatch, data: ChatData, language: ChatLanguage): ChatReply {
  switch (match.intent) {
    case 'open_now':
      return openNowReply(language, data);
    case 'wait_at_vendor':
      return waitReply(language, match, data);
    case 'find_food':
      return foodReply(language, match, data);
    case 'order_status':
      return orderReply(language, match, data);
    case 'wallet':
      return walletReply(language, data);
    case 'leave_time':
      return leaveReply(language, data);
    case 'how_to_order':
      return howToReply(language);
    case 'other_order':
      return refusalReply(language);
    case 'help':
      return helpReply(language);
    case 'thanks':
      return thanksReply(language);
    case 'smalltalk':
      return smalltalkReply(language, match.text);
    case 'unknown':
      return unknownReply(language);
  }
}

export function buildReply(match: ChatMatch, data: ChatData, language: ChatLanguage): ChatReply {
  if (match.clarify !== null) return clarifyReply(language, match.clarify);
  const core = coreReply(match, data, language);
  const lead = correctionLines(language, match.corrections);
  return lead.length === 0 ? core : { ...core, lines: [...lead, ...core.lines] };
}
