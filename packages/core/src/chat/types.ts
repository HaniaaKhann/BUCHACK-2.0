export type ChatLanguage = 'en' | 'zh_HK' | 'zh_CN';

export const CHAT_LANGUAGES: readonly ChatLanguage[] = ['en', 'zh_HK', 'zh_CN'];

export const CHAT_INTENTS = [
  'open_now',
  'wait_at_vendor',
  'find_food',
  'order_status',
  'wallet',
  'leave_time',
  'how_to_order',
  'other_order',
  'help',
  'unknown',
] as const;

export type ChatIntent = (typeof CHAT_INTENTS)[number];

export interface ChatSlots {
  maxWaitMinutes: number | null;
  maxPriceHkd: number | null;
  diets: string[];
  allergens: string[];
  spicy: boolean;
  beforeClass: boolean;
  halalFallback: boolean;
  orderId: string | null;
}

export interface ChatMatch {
  intent: ChatIntent;
  slots: ChatSlots;
  text: string;
}

export type ChatNote =
  | 'cannot_filter_spicy'
  | 'halal_not_verified'
  | 'halal_none_confirmed'
  | 'halal_fallback_offered'
  | 'no_results'
  | 'refused_other_order'
  | 'data_error'
  | 'vendor_unknown';

export interface ChatSuggestion {
  label: string;
  query: string;
}

export interface ChatReplyItem {
  id: string;
  text: string;
}

export interface ChatReply {
  intent: ChatIntent;
  lines: string[];
  items: ChatReplyItem[];
  notes: ChatNote[];
  suggestions: ChatSuggestion[];
}

export interface ChatVendor {
  id: string;
  name: string;
  openNow: boolean;
  paused: boolean;
  pickupEnabled: boolean;
  busyState: 'quiet' | 'normal' | 'rush';
  wait: { lowMinutes: number; highMinutes: number };
}

export interface ChatFoodItem {
  id: string;
  name: string;
  vendorName: string;
  priceHkd: number;
  tagsStatus: 'verified' | 'unverified';
  wait: { lowMinutes: number; highMinutes: number };
  leaveAt: number;
  leaveNow: boolean;
}

export interface ChatFoods {
  items: ChatFoodItem[];
  emptyState: string | null;
}

export interface ChatOrder {
  id: string;
  status:
    | 'placed'
    | 'accepted'
    | 'preparing'
    | 'ready'
    | 'completed'
    | 'picked_up'
    | 'cancelled';
  vendorName: string;
  placedAt: number;
  predicted: { low: number; point: number; high: number };
}

export interface ChatData {
  nowMs: number;
  vendors?: ChatVendor[];
  foods?: ChatFoods;
  foodsWithoutDiet?: ChatFoods;
  orders?: ChatOrder[];
  walletHkd?: number;
}

export interface ChatRequest {
  key: 'vendors' | 'foods' | 'foodsWithoutDiet' | 'orders' | 'wallet';
  path: string;
}
